import React, { useState, useEffect } from 'react';
import { useVisionStore } from '../store/useVisionStore';
import { Copy, Check, ExternalLink } from 'lucide-react';

export const ResultPanel: React.FC = () => {
  const mode = useVisionStore((state) => state.mode);
  const scanResults = useVisionStore((state) => state.scanResults);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (scanResults.length > 0) {
      setLastResult(scanResults[0].rawValue);
      setCopied(false);
    }
  }, [scanResults]);

  if (mode === 'ai' || !lastResult) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(lastResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isUrl = lastResult.startsWith('http');

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md glass p-4 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300 z-50">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">
            Wykryto {mode === 'qr' ? 'Kod QR' : 'Kod Kreskowy'}
          </p>
          <p className="text-sm font-medium text-white truncate">
            {lastResult}
          </p>
        </div>
        
        <div className="flex gap-2">
          {isUrl && (
            <a
              href={lastResult}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-xl bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
              title="Otwórz link"
            >
              <ExternalLink size={18} />
            </a>
          )}
          <button
            onClick={handleCopy}
            className={`p-2 rounded-xl transition-all ${
              copied 
              ? 'bg-green-500/20 text-green-400' 
              : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
            title="Kopiuj do schowka"
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
};
