import { AutoModel, env, Tensor } from '@huggingface/transformers';

// KONFIGURACJA
env.allowLocalModels = true; // Pozwalamy na lokalne modele, jeśli są poprawne
env.allowRemoteModels = true; 
env.useBrowserCache = true; 
env.remotePathTemplate = '{model}/'; 

const origin = self.location.origin;
// Domyślnie szukamy lokalnie, ale jeśli modelId się nie zgadza, pobierze z HF
env.remoteHost = `${origin}/ai-vision-webgpu/models/`;

if (env.backends.onnx.wasm) {
  // @ts-ignore
  env.backends.onnx.wasm.proxy = false; 
  // @ts-ignore
  env.backends.onnx.wasm.wasmPaths = `${origin}/ai-vision-webgpu/wasm/`;
}

// Bufory wielokrotnego użytku dla wydajności
let offscreenCanvas: OffscreenCanvas | null = null;
let offscreenCtx: OffscreenCanvasRenderingContext2D | null = null;

const log = (msg: string) => self.postMessage({ status: 'log', message: msg });

class PipelineSingleton {
  static modelId = 'Xenova/yolov8n'; // 80 klas COCO (Detection)
  static instance: any = null;

  static async getInstance(progress_callback?: (progress: any) => void) {
    if (this.instance === null) {
      log(`Worker: Inicjalizacja silnika detekcji (80 KLAS COCO)...`);
      try {
        const isWebGPUSupported = !!(navigator as any).gpu;
        const device = isWebGPUSupported ? 'webgpu' : 'wasm';
        
        const model = await AutoModel.from_pretrained(this.modelId, {
          progress_callback,
          device: device,
          // @ts-ignore
          model_file: 'model.onnx',
          // @ts-ignore
          quantized: false,
        });

        this.instance = model;
        log(`Universal Model loaded on ${device}.`);
      } catch (err: any) {
        log(`LOAD ERROR: ${err.message}`);
        throw err;
      }
    }
    return this.instance;
  }
}

self.onmessage = async (event: MessageEvent) => {
  const { action, image, threshold } = event.data;

  if (action === 'init') {
    try {
      await PipelineSingleton.getInstance((progress) => {
        self.postMessage({ status: 'progress', progress });
      });
      self.postMessage({ status: 'ready' });
    } catch (error: any) {
      self.postMessage({ status: 'error', error: error.message });
    }
    return;
  }

  if (action === 'detect' && image) {
    try {
      const model = await PipelineSingleton.getInstance();
      const t0 = performance.now();
      
      const size = 640;
      // Inicjalizacja canvasa raz
      if (!offscreenCanvas) {
        offscreenCanvas = new OffscreenCanvas(size, size);
        offscreenCtx = offscreenCanvas.getContext('2d', { alpha: false, desynchronized: true });
      }
      
      if (!offscreenCtx) return;
      offscreenCtx.drawImage(image, 0, 0, size, size);
      const imageData = offscreenCtx.getImageData(0, 0, size, size);
      const data8 = imageData.data;
      
      // Normalizacja Mean/Std (ImageNet) wymagana przez Transformers.js YOLOv8
      const floatData = new Float32Array(3 * size * size);
      const mean = [0.485, 0.456, 0.406];
      const std = [0.229, 0.224, 0.225];
      
      for (let i = 0; i < size * size; i++) {
        const i4 = i << 2;
        // R G B (Planar format [1, 3, 640, 640])
        floatData[i] = (data8[i4] / 255.0 - mean[0]) / std[0]; 
        floatData[size * size + i] = (data8[i4 + 1] / 255.0 - mean[1]) / std[1]; 
        floatData[2 * size * size + i] = (data8[i4 + 2] / 255.0 - mean[2]) / std[2]; 
      }
      
      image.close(); // Zwolnienie Bitmapy
      const t1 = performance.now();
      
      const inputTensor = new Tensor('float32', floatData, [1, 3, size, size]);
      
      let outputs;
      try {
        // Niektóre modele wolą 'images', inne 'pixel_values'
        outputs = await model({ images: inputTensor });
      } catch (e) {
        outputs = await model({ pixel_values: inputTensor });
      }

      const output0 = outputs.output0 || outputs.logits || Object.values(outputs)[0] as any;
      const data = output0.data as Float32Array;
      const dims = output0.dims; 

      let num_features: number;
      let num_anchors: number;
      let transposed = false;

      // Wykrywanie orientacji tensora [features, anchors] vs [anchors, features]
      if (dims[1] < dims[2]) {
        num_features = dims[1];
        num_anchors = dims[2];
        transposed = false;
      } else {
        num_anchors = dims[1];
        num_features = dims[2];
        transposed = true;
      }
      
      const detections = [];
      const confLimit = threshold || 0.4;
      // Wyliczamy threshold w przestrzeni logitów raz
      const thresholdLogit = -Math.log(1 / confLimit - 1); 

      const isPose = num_features === 56;
      const t2 = performance.now(); // Koniec modelu, początek post-processingu

      // Optymalizacja pętli: Wyciągnięcie warunku transposed na zewnątrz
      if (transposed) {
        for (let i = 0; i < num_anchors; ++i) {
          let score = 0;
          let classId = 0;
          const rowOffset = i * num_features;

          if (isPose) {
            const logit = data[rowOffset + 4];
            if (logit < thresholdLogit) continue;
            score = 1 / (1 + Math.exp(-logit));
            classId = 0;
          } else {
            let maxLogit = -Infinity;
            let bestClass = 0;
            for (let c = 4; c < num_features; ++c) {
              const val = data[rowOffset + c];
              if (val > maxLogit) {
                maxLogit = val;
                bestClass = c - 4;
              }
            }
            if (maxLogit < thresholdLogit) continue;
            score = 1 / (1 + Math.exp(-maxLogit));
            classId = bestClass;
          }

          const cx = data[rowOffset + 0] / 640;
          const cy = data[rowOffset + 1] / 640;
          const w = data[rowOffset + 2] / 640;
          const h = data[rowOffset + 3] / 640;
          
          detections.push({
            label: COCO_CLASSES[classId] || `obj_${classId}`,
            score: score,
            box: { xmin: cx - w/2, ymin: cy - h/2, xmax: cx + w/2, ymax: cy + h/2 }
          });
        }
      } else {
        // Not transposed [features, anchors]
        const c0 = 0, c1 = num_anchors, c2 = 2 * num_anchors, c3 = 3 * num_anchors, c4 = 4 * num_anchors;
        for (let i = 0; i < num_anchors; ++i) {
          let score = 0;
          let classId = 0;

          if (isPose) {
            const logit = data[c4 + i];
            if (logit < thresholdLogit) continue;
            score = 1 / (1 + Math.exp(-logit));
            classId = 0;
          } else {
            let maxLogit = -Infinity;
            let bestClass = 0;
            for (let c = 4; c < num_features; ++c) {
              const val = data[c * num_anchors + i];
              if (val > maxLogit) {
                maxLogit = val;
                bestClass = c - 4;
              }
            }
            if (maxLogit < thresholdLogit) continue;
            score = 1 / (1 + Math.exp(-maxLogit));
            classId = bestClass;
          }

          const cx = data[c0 + i] / 640;
          const cy = data[c1 + i] / 640;
          const w = data[c2 + i] / 640;
          const h = data[c3 + i] / 640;
          
          detections.push({
            label: COCO_CLASSES[classId] || `obj_${classId}`,
            score: score,
            box: { xmin: cx - w/2, ymin: cy - h/2, xmax: cx + w/2, ymax: cy + h/2 }
          });
        }
      }

      const finalDetections = nms(detections, 0.45);
      const t3 = performance.now();
      
      // Logowanie wydajności co 50 klatek, aby nie spamować
      if (Math.random() < 0.02) {
        log(`PERF: Pre:${(t1-t0).toFixed(1)}ms, Model:${(t2-t1).toFixed(1)}ms, Post:${(t3-t2).toFixed(1)}ms`);
        if (isPose) log(`INFO: Wykryto model typu POSE (56 cech).`);
      }

      self.postMessage({ status: 'result', output: finalDetections });
      
    } catch (error: any) {
      self.postMessage({ status: 'error', error: error.message });
    }
  }
};

