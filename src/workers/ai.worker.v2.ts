import { pipeline, env, RawImage } from '@huggingface/transformers';

// KONFIGURACJA ŚRODOWISKA
env.allowLocalModels = true; 
env.allowRemoteModels = true; 
env.useBrowserCache = false; // WYRZUCONY CACHE - model będzie pobierany za każdym razem 

// Dynamiczne wykrywanie basePath dla GitHub Pages
const origin = self.location.origin;
const parts = self.location.pathname.split('/');
const basePath = origin.includes('github.io') ? `/${parts[1]}` : '';

// Ustawiamy remoteHost na nasze lokalne modele, ale Transformers.js 
// sam sprawdzi czy plik istnieje i ma poprawny JSON.
env.remoteHost = `${origin}${basePath}/models/`;
env.remotePathTemplate = '{model}/';

const log = (msg: string) => {
    console.log(`[Worker] ${msg}`);
    self.postMessage({ status: 'log', message: msg });
};

class PipelineSingleton {
  static modelId = 'Xenova/yolov8n'; 
  static instance: any = null;

  static async getInstance(progress_callback?: (progress: any) => void) {
    if (this.instance === null) {
      log(`Rozpoczynam inicjalizację silnika AI (${this.modelId})...`);
      try {
        // Próba 1: WebGPU
        this.instance = await pipeline('object-detection', this.modelId, {
          progress_callback: (p) => {
            if (p.status === 'initiate') log(`Inicjalizacja pliku: ${p.file}`);
            if (p.status === 'download') log(`Pobieranie: ${p.file} (może chwilę potrwać)...`);
            if (p.status === 'done') log(`Gotowe: ${p.file}`);
            if (progress_callback) progress_callback(p);
          },
          device: 'webgpu',
        });
        log(`Silnik AI GOTOWY (WebGPU)`);
      } catch (err: any) {
        log(`WebGPU nieudane, próbuję WASM (CPU)...`);
        this.instance = await pipeline('object-detection', this.modelId, {
          progress_callback,
          device: 'wasm',
        });
        log(`Silnik AI GOTOWY (WASM Fallback)`);
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
        output: results
      });
      
    } catch (error: any) {
      self.postMessage({ status: 'error', error: error.message });
    }
  }
};
