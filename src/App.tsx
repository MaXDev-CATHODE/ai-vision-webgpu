import { CameraFeed } from './components/CameraFeed';
import { ControlPanel } from './components/ControlPanel';
import { useVisionStore } from './store/useVisionStore';

function App() {
  const toggleCamera = useVisionStore((state) => state.toggleCamera);
  const isCameraActive = useVisionStore((state) => state.isCameraActive);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 flex flex-col items-center justify-center p-4 md:p-8">
      {/* Header */}
      <div className="w-full max-w-5xl mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500">
            Real-Time AI Vision
          </h1>
          <p className="text-slate-400 text-sm mt-1">100% Client-Side WebGPU Inference</p>
        </div>
        
        <button 
          onClick={toggleCamera}
          className={`px-6 py-2.5 rounded-full font-medium transition-all duration-300 shadow-lg border ${
            isCameraActive 
              ? 'bg-rose-500/20 text-rose-400 border-rose-500/30 hover:bg-rose-500/30' 
              : 'bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30'
          }`}
        >
          {isCameraActive ? 'Wyłącz Kamerę' : 'Uruchom Kamerę'}
        </button>
      </div>

      {/* Main Content Area */}
      <div className="w-full max-w-5xl flex-1 flex flex-col gap-6 relative">
        {/* Camera Container */}
        <div className="relative w-full aspect-video md:aspect-[21/9] rounded-2xl overflow-hidden shadow-2xl border border-slate-700/50 bg-black">
          <CameraFeed />
        </div>
        
        <ControlPanel />
        
        {/* Features / Status */}
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
      </div>
    </div>
  );
}

export default App;
