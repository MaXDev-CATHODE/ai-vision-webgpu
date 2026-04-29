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

// Force ONNX Runtime configuration
if (!env.backends) (env as any).backends = {};
if (!env.backends.onnx) (env.backends as any).onnx = {};
if (!env.backends.onnx.wasm) (env.backends.onnx as any).wasm = {};

// Use CDN for WASM binaries to ensure they are found regardless of bundling
(env.backends.onnx.wasm as any).wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/';

// Detect mobile for specific optimizations
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
if (isMobile) {
    console.log('Mobile device detected, applying WASM optimizations...');
    (env.backends.onnx.wasm as any).numThreads = 1;
    (env.backends.onnx.wasm as any).proxy = false;
}

console.log('Current Transformers.js Env:', {
    backends: env.backends,
    allowRemoteModels: env.allowRemoteModels,
    useBrowserCache: env.useBrowserCache
});

class PipelineSingleton {
  static task = 'object-detection';
  static model = 'Xenova/yolos-tiny';
  static instance: any = null;

  static async getInstance(progress_callback?: (progress: any) => void) {
    if (this.instance === null) {
      const isWebGPUSupported = !!(navigator as any).gpu;
      const shouldTryWebGPU = isWebGPUSupported && !isMobile;
      
      if (shouldTryWebGPU) {
        try {
          console.log('Attempting WebGPU initialization...');
          this.instance = await pipeline(this.task as any, this.model, {
            progress_callback,
            device: 'webgpu',
          });
          console.log('Success: WebGPU backend');
          return this.instance;
        } catch (err: any) {
          console.warn('WebGPU failed, falling back to WASM. Reason:', err?.message || err);
        }
      }

      try {
        console.log('Initializing with WASM fallback...');
        this.instance = await pipeline(this.task as any, this.model, {
          progress_callback,
          device: 'wasm', 
        });
        console.log('Success: WASM backend');
        return this.instance;
      } catch (err: any) {
        console.error('WASM fallback failed:', err);
        
        try {
            console.log('FINAL FALLBACK: Initializing with CPU...');
            this.instance = await pipeline(this.task as any, this.model, {
                progress_callback,
                device: 'cpu',
            });
            console.log('Success: CPU backend');
            return this.instance;
        } catch (cpuErr: any) {
            console.error('CPU fallback failed:', cpuErr);
            
            // Last resort: retry without cache
            if (env.useBrowserCache) {
                console.warn('RETRY: Initializing without Browser Cache...');
                env.useBrowserCache = false;
                try {
                    this.instance = await pipeline(this.task as any, this.model, {
                        progress_callback,
                    });
                    console.log('Success after disabling cache');
                    return this.instance;
                } catch (retryErr: any) {
                    console.error('Critical failure after all attempts:', retryErr);
                    throw retryErr;
                }
            } else {
                throw cpuErr;
            }
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

