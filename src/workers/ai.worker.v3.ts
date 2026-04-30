import { env, RawImage } from '@huggingface/transformers';
import { ModelLoader } from './modules/modelLoader';

// KONFIGURACJA ŚRODOWISKA PRZENIESIONA DO ModelLoader

class PipelineSingleton {
  static modelId = 'onnx-community/yolov10n'; 
  static instance: any = null;

  static async getInstance(progress_callback?: (progress: any) => void) {
    if (this.instance === null) {
      this.instance = await ModelLoader.loadModelWithFallback(
        this.modelId, 
        'object-detection', 
        { device: 'webgpu' },
        progress_callback
      );
    }
    return this.instance;
  }
}

self.onmessage = async (event: MessageEvent) => {
  const { action, image, threshold, clearCache } = event.data;

  if (action === 'init') {
    try {
      if (clearCache) {
          env.useBrowserCache = false;
      }
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
      
      if (image.close) image.close();

      self.postMessage({ 
        status: 'result', 
        output: results
      });
      
    } catch (error: any) {
      self.postMessage({ status: 'error', error: error.message });
    }
  }
};
