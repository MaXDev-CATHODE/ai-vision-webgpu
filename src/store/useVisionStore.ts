import { create } from 'zustand';

export type VisionMode = 'ai' | 'qr' | 'barcode';

export interface ScanResult {
  rawValue: string;
  format: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  cornerPoints: { x: number; y: number }[];
}

interface VisionState {
  // Stan Modelu
  status: ModelStatus;
  progress: number;
  loadingMessage: string;
  errorMessage: string | null;
  
  // Stan Kamery/Wejścia
  isCameraActive: boolean;
  confidenceThreshold: number;
  isFullscreen: boolean;
  isHUDOnly: boolean;
  mode: VisionMode;
  scanResults: ScanResult[];
  
  // Metryki Wydajności
  fps: number;
  latency: number;
  detectedCount: number;
  
  // Akcje
  setStatus: (status: ModelStatus, errorMessage?: string | null) => void;
  setProgress: (progress: number, message?: string) => void;
  toggleCamera: () => void;
  setConfidenceThreshold: (threshold: number) => void;
  setMetrics: (metrics: { fps?: number; latency?: number; detectedCount?: number }) => void;
  toggleFullscreen: () => void;
  setHUDOnly: (val: boolean) => void;
  setMode: (mode: VisionMode) => void;
  setScanResults: (results: ScanResult[]) => void;
}

type ModelStatus = 'idle' | 'loading' | 'ready' | 'error';

export const useVisionStore = create<VisionState>((set) => ({
  status: 'idle',
  progress: 0,
  loadingMessage: '',
  errorMessage: null,
  
  isCameraActive: false,
  confidenceThreshold: 0.7,
  isFullscreen: false,
  isHUDOnly: false,
  mode: 'ai',
  scanResults: [],
  
  fps: 0,
  latency: 0,
  detectedCount: 0,
  
  setStatus: (status, errorMessage = null) => set({ status, errorMessage }),
  setProgress: (progress, loadingMessage = '') => set({ progress, loadingMessage }),

  toggleCamera: () => set((state) => ({ isCameraActive: !state.isCameraActive })),
  setConfidenceThreshold: (confidenceThreshold) => set({ confidenceThreshold }),
  setMetrics: (metrics) => set((state) => ({ ...state, ...metrics })),
  toggleFullscreen: () => set((state) => ({ isFullscreen: !state.isFullscreen })),
  setHUDOnly: (isHUDOnly) => set({ isHUDOnly }),
  setMode: (mode) => set({ mode, scanResults: [] }),
  setScanResults: (scanResults) => set({ scanResults, detectedCount: scanResults.length })
}));

