import { pipeline, env } from '@huggingface/transformers';
import { AI_CONFIG } from '../utils/aiConfig';

// v3 environment configuration - MUST BE SET BEFORE ANY PIPELINE CALL
env.allowLocalModels = true;
env.allowRemoteModels = false; 
env.useBrowserCache = true;
// Ścieżka do lokalnych modeli w folderze public - domyślnie root, ale będzie nadpisana przez baseUrl
env.localModelPath = '/models/';

// Detect mobile for specific optimizations
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

console.log('AI Worker Module Load. Configured for LOCAL models only.');

class PipelineSingleton {
  static task = AI_CONFIG.task;
  static model = AI_CONFIG.model;
  static instance: any = null;

  static async getInstance(progress_callback?: (progress: any) => void) {
    if (this.instance === null) {
      const isWebGPUSupported = !!(navigator as any).gpu;
      const shouldTryWebGPU = isWebGPUSupported;
      
      if (shouldTryWebGPU) {
        try {
          console.log('Attempting WebGPU initialization...');
          this.instance = await pipeline(this.task as any, this.model, {
            progress_callback,
            device: 'webgpu',
            quantized: true,
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
          quantized: true,
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
                    quantized: true,
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
    if (event.data.baseUrl) {
      env.localModelPath = event.data.baseUrl + 'models/';
      console.log('Worker: Adjusted localModelPath to:', env.localModelPath);
    }
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
      if (data.baseUrl) {
          env.localModelPath = data.baseUrl + 'models/';
      }
      const detector = await PipelineSingleton.getInstance();
      
      const bitmap = data.image;
      
      // Optimization: yolov8n native resolution is 640x640.
      // Scaling down to 640px (or 320px on mobile) in worker is faster than letting Transformers.js do it on CPU.
      const MAX_DIM = isMobile ? 320 : 640;
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
      
      // In v3, we can pass ImageData directly which is faster
      const imageData = offscreenCtx.getImageData(0, 0, targetWidth, targetHeight);

      const output = await detector(imageData, {
        threshold: data.threshold || AI_CONFIG.minConfidenceThreshold,
        percentage: true,
      });

      // Report actual device if it changed or for diagnostics
      if (detector.device !== PipelineSingleton.instance.device) {
          console.log('Actual pipeline device:', detector.device);
      }

      // Stricter NMS
      const filtered = nms(output, 0.3);

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


