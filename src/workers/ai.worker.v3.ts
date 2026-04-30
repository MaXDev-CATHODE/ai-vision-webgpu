import { YoloEngine } from './modules/engines/yoloEngine';

/**
 * Menadżer Silnika AI
 * Zarządza cyklem życia silników inferencyjnych.
 */
class EngineManager {
  private static instance: YoloEngine | null = null;
  private static currentModelId: string = '';

  static async getEngine(modelId: string, progress_callback?: (p: any) => void) {
    if (this.instance && this.currentModelId === modelId) {
      return this.instance;
    }

    if (this.instance) {
      await this.instance.dispose();
    }

    this.instance = new YoloEngine();
    this.currentModelId = modelId;

    // Inicjalizujemy silnik (który wewnętrznie użyje ModelLoader)
    await this.instance.loadModel(modelId, progress_callback);
    
    return this.instance;
  }
}

// Obsługa komunikatów workera
self.onmessage = async (e) => {
  const { type, payload } = e.data;

  if (type === 'init' || type === 'load') {
    try {
      const modelId = payload?.modelId || 'yolov11';
      await EngineManager.getEngine(modelId, (p) => {
        // Przekazujemy progres bezpośrednio jako status
        self.postMessage(p);
      });
      self.postMessage({ 
        status: 'ready', 
        features: 'Object Detection (YOLOv11)', 
        device: 'WebGPU (Direct)' 
      });
    } catch (error: any) {
      self.postMessage({ status: 'error', error: error.message });
    }
  }

  if (type === 'detect' || e.data.action === 'detect') {
    try {
      const { image, threshold, modelId: mId } = payload || e.data;
      console.log(`[Worker] Detect requested. Image type: ${typeof image}, Constructor: ${image?.constructor?.name}`);
      const modelId = mId || 'yolov11';
      const engine = await EngineManager.getEngine(modelId);
      const results = await engine.detect(image, threshold);
      
      self.postMessage({ status: 'result', output: results });
    } catch (error: any) {
      self.postMessage({ status: 'error', error: error.message });
    }
  }
};
