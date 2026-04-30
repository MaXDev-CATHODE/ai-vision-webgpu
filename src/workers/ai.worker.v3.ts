import { pipeline, env, RawImage } from '@huggingface/transformers';

// KONFIGURACJA ŚRODOWISKA
env.allowLocalModels = false; // Na razie pobieramy z Hub, potem dodamy opcję local
env.allowRemoteModels = true; 
env.useBrowserCache = true; 

const log = (msg: string) => {
    console.log(`[AI Worker v3] ${msg}`);
};

class PipelineSingleton {
  static modelId = 'onnx-community/yolov11n'; 
  static instance: any = null;

  static async getInstance(progress_callback?: (progress: any) => void) {
    if (this.instance === null) {
      log(`Próba inicjalizacji modelu ${this.modelId} z WebGPU...`);
      try {
        this.instance = await pipeline('object-detection', this.modelId, {
          progress_callback,
          device: 'webgpu',
          dtype: 'fp16', // FP16 dla oszczędności pamięci i wydajności na mobile
        });
        log(`Model załadowany pomyślnie przez WebGPU`);
      } catch (err: any) {
        log(`WebGPU FAILED: ${err.message}. Fallback to WASM...`);
        try {
          this.instance = await pipeline('object-detection', this.modelId, {
            progress_callback,
            device: 'wasm',
          });
          log(`Model załadowany pomyślnie (WASM fallback)`);
        } catch (wasmErr: any) {
          log(`CRITICAL ERROR: ${wasmErr.message}`);
          throw wasmErr;
        }
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
      const detector = await PipelineSingleton.getInstance();
      
      // Image to ImageData conversion in worker
      // Jeśli otrzymujemy ImageBitmap, musimy go wyrenderować na OffscreenCanvas
      const canvas = new OffscreenCanvas(image.width, image.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("OffscreenCanvas 2D context not available");
      ctx.drawImage(image, 0, 0);
      const imageData = ctx.getImageData(0, 0, image.width, image.height);
      
      const rawImage = new RawImage(imageData.data, image.width, image.height, 4);
      
      const startTime = performance.now();
      const results = await detector(rawImage, {
        threshold: threshold || 0.25,
        percentage: true
      });
      const inferenceTime = performance.now() - startTime;

      // Zwalnianie ImageBitmap
      if (image.close) image.close();

      self.postMessage({ 
        status: 'result', 
        output: results.map((res: any) => ({
            label: res.label,
            score: res.score,
            box: res.box
        })),
        metrics: {
          inferenceTime
        }
      });
      
    } catch (error: any) {
      self.postMessage({ status: 'error', error: error.message });
    }
  }
};
