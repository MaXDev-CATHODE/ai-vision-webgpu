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
  const setMetrics = useVisionStore((state) => state.setMetrics);

  const lastDetectionTimeRef = useRef<number>(0);
  const frameStartTimeRef = useRef<number>(0);

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
        const now = performance.now();
        const latency = Math.round(now - frameStartTimeRef.current);
        const fps = lastDetectionTimeRef.current 
          ? Math.round(1000 / (now - lastDetectionTimeRef.current)) 
          : 0;

        setMetrics({
          latency,
          fps,
          detectedCount: data.length
        });

        lastDetectionTimeRef.current = now;
        setDetections(data);
        isProcessingRef.current = false;
      }
      
      if (type === 'error') {
        console.error('Błąd silnika AI:', data);
        setStatus('error');
        setProgress(0, 'Wystąpił błąd podczas ładowania modelu.');
        isProcessingRef.current = false; // Resetujemy blokadę nawet przy błędzie
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
        // OPTYMALIZACJA: ImageBitmap zamiast Base64
        // Tworzymy binarną kopię klatki w mniejszej rozdzielczości (640px)
        const MAX_SIZE = 640;
        const scale = Math.min(1, MAX_SIZE / Math.max(videoElement.videoWidth, videoElement.videoHeight));
        const width = videoElement.videoWidth * scale;
        const height = videoElement.videoHeight * scale;

        isProcessingRef.current = true;
        
        createImageBitmap(videoElement, {
          resizeWidth: width,
          resizeHeight: height,
          resizeQuality: 'low'
        }).then(bitmap => {
          if (workerRef.current) {
            frameStartTimeRef.current = performance.now();
            workerRef.current.postMessage({
              type: 'detect',
              data: { image: bitmap, threshold: confidenceThreshold }
            }, [bitmap]); // Przeniesienie własności (Transferable) - zero kopiowania w RAM!
          } else {
            isProcessingRef.current = false;
          }
        }).catch(() => {
          isProcessingRef.current = false;
        });
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

    // Obliczanie realnej powierzchni wideo (uwzględniając object-fit: contain)
    const vWidth = videoElement.videoWidth;
    const vHeight = videoElement.videoHeight;
    const cWidth = canvas.width;
    const cHeight = canvas.height;

    const vRatio = vWidth / vHeight;
    const cRatio = cWidth / cHeight;

    let drawWidth, drawHeight, offsetX, offsetY;

    if (cRatio > vRatio) {
      // Kontener jest szerszy niż wideo (paski po bokach)
      drawHeight = cHeight;
      drawWidth = cHeight * vRatio;
      offsetX = (cWidth - drawWidth) / 2;
      offsetY = 0;
    } else {
      // Kontener jest wyższy niż wideo (paski góra/dół)
      drawWidth = cWidth;
      drawHeight = cWidth / vRatio;
      offsetX = 0;
      offsetY = (cHeight - drawHeight) / 2;
    }

    // Pomocnicza funkcja do generowania koloru na podstawie nazwy klasy
    const getColor = (label: string) => {
      let hash = 0;
      for (let i = 0; i < label.length; i++) {
        hash = label.charCodeAt(i) + ((hash << 5) - hash);
      }
      const h = Math.abs(hash % 360);
      return `hsl(${h}, 70%, 50%)`; // Żywe kolory HSL
    };

    // Tablica do śledzenia zajętych obszarów przez etykiety (collision detection)
    const occupiedRects: { x: number, y: number, w: number, h: number }[] = [];

    // Rysowanie wyników AI
    detections.forEach(det => {
      const color = getColor(det.label);
      
      // Skalowanie koordynatów
      const x = det.box.xmin * drawWidth + offsetX;
      const y = det.box.ymin * drawHeight + offsetY;
      const w = (det.box.xmax - det.box.xmin) * drawWidth;
      const h = (det.box.ymax - det.box.ymin) * drawHeight;

      // --- PREMIUM VISUALS: Neon Box ---
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      
      // Glow effect
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      
      // Rysujemy tylko narożniki dla futurystycznego wyglądu (HUD style)
      const cornerLen = Math.min(w, h, 20);
      
      // Top-Left
      ctx.beginPath();
      ctx.moveTo(x, y + cornerLen);
      ctx.lineTo(x, y);
      ctx.lineTo(x + cornerLen, y);
      ctx.stroke();
      
      // Top-Right
      ctx.beginPath();
      ctx.moveTo(x + w - cornerLen, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + cornerLen);
      ctx.stroke();
      
      // Bottom-Right
      ctx.beginPath();
      ctx.moveTo(x + w, y + h - cornerLen);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x + w - cornerLen, y + h);
      ctx.stroke();
      
      // Bottom-Left
      ctx.beginPath();
      ctx.moveTo(x + cornerLen, y + h);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x, y + h - cornerLen);
      ctx.stroke();

      // Cienka ramka łącząca (półprzezroczysta)
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.2;
      ctx.strokeRect(x, y, w, h);
      ctx.globalAlpha = 1.0;

      // Przygotowanie etykiety
      const labelText = `${det.label} ${Math.round(det.score * 100)}%`;
      ctx.font = 'bold 11px "Outfit", system-ui, sans-serif';
      const metrics = ctx.measureText(labelText);
      const textWidth = metrics.width;
      const labelHeight = 20;
      const padding = 10;
      const fullWidth = textWidth + padding * 2;
      
      let labelX = x;
      let labelY = y - labelHeight - 4;
      if (labelY < 0) labelY = y + 4;

      // Unikanie kolizji
      let attempts = 0;
      while (attempts < 5) {
        const collision = occupiedRects.some(r => {
          return !(labelX + fullWidth < r.x || labelX > r.x + r.w || labelY + labelHeight < r.y || labelY > r.y + r.h);
        });
        if (collision) {
          labelY += labelHeight + 4;
          attempts++;
        } else break;
      }
      occupiedRects.push({ x: labelX, y: labelY, w: fullWidth, h: labelHeight });

      // Szklana etykieta (Glassmorphism)
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.beginPath();
      ctx.roundRect(labelX, labelY, fullWidth, labelHeight, 4);
      ctx.fill();
      
      // Akcent boczny koloru
      ctx.fillStyle = color;
      ctx.fillRect(labelX, labelY, 3, labelHeight);
      
      // Tekst
      ctx.fillStyle = '#ffffff';
      ctx.fillText(labelText.toUpperCase(), labelX + padding + 2, labelY + 14);
    });

  }, [detections, videoElement, isCameraActive]);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute top-0 left-0 w-full h-full pointer-events-none"
    />
  );
};
