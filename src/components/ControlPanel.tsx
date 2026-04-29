import React from 'react';
import { useVisionStore } from '../store/useVisionStore';
import { BrainCircuit, Cpu, Settings2, Loader2, AlertCircle, QrCode, Barcode, Scan } from 'lucide-react';

export const ControlPanel: React.FC = () => {
  const status = useVisionStore((state) => state.status);
  const progress = useVisionStore((state) => state.progress);
  const message = useVisionStore((state) => state.loadingMessage);
  const errorMessage = useVisionStore((state) => state.errorMessage);
  const confidenceThreshold = useVisionStore((state) => state.confidenceThreshold);
  const setConfidenceThreshold = useVisionStore((state) => state.setConfidenceThreshold);
  const isHUDOnly = useVisionStore((state) => state.isHUDOnly);
  const setHUDOnly = useVisionStore((state) => state.setHUDOnly);
  const toggleFullscreen = useVisionStore((state) => state.toggleFullscreen);
  const mode = useVisionStore((state) => state.mode);
  const setMode = useVisionStore((state) => state.setMode);

  return (
    <div className="w-full glass rounded-2xl p-6 flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-white/10 pb-4 gap-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <BrainCircuit className="text-blue-400" />
          Silnik Inferencji (AI)
        </h2>
        {/* Status Badge */}
        <div className="flex items-center gap-2">
          {status === 'idle' && <span className="px-3 py-1 bg-slate-700/50 text-slate-300 rounded-full text-xs font-mono border border-slate-600">INICJALIZACJA</span>}
          {status === 'loading' && <span className="px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full text-xs font-mono border border-amber-500/30 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> ŁADOWANIE LOKALNE</span>}
          {status === 'ready' && <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-xs font-mono border border-emerald-500/30 flex items-center gap-1"><Cpu size={12} /> GOTOWY (LOKALNY + WEBGPU)</span>}
          {status === 'error' && <span className="px-3 py-1 bg-rose-500/20 text-rose-300 rounded-full text-xs font-mono border border-rose-500/30 flex items-center gap-1"><AlertCircle size={12} /> BŁĄD MODELU</span>}
        </div>
      </div>

      {/* Error Message */}
      {status === 'error' && errorMessage && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start gap-2 text-rose-400">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase text-rose-500">Wymagana Akcja (Błąd ładowania):</p>
              <p className="text-[11px] font-mono break-words leading-relaxed">
                Upewnij się, że plik <b>model.onnx</b> znajduje się w folderze:<br/>
                <code className="bg-rose-500/10 px-1 py-0.5 rounded">public/models/yolov8n/onnx/</code>
              </p>
              <p className="text-[10px] opacity-70 italic mt-1">
                Szczegóły: {errorMessage}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Progress Bar (Visible only when loading) */}

      {status === 'loading' && (
        <div className="w-full space-y-2 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex justify-between text-xs text-slate-400 font-mono">
            <span>{message || 'Wczytywanie lokalnych wag sieci neuronowej...'}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[10px] text-blue-400/70 mt-1">
            Model jest ładowany z Twojego dysku (folder public/models/). To zapewnia 100% prywatności i niezawodności.
          </p>
        </div>
      )}

      {/* Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-2">
        {/* Detection Threshold */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
            <Settings2 size={16} className="text-slate-400" />
            Czułość Detekcji (Threshold)
          </label>
          <div className="flex items-center gap-4">
            <input 
              type="range" 
              min="10" 
              max="90" 
              step="5"
              value={confidenceThreshold * 100} 
              onChange={(e) => setConfidenceThreshold(parseInt(e.target.value) / 100)}
              className="flex-1 accent-blue-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-sm font-mono w-12 text-right text-blue-400 bg-blue-500/10 px-2 py-1 rounded">
              {Math.round(confidenceThreshold * 100)}%
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Zwiększ, aby wyeliminować błędy. Zmniejsz, jeśli AI nic nie wykrywa.
          </p>
        </div>

        {/* Mode Selector */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
            <Scan size={16} className="text-slate-400" />
            Tryb Pracy
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'ai', label: 'AI VISION', icon: BrainCircuit },
              { id: 'qr', label: 'SKANER QR', icon: QrCode },
              { id: 'barcode', label: 'BARCODE', icon: Barcode },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id as any)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold transition-all border ${
                  mode === m.id 
                  ? 'bg-blue-500/20 border-blue-500/50 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.2)]' 
                  : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/60'
                }`}
              >
                <m.icon size={14} />
                {m.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            Przełącz silnik przetwarzania obrazu.
          </p>
        </div>

        {/* View Options */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
            <Settings2 size={16} className="text-slate-400" />
            Opcje Widoku
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setHUDOnly(!isHUDOnly)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                isHUDOnly 
                ? 'bg-blue-500/20 border-blue-500/50 text-blue-300' 
                : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
              }`}
            >
              TRYB HUD
            </button>
            <button
              onClick={toggleFullscreen}
              className="px-4 py-2 rounded-xl text-xs font-bold transition-all border bg-white/5 border-white/10 text-white/50 hover:bg-white/10"
            >
              PEŁNY EKRAN
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Tryb HUD minimalizuje panel statystyk, aby nie zasłaniał obrazu.
          </p>
        </div>
      </div>
    </div>
  );
};

