import React from 'react';
import { useVisionStore } from '../store/useVisionStore';
import { BrainCircuit, Cpu, Settings2, Loader2, AlertCircle } from 'lucide-react';

export const ControlPanel: React.FC = () => {
  const status = useVisionStore((state) => state.status);
  const progress = useVisionStore((state) => state.progress);
  const message = useVisionStore((state) => state.loadingMessage);
  const errorMessage = useVisionStore((state) => state.errorMessage);
  const confidenceThreshold = useVisionStore((state) => state.confidenceThreshold);
  const setConfidenceThreshold = useVisionStore((state) => state.setConfidenceThreshold);

  return (
    <div className="w-full glass rounded-2xl p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <BrainCircuit className="text-blue-400" />
          Silnik Inferencji (AI)
        </h2>
        {/* Status Badge */}
        <div className="flex items-center gap-2">
          {status === 'idle' && <span className="px-3 py-1 bg-slate-700/50 text-slate-300 rounded-full text-xs font-mono border border-slate-600">INICJALIZACJA</span>}
          {status === 'loading' && <span className="px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full text-xs font-mono border border-amber-500/30 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> POBIERANIE MODELU</span>}
          {status === 'ready' && <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-xs font-mono border border-emerald-500/30 flex items-center gap-1"><Cpu size={12} /> GOTOWY (WEBGPU)</span>}
          {status === 'error' && <span className="px-3 py-1 bg-rose-500/20 text-rose-300 rounded-full text-xs font-mono border border-rose-500/30 flex items-center gap-1"><AlertCircle size={12} /> BŁĄD</span>}
        </div>
      </div>

      {/* Error Message */}
      {status === 'error' && errorMessage && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start gap-2 text-rose-400">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase">Szczegóły błędu:</p>
              <p className="text-[11px] font-mono break-all">{errorMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Progress Bar (Visible only when loading) */}

      {status === 'loading' && (
        <div className="w-full space-y-2 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex justify-between text-xs text-slate-400 font-mono">
            <span>{message || 'Pobieranie wag sieci neuronowej...'}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[10px] text-amber-500/70 mt-1">
            Pierwsze uruchomienie wymaga pobrania ok. 40MB danych modelu z CDN. Zostaną one zapisane w pamięci podręcznej przeglądarki na zawsze.
          </p>
        </div>
      )}

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
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
            Filtruje obiekty, których AI nie jest w 100% pewne. Ustaw niżej, jeśli nic nie wykrywa.
          </p>
        </div>
      </div>
    </div>
  );
};
