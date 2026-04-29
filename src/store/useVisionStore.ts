import { create } from 'zustand';

type ModelStatus = 'idle' | 'loading' | 'ready' | 'error';

interface VisionState {
  // Stan Modelu
  status: ModelStatus;
  progress: number;
  loadingMessage: string;
  
  // Stan Kamery/Wejścia
  isCameraActive: boolean;
  confidenceThreshold: number;
  
  // Akcje
  setStatus: (status: ModelStatus) => void;
  setProgress: (progress: number, message?: string) => void;
  toggleCamera: () => void;
  setConfidenceThreshold: (threshold: number) => void;
}

export const useVisionStore = create<VisionState>((set) => ({
  status: 'idle',
  progress: 0,
  loadingMessage: '',
  
  isCameraActive: false,
  confidenceThreshold: 0.5, // 50%
  
  setStatus: (status) => set({ status }),
  setProgress: (progress, loadingMessage = '') => set({ progress, loadingMessage }),
  toggleCamera: () => set((state) => ({ isCameraActive: !state.isCameraActive })),
  setConfidenceThreshold: (confidenceThreshold) => set({ confidenceThreshold })
}));
