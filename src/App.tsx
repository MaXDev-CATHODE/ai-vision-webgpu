import { useEffect } from 'react';
import { CameraFeed } from './components/CameraFeed';
import { ControlPanel } from './components/ControlPanel';
import { StatsOverlay } from './components/StatsOverlay';
import { useVisionStore } from './store/useVisionStore';
import { AIWorkerManager } from './utils/aiWorkerManager';

function App() {
  const setStatus = useVisionStore((state) => state.setStatus);
  const setProgress = useVisionStore((state) => state.setProgress);

  useEffect(() => {
    // T004: Asynchroniczne pobieranie wag od razu po załadowaniu głównego komponentu
    AIWorkerManager.preloadModels();

    // Nasłuchuj od razu na wiadomości workera (nie czekaj na montaż OverlayCanvas!)
    const aiWorker = AIWorkerManager.getAIWorker();

    const handleMessage = (e: MessageEvent) => {
      const { status, progress, message, error } = e.data;
      
      if (status === 'log') {
        console.log(`[WorkerLog] ${message}`);
        return;
      }

      if (status === 'progress') {
        setStatus('loading');
        // Transformers.js v3 format: { status: 'progress', progress: 50 }
        // Our worker format for manual progress: { status: 'progress', progress: { progress: 50, file: '...' } }
        const p = progress?.progress !== undefined ? progress.progress : (typeof progress === 'number' ? progress : 0);
        const file = progress?.file || 'model';
        setProgress(p, `Pobieranie: ${file}...`);
      }

      if (status === 'ready') {
        const { features, device } = e.data;
        console.log(`AI Engine: READY (${features} features on ${device})`);
        setStatus(`GOTOWY (${features} cech, ${device})`);
        setProgress(100, 'Model AI gotowy');
      }

      if (status === 'error') {
        console.error('AI Engine Error:', error);
        setStatus('error', String(error));
      }
    };

    aiWorker.addEventListener('message', handleMessage);
    return () => aiWorker.removeEventListener('message', handleMessage);
  }, [setStatus, setProgress]);

  const toggleCamera = useVisionStore((state) => state.toggleCamera);
  const isCameraActive = useVisionStore((state) => state.isCameraActive);
  const isFullscreen = useVisionStore((state) => state.isFullscreen);
  const toggleFullscreen = useVisionStore((state) => state.toggleFullscreen);

  // Natywne Fullscreen API (dla mobilnych)
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isFullscreen) {
        // Jeśli wyszliśmy z fullscreena przyciskiem systemowym (ESC / Back)
        useVisionStore.setState({ isFullscreen: false });
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    if (isFullscreen) {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
          console.warn('Błąd Fullscreen API:', err);
        });
      }
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    }

    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [isFullscreen]);

  const toggleCamera = useVisionStore((state) => state.toggleCamera);
  const isCameraActive = useVisionStore((state) => state.isCameraActive);
  const isFullscreen = useVisionStore((state) => state.isFullscreen);
  const toggleFullscreen = useVisionStore((state) => state.toggleFullscreen);

  return (
    <div className={`min-h-screen bg-slate-900 text-slate-50 flex flex-col items-center p-4 md:p-8 ${isFullscreen ? 'p-0 overflow-hidden' : 'justify-center'}`}>
      {/* Header - Hidden in fullscreen */}
      {!isFullscreen && (
        <div className="w-full max-w-5xl mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500">
              Real-Time AI Vision
            </h1>
            <p className="text-slate-400 text-sm mt-1">100% Client-Side WebGPU Inference</p>
          </div>
          
          <button 
            onClick={toggleCamera}
            className={`w-full sm:w-auto px-6 py-2.5 rounded-full font-medium transition-all duration-300 shadow-lg border ${
              isCameraActive 
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/30 hover:bg-rose-500/30' 
                : 'bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30'
            }`}
          >
            {isCameraActive ? 'Wyłącz Kamerę' : 'Uruchom Kamerę'}
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className={`w-full max-w-5xl flex-1 flex flex-col gap-6 relative ${isFullscreen ? 'max-w-none h-screen' : ''}`}>
        {/* Floating controls for Fullscreen */}
        {isFullscreen && (
          <div className="fixed top-4 right-4 z-[110] flex gap-2">
            <button 
              onClick={toggleCamera}
              className="px-4 py-2 bg-black/50 backdrop-blur-md border border-white/20 rounded-full text-xs font-bold text-white hover:bg-black/70"
            >
              {isCameraActive ? 'WYŁĄCZ' : 'WŁĄCZ'}
            </button>
            <button 
              onClick={toggleFullscreen}
              className="px-4 py-2 bg-blue-600/80 backdrop-blur-md border border-blue-400/30 rounded-full text-xs font-bold text-white hover:bg-blue-600"
            >
              ZAMKNIJ PEŁNY EKRAN
            </button>
          </div>
        )}
        
        {/* Camera Container */}
        <div className={`relative w-full rounded-2xl overflow-hidden shadow-2xl border border-slate-700/50 bg-black transition-all duration-500 ${
          isFullscreen 
            ? 'fixed inset-0 z-[100] rounded-none border-none h-screen' 
            : 'aspect-video md:aspect-[21/9]'
        }`}>
          <CameraFeed />
          <StatsOverlay />
        </div>
        
        {!isFullscreen && <ControlPanel />}
        
        {/* Features / Status - Hidden in fullscreen */}
        {!isFullscreen && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="glass p-5 rounded-2xl">
              <h3 className="font-semibold text-slate-200 mb-1">0 Server Cost</h3>
              <p className="text-sm text-slate-400">Model jest pobierany i odpalany na Twojej karcie graficznej.</p>
            </div>
            <div className="glass p-5 rounded-2xl">
              <h3 className="font-semibold text-slate-200 mb-1">Prywatność 100%</h3>
              <p className="text-sm text-slate-400">Żadne klatki z kamery nie opuszczają Twojej przeglądarki.</p>
            </div>
            <div className="glass p-5 rounded-2xl">
              <h3 className="font-semibold text-slate-200 mb-1">WebGPU / WebGL</h3>
              <p className="text-sm text-slate-400">Akceleracja sprzętowa używająca Transformers.js.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


export default App;
