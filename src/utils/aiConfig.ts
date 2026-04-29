export const AI_CONFIG = {
  // Przejście z powolnego i nieprecyzyjnego yolos-tiny na szybki i dokładny yolov8n
  model: 'onnx-community/yolov8n',
  task: 'object-detection',
  // Ustawienie minimalnego threshold, by wyeliminować halucynacje
  minConfidenceThreshold: 0.60,
  // Zoptymalizowany rozmiar wejściowy pod model YOLOv8n (zazwyczaj 640, ale dla przeglądarki 320 jest OK dla szybkości)
  inputResolution: 320,
};
