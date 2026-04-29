import { pipeline, env } from '@xenova/transformers';

// Opcjonalne: Wyłączenie lokalnych plików i używanie tylko CDN dla WebGPU
env.allowLocalModels = false;

// Wzorzec Singleton do przechowywania załadowanego modelu w pamięci Workera
class PipelineSingleton {
  static task = 'object-detection';
  static model = 'Xenova/detr-resnet-50'; // Świetny model do detekcji
  static instance: any = null;

  static async getInstance(progress_callback?: (progress: any) => void) {
    if (this.instance === null) {
      // Inicjalizacja pipeline'u. Opcja quantized zapewnia dużo mniejszy rozmiar pliku
      this.instance = await pipeline(this.task as any, this.model, {
        progress_callback,
        quantized: true, 
      });
    }
    return this.instance;
  }
}

// Nasłuchiwanie na komunikaty z głównego wątku aplikacji
self.addEventListener('message', async (event) => {
  const { type, data } = event.data;

  // Akcja: ZAŁADOWANIE MODELU
  if (type === 'load_model') {
    try {
      await PipelineSingleton.getInstance((x) => {
        // Odsyłanie informacji o postępie pobierania na żywo do UI
        self.postMessage({ type: 'progress', data: x });
      });
      self.postMessage({ type: 'ready' });
    } catch (err) {
      console.error('Worker Error podczas ładowania modelu:', err);
      self.postMessage({ type: 'error', data: err });
    }
  }

  // Akcja: PRZETWORZENIE KLATKI WIDEO (Detekcja)
  if (type === 'detect') {
    try {
      // console.log('Worker: Rozpoczynam detekcję...');
      const detector = await PipelineSingleton.getInstance();
      
      // Detektor z Transformers.js przyjmuje Base64, URL lub obiekt Canvas/Image
      // Ponieważ operujemy na strumieniu live, najwydajniejszy jest zakodowany Base64 wysłany z głównego wątku
      const output = await detector(data.image, {
        threshold: data.threshold || 0.5,
        percentage: true, // Zwraca koordynaty jako % wielkości oryginalnego zdjęcia (0.0-1.0), co drastycznie ułatwia skalowanie w CSS
      });

      // Odesłanie wygenerowanych Bounding Boxes z powrotem do wątku głównego
      self.postMessage({ type: 'detect_result', data: output });
      
    } catch (err) {
      self.postMessage({ type: 'error', data: err });
    }
  }
});
