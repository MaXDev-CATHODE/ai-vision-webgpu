import React, { useEffect, useRef } from 'react';
import { useVisionStore } from '../store/useVisionStore';
import { useDetection } from '../hooks/useDetection';

interface OverlayCanvasProps {
  videoElement: HTMLVideoElement | null;
}

export const OverlayCanvas: React.FC<OverlayCanvasProps> = ({ videoElement }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detections = useVisionStore((state) => state.detections);
  const scanResults = useVisionStore((state) => state.scanResults);
  const isCameraActive = useVisionStore((state) => state.isCameraActive);
  const mode = useVisionStore((state) => state.mode);

  // Inicjalizacja pętli detekcji przez hook
  useDetection(videoElement);

  // Renderowanie Ramek na Canvasie
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !videoElement) return;

    // Dopasowanie rozmiaru canvasa do elementu wideo na ekranie
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

    let drawWidth: number, drawHeight: number, offsetX: number, offsetY: number;

    // Obliczanie proporcji (letterbox/contain)
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

    if (mode === 'ai' && Array.isArray(detections)) {
      detections.forEach(det => {
        const color = getColor(det.label);
        const x = det.box.xmin * drawWidth + offsetX;
        const y = det.box.ymin * drawHeight + offsetY;
        const w = (det.box.xmax - det.box.xmin) * drawWidth;
        const h = (det.box.ymax - det.box.ymin) * drawHeight;

        drawHUDBox(ctx, x, y, w, h, color, `${det.label} ${Math.round(det.score * 100)}%`, occupiedRects);
      });
    } else {
      scanResults.forEach(res => {
        const color = mode === 'qr' ? '#22c55e' : '#f59e0b';
        const x = res.boundingBox.x * drawWidth + offsetX;
        const y = res.boundingBox.y * drawHeight + offsetY;
        const w = res.boundingBox.width * drawWidth;
        const h = res.boundingBox.height * drawHeight;

        drawHUDBox(ctx, x, y, w, h, color, `${res.format.toUpperCase()}: ${res.rawValue}`, occupiedRects);
      });
    }

  }, [detections, scanResults, videoElement, isCameraActive, mode]);

  const drawHUDBox = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, labelText: string, occupiedRects: any[]) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    
    const cornerLen = Math.min(w, h, 20);
    
    // Narożniki (Styl Cyberpunk/Tech)
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

    // Label Rendering
    ctx.font = 'bold 11px "Outfit", system-ui, sans-serif';
    const metrics = ctx.measureText(labelText);
    const textWidth = metrics.width;
    const labelHeight = 20;
    const padding = 10;
    const fullWidth = textWidth + padding * 2;
    
    let labelX = x;
    let labelY = y - labelHeight - 4;
    if (labelY < 0) labelY = y + 4;

    // Unikanie nakładania się etykiet
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
