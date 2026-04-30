import { useEffect, useRef } from 'react';
import { useVisionStore } from '../store/useVisionStore';
import { AIWorkerManager } from '../utils/aiWorkerManager';

/**
 * Hook zarządzający pętlą detekcji obiektów
 */
export const useDetection = (videoElement: HTMLVideoElement | null) => {
  const isProcessingRef = useRef(false);
  const frameStartTimeRef = useRef<number>(0);
  const lastDetectionTimeRef = useRef<number>(0);

  const isCameraActive = useVisionStore((state) => state.isCameraActive);
  const mode = useVisionStore((state) => state.mode);
  const confidenceThreshold = useVisionStore((state) => state.confidenceThreshold);
  const setMetrics = useVisionStore((state) => state.setMetrics);
  const setStatus = useVisionStore((state) => state.setStatus);
  const setProgress = useVisionStore((state) => state.setProgress);
  const setDetections = useVisionStore((state) => state.setDetections);
  const setScanResults = useVisionStore((state) => state.setScanResults);
  
  useEffect(() => {
    const aiWorker = AIWorkerManager.getAIWorker();
    const scannerWorker = AIWorkerManager.getScannerWorker();

    const handleMessage = (e: MessageEvent) => {
      const { status, type, output, data, metrics, error } = e.data;
      const messageType = status || type;
      const messageData = output || data;

      if (messageType === 'result' || messageType === 'scan_result' || messageType === 'error' || status === 'error') {
        isProcessingRef.current = false;
      }

      if (status === 'progress') {
        setStatus('loading');
      }

      if (status === 'ready') {
        setStatus('ready');
        setProgress(100, 'Silnik AI gotowy');
      }

      if (messageType === 'result' || messageType === 'scan_result') {
        const now = performance.now();
        const latency = Math.round(now - frameStartTimeRef.current);
        const fps = lastDetectionTimeRef.current ? Math.round(1000 / (now - lastDetectionTimeRef.current)) : 0;
        
        setMetrics({
          latency,
          fps,
          detectedCount: messageData.length,
          inferenceTime: metrics?.inferenceTime || 0
        });

        if (mode === 'ai') {
          setDetections(messageData);
        } else {
          setScanResults(messageData);
        }
        
        lastDetectionTimeRef.current = now;
      }

      if (status === 'error' || messageType === 'error') {
        console.error('[Detection Hook] Error:', error || data);
        setStatus('error', String(error || data));
      }
    };

    aiWorker.addEventListener('message', handleMessage);
    scannerWorker.addEventListener('message', handleMessage);

    return () => {
      aiWorker.removeEventListener('message', handleMessage);
      scannerWorker.removeEventListener('message', handleMessage);
    };
  }, [setStatus, setProgress, setMetrics]);

  useEffect(() => {
    let animationFrameId: number;

    const processFrame = () => {
      if (!isCameraActive || !videoElement || isProcessingRef.current || videoElement.readyState < 2) {
        animationFrameId = requestAnimationFrame(processFrame);
        return;
      }

      const activeWorker = mode === 'ai' ? AIWorkerManager.getAIWorker() : AIWorkerManager.getScannerWorker();
      
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
        frameStartTimeRef.current = performance.now();
        if (mode === 'ai') {
          activeWorker.postMessage({
            action: 'detect',
            image: bitmap, 
            threshold: confidenceThreshold
          }, [bitmap]);
        } else {
          activeWorker.postMessage({
            type: 'scan',
            data: { image: bitmap, mode: mode }
          }, [bitmap]);
        }
      }).catch(() => {
        isProcessingRef.current = false;
      });

      animationFrameId = requestAnimationFrame(processFrame);
    };

    processFrame();

    return () => cancelAnimationFrame(animationFrameId);
  }, [videoElement, isCameraActive, confidenceThreshold, mode]);
};
