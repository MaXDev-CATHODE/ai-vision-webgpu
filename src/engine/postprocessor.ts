export const COCO_CLASSES = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat',
  'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat',
  'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack',
  'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball',
  'Kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket',
  'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
  'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake',
  'chair', 'couch', 'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop',
  'mouse', 'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink',
  'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier',
  'toothbrush'
];

export type BoundingBox = {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
};

export type Detection = {
  label: string;
  score: number;
  box: BoundingBox;
};

/**
 * Zoptymalizowany NMS (Non-Maximum Suppression) w TypeScript
 */
export function nonMaximumSuppression(
  detections: Detection[],
  iouThreshold: number = 0.45
): Detection[] {
  if (detections.length === 0) return [];

  // Sortowanie po wyniku pewności
  const sorted = [...detections].sort((a, b) => b.score - a.score);
  const selected: Detection[] = [];
  const active = new Array(sorted.length).fill(true);

  for (let i = 0; i < sorted.length; i++) {
    if (!active[i]) continue;

    selected.push(sorted[i]);

    for (let j = i + 1; j < sorted.length; j++) {
      if (!active[j]) continue;

      if (calculateIoU(sorted[i].box, sorted[j].box) > iouThreshold) {
        active[j] = false;
      }
    }
  }

  return selected;
}

/**
 * Obliczanie IoU (Intersection over Union)
 */
function calculateIoU(box1: BoundingBox, box2: BoundingBox): number {
  const x1 = Math.max(box1.xmin, box2.xmin);
  const y1 = Math.max(box1.ymin, box2.ymin);
  const x2 = Math.min(box1.xmax, box2.xmax);
  const y2 = Math.min(box1.ymax, box2.ymax);

  const intersectionArea = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  
  const area1 = (box1.xmax - box1.xmin) * (box1.ymax - box1.ymin);
  const area2 = (box2.xmax - box2.xmin) * (box2.ymax - box2.ymin);
  
  const unionArea = area1 + area2 - intersectionArea;

  return intersectionArea / unionArea;
}
