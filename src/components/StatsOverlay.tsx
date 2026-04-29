import React from 'react';
import { useVisionStore } from '../store/useVisionStore';

export const StatsOverlay: React.FC = () => {
  const fps = useVisionStore((state) => state.fps);
  const latency = useVisionStore((state) => state.latency);
  const detectedCount = useVisionStore((state) => state.detectedCount);
  const status = useVisionStore((state) => state.status);
  const isCameraActive = useVisionStore((state) => state.isCameraActive);

  if (status !== 'ready' || !isCameraActive) return null;

  const getLatencyColor = (ms: number) => {
    if (ms < 50) return 'text-emerald-400';
    if (ms < 150) return 'text-amber-400';
    return 'text-rose-400';
  };

  const getFPSColor = (val: number) => {
    if (val >= 24) return 'text-emerald-400';
    if (val >= 10) return 'text-amber-400';
    return 'text-rose-400';
  };

  return (
    <div className="absolute top-6 left-6 z-50 pointer-events-none flex flex-col gap-2">
      {/* Panel HUD */}
      <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-2xl flex flex-col gap-3 min-w-[160px]">
        
        {/* FPS Counter */}
        <div className="flex items-center justify-between gap-4">
          <span className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Inference FPS</span>
          <span className={`text-lg font-mono font-bold tabular-nums ${getFPSColor(fps)}`}>
            {fps}
          </span>
        </div>

        {/* Latency */}
        <div className="flex items-center justify-between gap-4">
          <span className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Latency</span>
          <span className={`text-sm font-mono font-bold tabular-nums ${getLatencyColor(latency)}`}>
            {latency}<span className="text-[10px] ml-0.5 opacity-70">ms</span>
          </span>
        </div>

        <div className="h-[1px] bg-white/5 w-full" />

        {/* Object Count */}
        <div className="flex items-center justify-between gap-4">
          <span className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Objects</span>
          <span className="text-sm font-mono font-bold text-sky-400 tabular-nums">
            {detectedCount}
          </span>
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