const COCO_CLASSES = [
  "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat", "traffic light",
  "fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat", "dog", "horse", "sheep", "cow",
  "elephant", "bear", "zebra", "giraffe", "backpack", "umbrella", "handbag", "tie", "suitcase", "frisbee",
  "skis", "snowboard", "sports ball", "kite", "baseball bat", "baseball glove", "skateboard", "surfboard", "tennis racket", "bottle",
  "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana", "apple", "sandwich", "orange",
  "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair", "couch", "potted plant", "bed",
  "dining table", "toilet", "tv", "laptop", "mouse", "remote", "keyboard", "cell phone", "microwave", "oven",
  "toaster", "sink", "refrigerator", "book", "clock", "vase", "scissors", "teddy bear", "hair drier", "toothbrush"
];

function nms(boxes: any[], iouThreshold: number) {
  boxes.sort((a, b) => b.score - a.score);
  const result = [];
  const selected = new Array(boxes.length).fill(true);
  for (let i = 0; i < Math.min(boxes.length, 100); i++) {
    if (!selected[i]) continue;
    result.push(boxes[i]);
    for (let j = i + 1; j < boxes.length; j++) {
      if (!selected[j]) continue;
      if (calculateIoU(boxes[i].box, boxes[j].box) > iouThreshold) {
        selected[j] = false;
      }
    }
  }
  return result;
}

function calculateIoU(box1: any, box2: any) {
  const x1 = Math.max(box1.xmin, box2.xmin);
  const y1 = Math.max(box1.ymin, box2.ymin);
  const x2 = Math.min(box1.xmax, box2.xmax);
  const y2 = Math.min(box1.ymax, box2.ymax);
  const width = Math.max(0, x2 - x1);
  const height = Math.max(0, y2 - y1);
  const intersectionArea = width * height;
  const box1Area = Math.max(0, (box1.xmax - box1.xmin) * (box1.ymax - box1.ymin));
  const box2Area = Math.max(0, (box2.xmax - box2.xmin) * (box2.ymax - box2.ymin));
  const unionArea = box1Area + box2Area - intersectionArea;
  return unionArea > 0 ? intersectionArea / unionArea : 0;
}
