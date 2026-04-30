import React, { useRef, useEffect, useState } from 'react';
import { useVisionStore } from '../store/useVisionStore';
import { OverlayCanvas } from './OverlayCanvas';
import { ResultPanel } from './ResultPanel';

interface CameraFeedProps {
  onVideoReady?: (video: HTMLVideoElement) => void;
}

export const CameraFeed: React.FC<CameraFeedProps> = ({ onVideoReady }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const isCameraActive = useVisionStore((state) => state.isCameraActive);
  const toggleCamera = useVisionStore((state) => state.toggleCamera);

  useEffect(() => {
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment', // Prefer back camera on mobile
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = async () => {
            videoRef.current?.play();
            setVideoElement(videoRef.current);
            
            // T005: Próba włączenia ciągłego autofocusa (jeśli wspierany)
            try {
              const track = stream?.getVideoTracks()[0];
              if (track) {
                const capabilities = track.getCapabilities() as any;
                if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
                  await track.applyConstraints({
                    advanced: [{ focusMode: 'continuous' }]
                  } as any);
                  console.log('[Camera] Autofocus: continuous enabled');
                }
              }
            } catch (focusErr) {
              console.warn('[Camera] Autofocus nie jest wspierany:', focusErr);
            }

            if (onVideoReady && videoRef.current) {
              onVideoReady(videoRef.current);
            }
          };
        }
      } catch (err) {
        console.error('Błąd dostępu do kamery:', err);
        // If camera fails, turn it off in state
        if (isCameraActive) {
          toggleCamera();
        }
      }
    };

    if (isCameraActive) {
      startCamera();
    } else {
      setVideoElement(null);
      // Stop all tracks when camera is disabled
      if (videoRef.current && videoRef.current.srcObject) {
        const currentStream = videoRef.current.srcObject as MediaStream;
        currentStream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
    }

    return () => {
      // Cleanup on unmount
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isCameraActive, onVideoReady, toggleCamera]);

  if (!isCameraActive) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-slate-800/50 rounded-2xl border border-slate-700/50 backdrop-blur-sm">
        <div className="text-slate-400 flex flex-col items-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-4 opacity-50"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
          <p>Kamera jest wyłączona</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden bg-black flex items-center justify-center">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-contain"
      />
      <OverlayCanvas videoElement={videoElement} />
      <ResultPanel />
    </div>
  );
};
