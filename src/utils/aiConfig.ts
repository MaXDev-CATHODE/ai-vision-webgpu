export const AI_CONFIG = {
  // Model YOLOv8n (architektura YOLOS) - lokalny
  model: 'yolov8n', 
  model_file: 'model.onnx',
  baseUrl: import.meta.env.DEV ? '/' : import.meta.env.BASE_URL,
  threshold: 0.45,
  task: 'object-detection',
  minConfidenceThreshold: 0.40,
  inputResolution: 640,
  showStatsOnError: true,
};
