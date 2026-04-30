import { pipeline, env, RawImage } from '@huggingface/transformers';

/**
 * Konfiguracja środowiska Transformers.js
 */
env.allowLocalModels = true;
env.allowRemoteModels = true;
env.useBrowserCache = true;

// Opcjonalnie: ścieżka do lokalnych modeli
// env.localModelPath = '/models/';

export type DetectionResult = {
  label: string;
  score: number;
  box: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
  };
};

export class AIEngine {
  private static instance: AIEngine | null = null;
  private detector: any = null;
  private isInitializing: boolean = false;

  private constructor() {}

  public static getInstance(): AIEngine {
    if (!AIEngine.instance) {
      AIEngine.instance = new AIEngine();
    }
    return AIEngine.instance;
  }

  /**
   * Inicjalizacja modelu z preferencją dla WebGPU
   */
  public async init(
    modelId: string = 'onnx-community/yolov11n',
    progressCallback?: (progress: any) => void
  ): Promise<void> {
    if (this.detector || this.isInitializing) return;

    this.isInitializing = true;
    console.log(`[AIEngine] Initializing model: ${modelId}`);

    try {
      // Próba inicjalizacji z WebGPU
      this.detector = await pipeline('object-detection', modelId, {
        device: 'webgpu',
        dtype: 'fp16', // Optymalizacja pod GPU mobilne
        progress_callback: progressCallback,
      });
      console.log('[AIEngine] WebGPU initialization successful');
    } catch (gpuError) {
      console.warn('[AIEngine] WebGPU failed, falling back to WASM:', gpuError);
      try {
        // Fallback na WASM
        this.detector = await pipeline('object-detection', modelId, {
          device: 'wasm',
          progress_callback: progressCallback,
        });
        console.log('[AIEngine] WASM fallback successful');
      } catch (wasmError) {
        this.isInitializing = false;
        console.error('[AIEngine] Critical failure: All backends failed', wasmError);
        throw wasmError;
      }
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Wykonanie detekcji na obrazie
   */
  public async detect(
    image: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | RawImage,
    threshold: number = 0.25
  ): Promise<DetectionResult[]> {
    if (!this.detector) {
      throw new Error('AIEngine not initialized. Call init() first.');
    }

    const results = await this.detector(image, {
      threshold,
      percentage: true,
    });

    return results as DetectionResult[];
  }

  /**
   * Sprawdza czy WebGPU jest dostępne w przeglądarce
   */
  public static async isWebGPUSupported(): Promise<boolean> {
    if (!('gpu' in navigator)) return false;
    try {
      const adapter = await (navigator as any).gpu.requestAdapter();
      return !!adapter;
    } catch {
      return false;
    }
  }
}
