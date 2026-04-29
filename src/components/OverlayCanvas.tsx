import React, { useEffect, useRef, useState } from 'react';
import { useVisionStore } from '../store/useVisionStore';
import { AIWorkerManager } from '../utils/aiWorkerManager';

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
  const aiWorkerRef = useRef<Worker | null>(null);
  const scannerWorkerRef = useRef<Worker | null>(null);
  const isProcessingRef = useRef(false);
  
  const [detections, setDetections] = useState<Detection[]>([]);
  
  const setStatus = useVisionStore((state) => state.setStatus);
  const setProgress = useVisionStore((state) => state.setProgress);
  const isCameraActive = useVisionStore((state) => state.isCameraActive);
  const confidenceThreshold = useVisionStore((state) => state.confidenceThreshold);
  const setMetrics = useVisionStore((state) => state.setMetrics);
  const mode = useVisionStore((state) => state.mode);
  const setScanResults = useVisionStore((state) => state.setScanResults);

  const lastDetectionTimeRef = useRef<number>(0);
  const frameStartTimeRef = useRef<number>(0);

  // Inicjalizacja Workerów
  useEffect(() => {
    // Worker AI z manadżera (pre-loaded)
    const aiWorker = AIWorkerManager.getAIWorker();
    aiWorkerRef.current = aiWorker;

    // Worker Skanera z manadżera (pre-loaded)
    const scannerWorker = AIWorkerManager.getScannerWorker();
    scannerWorkerRef.current = scannerWorker;

    const handleAIWorkerMessage = (e: MessageEvent) => {
      const { type, data } = e.data;
      
      // Zawsze zwalniamy blokadę przy wynikach/błędach, niezależnie od trybu
      if (type === 'detect_result' || type === 'error') {
        isProcessingRef.current = false;
      }

      if (type === 'progress') {
        setStatus('loading');
        if (data.status === 'downloading' || data.status === 'progress') {
          setProgress(data.progress || 0, `Pobieranie: ${data.file || 'model'}...`);
        } else if (data.status === 'done') {
          setProgress(100, `Zakończono pobieranie ${data.file}`);
        }
      }

      if (type === 'ready') {
        setStatus('ready');
        setProgress(100, 'Model AI gotowy');
      }

      // Przetwarzaj wyniki TYLKO jeśli jesteśmy w odpowiednim trybie
      if (type === 'detect_result' && mode === 'ai') {
        handleResult(data);
      }
      
      if (type === 'error' && mode === 'ai') {
        handleError(data);
      }
    };

    const handleScannerWorkerMessage = (e: MessageEvent) => {
      const { type, data } = e.data;
      
      if (type === 'scan_result' || type === 'error') {
        isProcessingRef.current = false;
      }

      if (type === 'ready') {
        setStatus('ready');
      }

      if (type === 'scan_result' && mode !== 'ai') {
        handleResult(data);
      }

      if (type === 'error' && mode !== 'ai') {
        handleError(data);
      }
    };

    const handleResult = (data: any) => {
      const now = performance.now();
      const latency = Math.round(now - frameStartTimeRef.current);
      const fps = lastDetectionTimeRef.current ? Math.round(1000 / (now - lastDetectionTimeRef.current)) : 0;

      setMetrics({ latency, fps, detectedCount: data.length });
      lastDetectionTimeRef.current = now;

      if (mode === 'ai') {
        setDetections(data);
      } else {
        setScanResults(data);
      }
    };

    const handleError = (err: any) => {
      console.error('Błąd workera:', err);
      setStatus('error', String(err));
    };

    // Nasłuchuj tylko na eventy
    aiWorker.addEventListener('message', handleAIWorkerMessage);
    scannerWorker.addEventListener('message', handleScannerWorkerMessage);

    // Czyszczenie samych listenerów, NIE terminowanie workerów!
    return () => {
      aiWorker.removeEventListener('message', handleAIWorkerMessage);
      scannerWorker.removeEventListener('message', handleScannerWorkerMessage);
    };
  }, [setStatus, setProgress, mode, setMetrics, setScanResults]);

  // Reset flagi przy zmianie trybu, aby uniknąć blokady
  useEffect(() => {
    isProcessingRef.current = false;
  }, [mode]);

  // Pętla Przechwytywania Klatek (Frame Capture Loop)
  useEffect(() => {
    let animationFrameId: number;

    const processFrame = () => {
      if (!isCameraActive) {
        setDetections([]);
        return;
      }

      const activeWorker = mode === 'ai' ? aiWorkerRef.current : scannerWorkerRef.current;

      if (videoElement && activeWorker && !isProcessingRef.current && videoElement.readyState === 4) {
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
          if (activeWorker) {
            frameStartTimeRef.current = performance.now();
            if (mode === 'ai') {
              activeWorker.postMessage({
                type: 'detect',
                data: { image: bitmap, threshold: confidenceThreshold }
              }, [bitmap]);
            } else {
              activeWorker.postMessage({
                type: 'scan',
                data: { image: bitmap, mode: mode }
              }, [bitmap]);
            }
          } else {
            isProcessingRef.current = false;
          }
        }).catch(() => {
          isProcessingRef.current = false;
        });
      }

      animationFrameId = requestAnimationFrame(processFrame);
    };

    processFrame();

    return () => cancelAnimationFrame(animationFrameId);
  }, [videoElement, isCameraActive, confidenceThreshold, mode]);

  // Renderowanie Ramek na Canvasie
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !videoElement) return;

    canvas.width = videoElement.clientWidth;
    canvas.height = videoElement.clientHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!isCameraActive) return;

    const vWidth = videoElement.videoWidth;
    const vHeight = videoElement.videoHeight;
    const cWidth = canvas.width;
    const cHeight = canvas.height;

    const vRatio = vWidth / vHeight;
    const cRatio = cWidth / cHeight;

    let drawWidth, drawHeight, offsetX, offsetY;

    if (cRatio > vRatio) {
      drawHeight = cHeight;
      drawWidth = cHeight * vRatio;
      offsetX = (cWidth - drawWidth) / 2;
      offsetY = 0;
    } else {
      drawWidth = cWidth;
      drawHeight = cWidth / vRatio;
      offsetX = 0;
      offsetY = (cHeight - drawHeight) / 2;
    }

    const getColor = (label: string) => {
      let hash = 0;
      for (let i = 0; i < label.length; i++) {
        hash = label.charCodeAt(i) + ((hash << 5) - hash);
      }
      const h = Math.abs(hash % 360);
      return `hsl(${h}, 70%, 50%)`;
    };

    const occupiedRects: { x: number, y: number, w: number, h: number }[] = [];

    if (mode === 'ai') {
      detections.forEach(det => {
        const color = getColor(det.label);
        const x = det.box.xmin * drawWidth + offsetX;
        const y = det.box.ymin * drawHeight + offsetY;
        const w = (det.box.xmax - det.box.xmin) * drawWidth;
        const h = (det.box.ymax - det.box.ymin) * drawHeight;

        drawHUDBox(ctx, x, y, w, h, color, `${det.label} ${Math.round(det.score * 100)}%`, occupiedRects);
      });
    } else {
      const scanResults = useVisionStore.getState().scanResults;
      scanResults.forEach(res => {
        const color = mode === 'qr' ? '#22c55e' : '#f59e0b';
        const inputScaleX = drawWidth / videoElement.videoWidth;
        const inputScaleY = drawHeight / videoElement.videoHeight;

        const x = res.boundingBox.x * inputScaleX + offsetX;
        const y = res.boundingBox.y * inputScaleY + offsetY;
        const w = res.boundingBox.width * inputScaleX;
        const h = res.boundingBox.height * inputScaleY;

        drawHUDBox(ctx, x, y, w, h, color, `${res.format.toUpperCase()}: ${res.rawValue}`, occupiedRects);
      });
    }

  }, [detections, videoElement, isCameraActive, mode]);

  const drawHUDBox = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, labelText: string, occupiedRects: any[]) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    
    const cornerLen = Math.min(w, h, 20);
    
    // Narożniki
    ctx.beginPath();
    ctx.moveTo(x, y + cornerLen); ctx.lineTo(x, y); ctx.lineTo(x + cornerLen, y);
    ctx.moveTo(x + w - cornerLen, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + cornerLen);
    ctx.moveTo(x + w, y + h - cornerLen); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - cornerLen, y + h);
    ctx.moveTo(x + cornerLen, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - cornerLen);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.2;
    ctx.strokeRect(x, y, w, h);
    ctx.globalAlpha = 1.0;

    ctx.font = 'bold 11px "Outfit", system-ui, sans-serif';
    const metrics = ctx.measureText(labelText);
    const textWidth = metrics.width;
    const labelHeight = 20;
    const padding = 10;
    const fullWidth = textWidth + padding * 2;
    
    let labelX = x;
    let labelY = y - labelHeight - 4;
    if (labelY < 0) labelY = y + 4;

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

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    ctx.roundRect(labelX, labelY, fullWidth, labelHeight, 4);
    ctx.fill();
    
    ctx.fillStyle = color;
    ctx.fillRect(labelX, labelY, 3, labelHeight);
    
    ctx.fillStyle = '#ffffff';
    ctx.fillText(labelText, labelX + padding + 2, labelY + 14);
  };

  return (
    <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" />
  );
};
