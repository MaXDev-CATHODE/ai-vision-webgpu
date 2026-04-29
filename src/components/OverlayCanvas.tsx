import React, { useEffect, useRef, useState } from 'react';
import { useVisionStore } from '../store/useVisionStore';

interface Detection {
  label: string;
  score: number;
  box: { xmin: number; ymin: number; xmax: number; ymax: number };
}

interface OverlayCanvasProps {
  videoElement: HTMLVideoElement | null;
}

export const OverlayCanvas: React.FC<OverlayCanvasProps> = ({ videoElement }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const isProcessingRef = useRef(false);
  
  const [detections, setDetections] = useState<Detection[]>([]);
  
  const setStatus = useVisionStore((state) => state.setStatus);
  const setProgress = useVisionStore((state) => state.setProgress);
  const isCameraActive = useVisionStore((state) => state.isCameraActive);
  const confidenceThreshold = useVisionStore((state) => state.confidenceThreshold);

  // Inicjalizacja Workera
  useEffect(() => {
    // Vite pozwala na import workerów z końcówką ?worker
    const worker = new Worker(new URL('../workers/ai.worker.ts', import.meta.url), {
      type: 'module'
    });
    
    workerRef.current = worker;

    worker.onmessage = (e) => {
      const { type, data } = e.data;

      if (type === 'progress') {
        setStatus('loading');
        if (data.status === 'downloading' || data.status === 'progress') {
          // data.progress jest ułamkiem 0-100 dla danego pliku (Transformers.js pobiera model w kawałkach)
          setProgress(data.progress || 0, `Pobieranie: ${data.file || 'model'}...`);
        } else if (data.status === 'done') {
          setProgress(100, `Zakończono pobieranie ${data.file}`);
        }
      }

      if (type === 'ready') {
        setStatus('ready');
        setProgress(100, 'Model gotowy do działania');
      }

      if (type === 'detect_result') {
        setDetections(data);
        isProcessingRef.current = false; // Zwalniamy blokadę dla kolejnej klatki
      }
      
      if (type === 'error') {
        console.error('Błąd silnika AI:', data);
        setStatus('error');
        setProgress(0, 'Wystąpił błąd podczas ładowania modelu.');
      }
    };

    // Zleć załadowanie modelu natychmiast po zamontowaniu
    worker.postMessage({ type: 'load_model' });

    return () => {
      worker.terminate();
    };
  }, [setStatus, setProgress]);

  // Pętla Przechwytywania Klatek (Frame Capture Loop)
  useEffect(() => {
    let animationFrameId: number;

    const processFrame = () => {
      // Jeśli kamera jest wyłączona, upewnijmy się że nie rysujemy starych boxów
      if (!isCameraActive) {
        setDetections([]);
        return;
      }

      // Procesujemy klatkę TYLKO jeśli worker skończył poprzednią, aby zapobiec kolejkowaniu setek klatek (Lag/Freeze)
      if (videoElement && workerRef.current && !isProcessingRef.current && videoElement.readyState === 4) {
        // Aby przesłać obraz do Transformers.js w workerze, tworzymy tymczasowy canvas 
        // i zrzucamy na niego zrzut klatki wideo jako Base64 (lub ImageBitmap).
        const offscreenCanvas = document.createElement('canvas');
        // Zmniejszamy rozdzielczość, by sztuczna inteligencja działała szybciej w przeglądarce
        offscreenCanvas.width = 640; 
        offscreenCanvas.height = Math.floor(640 * (videoElement.videoHeight / videoElement.videoWidth));
        
        const ctx = offscreenCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoElement, 0, 0, offscreenCanvas.width, offscreenCanvas.height);
          const base64Image = offscreenCanvas.toDataURL('image/jpeg', 0.8);
          
          isProcessingRef.current = true; // Blokujemy do czasu otrzymania odpowiedzi z Workera
          
          workerRef.current.postMessage({
            type: 'detect',
            data: { image: base64Image, threshold: confidenceThreshold }
          });
        }
      }

      // Wywołuj się rekurencyjnie co klatkę (zazwyczaj 60 razy na sekundę)
      animationFrameId = requestAnimationFrame(processFrame);
    };

    processFrame();

    return () => cancelAnimationFrame(animationFrameId);
  }, [videoElement, isCameraActive, confidenceThreshold]);

  // Renderowanie Ramek na Canvasie widocznym dla użytkownika
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !videoElement) return;

    // Canvas musi idealnie nałożyć się na tag wideo
    canvas.width = videoElement.clientWidth;
    canvas.height = videoElement.clientHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Czyszczenie poprzedniej klatki
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!isCameraActive) return;

    // Rysowanie wyników AI
    detections.forEach(det => {
      // Transformers.js zwraca % (od 0.0 do 1.0) przy opcji percentage: true
      // Skalujemy je przez realne wymiary widocznego elementu
      const x = det.box.xmin * canvas.width;
      const y = det.box.ymin * canvas.height;
      const w = (det.box.xmax - det.box.xmin) * canvas.width;
      const h = (det.box.ymax - det.box.ymin) * canvas.height;

      // Styl Bounding Boxa
      ctx.strokeStyle = '#3b82f6'; // Tailwind blue-500
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, w, h);

      // Tło dla etykiety (Glassmorphism effect)
      const label = `${det.label} (${Math.round(det.score * 100)}%)`;
      ctx.font = 'bold 16px sans-serif';
      const textWidth = ctx.measureText(label).width;
      
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)'; // slate-900 z przezroczystością
      ctx.fillRect(x, y - 30, textWidth + 16, 30);
      
      // Tekst etykiety
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, x + 8, y - 10);
    });

  }, [detections, videoElement, isCameraActive]);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute top-0 left-0 w-full h-full pointer-events-none"
    />
  );
};
