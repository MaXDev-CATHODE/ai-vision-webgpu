import { pipeline, env, RawImage } from '@huggingface/transformers';

// v3 environment configuration
env.allowLocalModels = false;
env.useBrowserCache = true;

class PipelineSingleton {
  static task = 'object-detection';
  static model = 'onnx-community/yolos-tiny'; // v3 model path
  static instance: any = null;

  static async getInstance(progress_callback?: (progress: any) => void) {
    if (this.instance === null) {
      try {
        console.log('Initializing v3 Pipeline with WebGPU...');
        this.instance = await pipeline(this.task as any, this.model, {
          progress_callback,
          device: 'webgpu',
        });
      } catch (err) {
        console.warn('WebGPU not available in v3, falling back to CPU:', err);
        this.instance = await pipeline(this.task as any, this.model, {
          progress_callback,
        });
      }
    }
    return this.instance;
  }
}

function calculateIoU(box1: any, box2: any) {
  const x1 = Math.max(box1.xmin, box2.xmin);
  const y1 = Math.max(box1.ymin, box2.ymin);
  const x2 = Math.min(box1.xmax, box2.xmax);
  const y2 = Math.min(box1.ymax, box2.ymax);

  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const area1 = (box1.xmax - box1.xmin) * (box1.ymax - box1.ymin);
  const area2 = (box2.xmax - box2.xmin) * (box2.ymax - box2.ymin);
  const union = area1 + area2 - intersection;

  return union > 0 ? intersection / union : 0;
}

function nms(detections: any[], iouThreshold = 0.4) {
  if (!Array.isArray(detections)) return [];
  
  const sorted = [...detections].sort((a, b) => b.score - a.score);
  const kept: any[] = [];

  for (const current of sorted) {
    let keep = true;
    for (const other of kept) {
      if (calculateIoU(current.box, other.box) > iouThreshold) {
        keep = false;
        break;
      }
    }
    if (keep) kept.push(current);
  }
  return kept.slice(0, 10);
}

self.addEventListener('message', async (event) => {
  const { type, data } = event.data;

  if (type === 'load_model') {
    try {
      await PipelineSingleton.getInstance((x) => {
        self.postMessage({ type: 'progress', data: x });
      });
      self.postMessage({ type: 'ready' });
    } catch (err) {
      console.error('Model loading failed:', err);
      self.postMessage({ type: 'error', data: String(err) });
    }
  }

  if (type === 'detect') {
    try {
      const detector = await PipelineSingleton.getInstance();
      
      // v3 handles ImageBitmap more directly in many cases, 
      // but RawImage.fromCanvas or fromImageBitmap is safer.
      const image = await RawImage.fromImageBitmap(data.image);

      const output = await detector(image, {
        threshold: data.threshold || 0.4,
        percentage: true,
      });

      const filtered = nms(output, 0.4);

      self.postMessage({ type: 'detect_result', data: filtered });
      
      // Cleanup
      if (data.image && data.image.close) data.image.close();
      
    } catch (err) {
      console.error('v3 Detection Error:', err);
      self.postMessage({ type: 'error', data: String(err) });
      if (data.image && data.image.close) data.image.close();
    }
  }
});
