export class AIWorkerManager {
  private static aiWorker: Worker | null = null;
  private static scannerWorker: Worker | null = null;
  
  static getAIWorker(): Worker {
    if (!this.aiWorker) {
      // Używamy standardowego importu dla Vite, aby poprawnie obsłużył ścieżki na produkcji
      this.aiWorker = new Worker(new URL('../workers/ai.worker.v3.ts', import.meta.url), { type: 'module' });
    }
    return this.aiWorker;
  }
  
  static getScannerWorker(): Worker {
    if (!this.scannerWorker) {
      this.scannerWorker = new Worker(new URL('../workers/scanner.worker.ts', import.meta.url), { type: 'module' });
    }
    return this.scannerWorker;
  }
  
  static preloadModels() {
    const ai = this.getAIWorker();
    ai.postMessage({ type: 'init', payload: { modelId: 'yolov11' } });
    
    const scanner = this.getScannerWorker();
    scanner.postMessage({ type: 'init' });
  }
}
