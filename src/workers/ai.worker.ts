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

// Detect mobile for specific optimizations
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
if (isMobile) {
    console.log('Mobile device detected, applying WASM compatibility fixes...');
    // Disable multithreading and SIMD on mobile to avoid dynamic module fetch errors (.mjs)
    // and requirements for COOP/COEP headers.
    (env.backends.onnx.wasm as any).numThreads = 1;
    (env.backends.onnx.wasm as any).simd = false;
    (env.backends.onnx.wasm as any).proxy = false;
}

console.log('Current Transformers.js Env:', {
    backends: env.backends,
    allowRemoteModels: env.allowRemoteModels,
    useBrowserCache: env.useBrowserCache,
    isMobile
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
        console.log('Initializing with WASM fallback (SIMD/Threads optimized)...');
        this.instance = await pipeline(this.task as any, this.model, {
          progress_callback,
          device: 'wasm', 
        });
        console.log('Success: WASM backend');
        return this.instance;
      } catch (err: any) {
        console.error('WASM fallback failed:', err);
        
        // Final retry: disable cache entirely
        if (env.useBrowserCache) {
            console.warn('FINAL RETRY: Initializing without Browser Cache...');
            env.useBrowserCache = false;
            try {
                this.instance = await pipeline(this.task as any, this.model, {
                    progress_callback,
                    device: 'wasm',
                });
                console.log('Success after disabling cache');
                return this.instance;
            } catch (retryErr: any) {
                console.error('Critical failure after all attempts:', retryErr);
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

// Pre-allocate resources to avoid GC pressure
let offscreenCanvas: OffscreenCanvas | null = null;
let offscreenCtx: OffscreenCanvasRenderingContext2D | null = null;
let isProcessing = false;

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
    // Skip frame if already processing (prevents queue buildup and high latency)
    if (isProcessing) {
        if (data.image && data.image.close) data.image.close();
        return;
    }

    try {
      isProcessing = true;
      const detector = await PipelineSingleton.getInstance();
      
      const bitmap = data.image;
      
      // Optimization: Downsample image for faster processing on CPU/Mobile
      // Model yolos-tiny works on small resolution anyway.
      const MAX_DIM = isMobile ? 480 : 640;
      let targetWidth = bitmap.width;
      let targetHeight = bitmap.height;
      
      if (targetWidth > MAX_DIM || targetHeight > MAX_DIM) {
          const scale = MAX_DIM / Math.max(targetWidth, targetHeight);
          targetWidth = Math.floor(targetWidth * scale);
          targetHeight = Math.floor(targetHeight * scale);
      }

      // Reuse canvas and context
      if (!offscreenCanvas || offscreenCanvas.width !== targetWidth || offscreenCanvas.height !== targetHeight) {
          offscreenCanvas = new OffscreenCanvas(targetWidth, targetHeight);
          offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
      }
      
      if (!offscreenCtx) throw new Error('Could not get OffscreenCanvas context');
      
      // Draw rescaled image
      offscreenCtx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
      const imageData = offscreenCtx.getImageData(0, 0, targetWidth, targetHeight);

      let image;
      try {
        image = await (RawImage as any).read(imageData);
      } catch (readErr) {
        image = new RawImage(imageData.data, imageData.width, imageData.height, 4);
      }

      const output = await detector(image, {
        threshold: data.threshold || 0.5, // Default to 0.5 for better accuracy
        percentage: true,
      });

      // Stricter NMS for mobile
      const filtered = nms(output, 0.35);

      self.postMessage({ type: 'detect_result', data: filtered });
      
    } catch (err: any) {
      console.error('v3 Detection Error:', err);
      self.postMessage({ 
        type: 'error', 
        data: err.message || String(err) 
      });
    } finally {
      isProcessing = false;
      if (data.image && data.image.close) data.image.close();
    }
  }
});


