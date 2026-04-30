import React from 'react';
import { useVisionStore } from '../store/useVisionStore';

export const StatsOverlay: React.FC = () => {
  const fps = useVisionStore((state) => state.fps);
  const latency = useVisionStore((state) => state.latency);
  const detectedCount = useVisionStore((state) => state.detectedCount);
  const inferenceTime = useVisionStore((state) => state.inferenceTime);
  const status = useVisionStore((state) => state.status);
  const isCameraActive = useVisionStore((state) => state.isCameraActive);
  const isHUDOnly = useVisionStore((state) => state.isHUDOnly);

  if (!isCameraActive) return null;

  const getLatencyColor = (ms: number) => {
    if (ms < 100) return 'text-emerald-400';
    if (ms < 500) return 'text-amber-400';
    return 'text-rose-400';
  };

  const getFPSColor = (val: number) => {
    if (val >= 15) return 'text-emerald-400';
    if (val >= 5) return 'text-amber-400';
    return 'text-rose-400';
  };

  // Compact HUD mode
  if (isHUDOnly) {
    return (
      <div className="absolute top-4 left-4 z-50 pointer-events-none flex flex-col gap-1">
        <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg px-3 py-2 flex items-center gap-4 text-[10px] font-mono font-bold">
           <div className="flex gap-1.5 items-center">
             <span className="text-white/40 uppercase">FPS</span>
             <span className={getFPSColor(fps)}>{fps}</span>
           </div>
           <div className="w-[1px] h-3 bg-white/10" />
           <div className="flex gap-1.5 items-center">
             <span className="text-white/40 uppercase">LAT</span>
             <span className={getLatencyColor(latency)}>{latency}ms</span>
           </div>
           <div className="w-[1px] h-3 bg-white/10" />
           <div className="flex gap-1.5 items-center">
             <span className="text-white/40 uppercase">OBJ</span>
             <span className="text-sky-400">{detectedCount}</span>
           </div>
           {inferenceTime > 0 && (
             <>
               <div className="w-[1px] h-3 bg-white/10" />
               <div className="flex gap-1.5 items-center">
                 <span className="text-white/40 uppercase text-fuchsia-400">GPU</span>
                 <span className="text-fuchsia-300">{inferenceTime.toFixed(1)}ms</span>
               </div>
             </>
           )}
        </div>
        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-rose-500/10 border border-rose-500/20 rounded-md w-fit">
          <div className="w-1 h-1 bg-rose-500 rounded-full animate-pulse" />
          <span className="text-[8px] uppercase tracking-tighter font-bold text-rose-400/80">LIVE</span>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-50 pointer-events-none flex flex-col gap-2 scale-90 sm:scale-100 origin-top-left">
      {/* Panel HUD */}
      <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-3 sm:p-4 shadow-2xl flex flex-col gap-2 sm:gap-3 min-w-[140px] sm:min-w-[160px]">
        
        {/* FPS Counter */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-white/50 font-bold">Inference FPS</span>
          <span className={`text-base sm:text-lg font-mono font-bold tabular-nums ${getFPSColor(fps)}`}>
            {fps}
          </span>
        </div>

        {/* Latency */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-white/50 font-bold">Latency</span>
          <span className={`text-xs sm:text-sm font-mono font-bold tabular-nums ${getLatencyColor(latency)}`}>
            {latency}<span className="text-[9px] ml-0.5 opacity-70">ms</span>
          </span>
        </div>

        <div className="h-[1px] bg-white/5 w-full" />

        {/* Object Count */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-white/50 font-bold">Objects</span>
          <span className="text-xs sm:text-sm font-mono font-bold text-sky-400 tabular-nums">
            {detectedCount}
          </span>
        </div>

        {/* System Status */}
        <div className="mt-1">
           <div className={`text-[8px] uppercase tracking-[0.2em] font-black ${status === 'error' ? 'text-rose-500' : 'text-blue-400 opacity-80'}`}>
              {status === 'loading' ? 'Initializing...' : status.toUpperCase()}
           </div>
        </div>
      </div>

      {/* Pulsing "Live" Indicator */}
      <div className="flex items-center gap-2 px-3 py-1 bg-rose-500/20 border border-rose-500/30 rounded-full w-fit">
        <div className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
        <span className="text-[9px] uppercase tracking-widest font-black text-rose-400">WebGPU Live</span>
      </div>
    </div>
  );
};

