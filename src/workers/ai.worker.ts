import { pipeline, env, RawImage } from '@huggingface/transformers';
import { AI_CONFIG } from '../utils/aiConfig';

// Konfiguracja v3
env.allowLocalModels = false; 
env.allowRemoteModels = true; 
env.useBrowserCache = false; 
env.remotePathTemplate = '{model}/'; 

// WASM optimizations
if (env.backends.onnx.wasm) {
  env.backends.onnx.wasm.numThreads = 1; 
  env.backends.onnx.wasm.simd = true;
}

const log = (msg: string) => self.postMessage({ status: 'log', message: msg });

async function resolveBestModelHost(modelName: string): Promise<string> {
  const origin = self.location.origin;
  const hostsToTry = [
    `${origin}/ai-vision-webgpu/models/Xenova/`, 
    `${origin}/models/Xenova/`,                 
    `${origin}/ai-vision-webgpu/models/`, 
    `${origin}/models/`,
  ];

  for (const host of hostsToTry) {
    try {
      const testUrl = `${host}${modelName}/config.json`;
      log(`Worker: Testing model path: ${testUrl}`);
      const response = await fetch(testUrl, { method: 'GET' }); 
      const contentType = response.headers.get('content-type') || '';
      
      if (response.ok && !contentType.includes('text/html')) {
        log(`Worker: Found valid model host: ${host}`);
        return host;
      } else {
        log(`Worker: Path ${host} returned OK but it's HTML (SPA fallback). Skipping.`);
      }
    } catch (e: any) {
      log(`Worker: Error testing ${host}: ${e.message}`);
    }
  }
  
  log("Worker: Could not auto-detect model host, falling back to default.");
  return hostsToTry[0];
}

class PipelineSingleton {
  static model = AI_CONFIG.model;
  static instance: any = null;

  static async getInstance(progress_callback?: (progress: any) => void) {
    if (this.instance === null) {
      env.remoteHost = await resolveBestModelHost(this.model);
      const modelId = this.model;
      
      log(`Worker: Requesting model: ${modelId} via host: ${env.remoteHost}`);

      const isWebGPUSupported = !!(navigator as any).gpu;
      
      try {
        log('Attempting pipeline initialization...');
        this.instance = await pipeline('object-detection', modelId, {
          progress_callback,
          device: isWebGPUSupported ? 'webgpu' : 'wasm',
          // @ts-ignore
          tokenizer: null, 
        });

        log('Success: Pipeline initialized');

        // PANCERNY PATCH: przechwyć wywołanie forward i zmapuj klucze
        if (this.instance.model) {
          const model = this.instance.model;
          const originalForward = model.forward.bind(model);
          model.forward = async (inputs: any, ...args: any[]) => {
            if (inputs.pixel_values && !inputs.images) {
               inputs.images = inputs.pixel_values;
            }
            return originalForward(inputs, ...args);
          };
          log('Success: Model forward method patched for "images" input');
        }

        return this.instance;
      } catch (err: any) {
        log(`CRITICAL FAILURE: ${err.message}`);
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

  if (action === 'detect') {
    log(`Worker: Received detect request for image. Action: ${action}`);
    try {
      const detector = await PipelineSingleton.getInstance();
      const processor = (detector as any).processor || (detector as any).image_processor;
      const model = (detector as any).model;

      // 1. Convert ImageBitmap to RawImage for processing stability in v3
      const canvas = new OffscreenCanvas(image.width, image.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("OffscreenCanvas context failed");
      ctx.drawImage(image, 0, 0);
      const imageData = ctx.getImageData(0, 0, image.width, image.height);
      const rawImage = new RawImage(new Uint8Array(imageData.data), image.width, image.height, 4);
      const inputs = await processor(rawImage);
      
      // 2. Use pipeline for automatic post-processing
      // Our forward patch in Singleton will handle the key mapping
      const outputs = await model.forward({ 
        images: inputs.pixel_values,
        pixel_values: inputs.pixel_values
      });

      // 3. Manual YOLOv8 Decoding (most stable approach for v3 compatibility)
      const output0 = outputs.output0;
      const data = output0.data;
      const [_batch, num_features, num_anchors] = output0.dims; // [1, 84, 8400]
      
      const detections = [];
      const confLimit = threshold || 0.4;
      
      for (let i = 0; i < num_anchors; ++i) {
        let maxScore = -1;
        let classId = -1;
        
        // Find best class
        for (let c = 4; c < num_features; ++c) {
          const score = data[c * num_anchors + i];
          if (score > maxScore) {
            maxScore = score;
            classId = c - 4;
          }
        }
        
        if (maxScore > confLimit) {
          const cx = data[0 * num_anchors + i];
          const cy = data[1 * num_anchors + i];
          const w = data[2 * num_anchors + i];
          const h = data[3 * num_anchors + i];
          
          // YOLOv8 output is typically [0-640] if input was 640x640
          const xmin = (cx - w/2);
          const ymin = (cy - h/2);
          const xmax = (cx + w/2);
          const ymax = (cy + h/2);
          
          detections.push({
            label: COCO_CLASSES[classId] || `obj_${classId}`,
            score: maxScore,
            box: {
              xmin: Math.max(0, xmin),
              ymin: Math.max(0, ymin),
              xmax: Math.min(1, xmax),
              ymax: Math.min(1, ymax)
            }
          });
        }
      }

      // Simple NMS (Non-Maximum Suppression) - be more strict
      const finalDetections = nms(detections, 0.4);
      
      log(`Success: Found ${finalDetections.length} objects`);
      self.postMessage({ status: 'result', output: Array.isArray(finalDetections) ? finalDetections : [] });
    } catch (error: any) {
      self.postMessage({ status: 'error', error: error.message });
    }
  }
};

// --- HELPER FUNCTIONS ---

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
  
  for (let i = 0; i < boxes.length; i++) {
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
  
  const box1Area = (box1.xmax - box1.xmin) * (box1.ymax - box1.ymin);
  const box2Area = (box2.xmax - box2.xmin) * (box2.ymax - box2.ymin);
  
  return intersectionArea / (box1Area + box2Area - intersectionArea);
}
