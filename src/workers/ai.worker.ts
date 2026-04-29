import { pipeline, env, RawImage } from '@huggingface/transformers';

// Diagnostics for Mobile Debugging
console.log('AI Worker Start Diagnostics:', {
    userAgent: navigator.userAgent,
    hardwareConcurrency: navigator.hardwareConcurrency,
    // @ts-ignore
    deviceMemory: navigator.deviceMemory,
    gpu: !!(navigator as any).gpu,
    timestamp: new Date().toISOString()
});

// v3 environment configuration
env.allowLocalModels = false;
env.allowRemoteModels = true; 
env.useBrowserCache = true;

class PipelineSingleton {
  static task = 'object-detection';
  static model = 'Xenova/yolos-tiny';
  static instance: any = null;

  static async getInstance(progress_callback?: (progress: any) => void) {
    if (this.instance === null) {
      const isWebGPUSupported = !!(navigator as any).gpu;

      
      if (isWebGPUSupported) {
        try {
          console.log('Initializing v3 Pipeline with WebGPU...');
          this.instance = await pipeline(this.task as any, this.model, {
            progress_callback,
            device: 'webgpu',
          });
          console.log('Successfully initialized WebGPU pipeline');
          return this.instance;
        } catch (err: any) {
          console.warn('WebGPU failed, falling back to CPU. Reason:', err?.message || err);
        }
      }

      try {
        console.log('Initializing v3 Pipeline with CPU fallback...');
        this.instance = await pipeline(this.task as any, this.model, {
          progress_callback,
        });
      } catch (err: any) {
        console.error('CPU initialization failed:', err);
        
        // Retry without cache - helps on mobile devices with broken OPFS/Cache Storage
        if (env.useBrowserCache) {
          console.warn('RETRY: Attempting initialization without Browser Cache...');
          env.useBrowserCache = false;
          try {
            this.instance = await pipeline(this.task as any, this.model, {
              progress_callback,
            });
            console.log('Success after disabling cache');
          } catch (retryErr: any) {
            console.error('Final initialization failure:', retryErr);
            throw retryErr;
          }
        } else {
          throw err;
        }
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
    } catch (err: any) {
      console.error('Detailed Model loading failed:', {
        message: err.message,
        stack: err.stack,
        err
      });
      self.postMessage({ 
        type: 'error', 
        data: err.message || String(err) 
      });
    }
  }

  if (type === 'detect') {
    try {
      const detector = await PipelineSingleton.getInstance();
      
      const bitmap = data.image;
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get OffscreenCanvas context');
      
      ctx.drawImage(bitmap, 0, 0);
      const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);

      let image;
      try {
        image = await (RawImage as any).read(imageData);
      } catch (readErr) {
        console.warn('RawImage.read fallback:', readErr);
        image = new RawImage(imageData.data, imageData.width, imageData.height, 4);
      }

      const output = await detector(image, {
        threshold: data.threshold || 0.4,
        percentage: true,
      });

      const filtered = nms(output, 0.4);

      self.postMessage({ type: 'detect_result', data: filtered });
      
      if (data.image && data.image.close) data.image.close();
      
    } catch (err: any) {
      console.error('v3 Detection Error:', err);
      self.postMessage({ 
        type: 'error', 
        data: err.message || String(err) 
      });
      if (data.image && data.image.close) data.image.close();
    }
  }
});

