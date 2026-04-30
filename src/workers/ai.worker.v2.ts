import { pipeline, env, RawImage } from '@huggingface/transformers';

// KONFIGURACJA ŚRODOWISKA
env.allowLocalModels = false; 
env.allowRemoteModels = true; 
env.useBrowserCache = true; 

const log = (msg: string) => {
    console.log(`[Worker] ${msg}`);
    self.postMessage({ status: 'log', message: msg });
};

console.log('[Worker] SCRIPT START');

class PipelineSingleton {
  static modelId = 'Xenova/yolov8n'; 
  static instance: any = null;

  static async getInstance(progress_callback?: (progress: any) => void) {
    if (this.instance === null) {
      log(`Próba załadowania modelu ${this.modelId} z HuggingFace Hub...`);
      try {
        // WYMUSZAMY WASM DO TESTÓW (aby sprawdzić czy pobieranie w ogóle ruszy)
        this.instance = await pipeline('object-detection', this.modelId, {
          progress_callback,
          device: 'wasm', 
        });
        log(`Model załadowany pomyślnie (WASM fallback)`);
      } catch (err: any) {
        log(`BŁĄD ŁADOWANIA: ${err.message}`);
        throw err;
      }
    }
    return this.instance;
  }
}

self.onmessage = async (event: MessageEvent) => {
  const { action, image, threshold } = event.data;
  console.log('[Worker] Message received:', action);

  if (action === 'init') {
    try {
      await PipelineSingleton.getInstance((progress) => {
        if (progress.status === 'progress') {
            log(`Pobieranie: ${progress.file} (${progress.progress.toFixed(1)}%)`);
        }
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
      
      // Konwersja ImageBitmap -> RawImage przez OffscreenCanvas
      const canvas = new OffscreenCanvas(image.width, image.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Context 2D not available");
      ctx.drawImage(image, 0, 0);
      const imageData = ctx.getImageData(0, 0, image.width, image.height);
      
      const rawImage = new RawImage(imageData.data, image.width, image.height, 4);
      
      const results = await detector(rawImage, {
        threshold: threshold || 0.3,
        percentage: true
      });
      
      image.close();

      self.postMessage({ 
        status: 'result', 
        output: results.map((res: any) => ({
            label: res.label,
            score: res.score,
            box: res.box
        }))
      });
      
    } catch (error: any) {
      self.postMessage({ status: 'error', error: error.message });
    }
  }
};
