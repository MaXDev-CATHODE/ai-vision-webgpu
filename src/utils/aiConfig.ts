export const AI_CONFIG = {
  // Przełączenie na model YOLOv10n (zgodny z Transformers.js v3)
  model: 'yolov10n',
  task: 'object-detection',
  // Podniesiony threshold dla lepszej stabilności detekcji
  minConfidenceThreshold: 0.40,
  // YOLOv10n natywnie operuje na 640x640, co daje najlepszą dokładność
  inputResolution: 640,
  // Pokaż HUD nawet przy błędzie, by ułatwić debugowanie ścieżek modelu
  showStatsOnError: true,
};
