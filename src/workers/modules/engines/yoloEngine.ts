import * as ort from 'onnxruntime-web';
import { RawImage } from '@huggingface/transformers';
import type { IAIEngine, DetectionResult } from './baseEngine';

// Konfiguracja ONNX Runtime dla WebGPU
ort.env.wasm.numThreads = 1;

export class YoloEngine implements IAIEngine {
    private session: ort.InferenceSession | null = null;

    async loadModel(modelId: string, progress_callback?: (progress: any) => void): Promise<void> {
        try {
            console.log(`[YoloEngine] Inicjalizacja silnika ONNX (manualny pre-proc) dla ${modelId}...`);

            const baseUrl = (import.meta as any).env.BASE_URL || '/';
            const modelUrl = `${self.location.origin}${baseUrl}models/yolov11/onnx/model.onnx`;

            console.log(`[YoloEngine] Pobieranie modelu z: ${modelUrl}`);

            // Symulacja progressu dla UI
            if (progress_callback) progress_callback({ 
                status: 'progress', 
                progress: { progress: 50, file: 'model.onnx' } 
            });

            this.session = await ort.InferenceSession.create(modelUrl, {
                executionProviders: ['webgpu'],
            });

            if (progress_callback) progress_callback({ 
                status: 'progress', 
                progress: { progress: 100, file: 'model.onnx' } 
            });

            console.log(`[YoloEngine] Silnik ONNX gotowy (WebGPU).`);
        } catch (error: any) {
            console.error(`[YoloEngine] Błąd ładowania ONNX:`, error);
            throw error;
        }
    }

    async detect(image: any, threshold: number): Promise<DetectionResult[]> {
        if (!this.session) return [];

        // 1. Manualny Preprocessing
        // Transformers.js RawImage jest świetny do odczytu różnych formatów
        const rawImage = await RawImage.read(image);
        
        // Skalowanie do 640x640
        const resized = await rawImage.resize(640, 640);
        
        // Dane są w formacie HWC (RGBA lub RGB)
        // YOLO potrzebuje CHW (RGB)
        const { data } = resized; // data to Uint8ClampedArray [640*640*3]
        
        const floatData = new Float32Array(3 * 640 * 640);
        for (let i = 0; i < 640 * 640; i++) {
            floatData[i] = data[i * 3] / 255.0;           // R
            floatData[i + 640 * 640] = data[i * 3 + 1] / 255.0; // G
            floatData[i + 2 * 640 * 640] = data[i * 3 + 2] / 255.0; // B
        }

        const inputTensor = new ort.Tensor('float32', floatData, [1, 3, 640, 640]);

        // 2. Inferencja
        const feeds: Record<string, ort.Tensor> = {};
        feeds[this.session.inputNames[0]] = inputTensor;
        
        const outputs = await this.session.run(feeds);
        const outputTensor = outputs[this.session.outputNames[0]];
        
        // 3. Post-processing (YOLOv11: [1, 84, 8400])
        return this.postProcess(outputTensor, threshold / 100);
    }

    private postProcess(output: ort.Tensor, threshold: number): DetectionResult[] {
        const data = output.data as Float32Array;
        const dims = output.dims; // [1, 84, 8400]
        const numAnchors = dims[2];
        
        const results: DetectionResult[] = [];

        for (let i = 0; i < numAnchors; i++) {
            // Szukamy najwyższego wyniku klasy
            let maxScore = -1;
            let classId = -1;

            // Klasy zaczynają się od indeksu 4 (0,1,2,3 to boxy)
            for (let c = 0; c < 80; c++) {
                const score = data[numAnchors * (c + 4) + i];
                if (score > maxScore) {
                    maxScore = score;
                    classId = c;
                }
            }

            if (maxScore > threshold) {
                const cx = data[i];
                const cy = data[numAnchors + i];
                const w = data[numAnchors * 2 + i];
                const h = data[numAnchors * 3 + i];

                const x1 = (cx - w / 2) / 640;
                const y1 = (cy - h / 2) / 640;
                const x2 = (cx + w / 2) / 640;
                const y2 = (cy + h / 2) / 640;

                results.push({
                    label: this.getClassLabel(classId),
                    score: maxScore,
                    box: { xmin: x1, ymin: y1, xmax: x2, ymax: y2 }
                });
            }
        }

        return this.nms(results, 0.45);
    }

    private nms(detections: DetectionResult[], iouThreshold: number): DetectionResult[] {
        detections.sort((a, b) => b.score - a.score);
        const result: DetectionResult[] = [];
        const seen = new Set<number>();

        // Optymalizacja: ograniczamy liczbę detekcji przed NMS
        const topDetections = detections.slice(0, 300);

        for (let i = 0; i < topDetections.length; i++) {
            if (seen.has(i)) continue;

            result.push(topDetections[i]);
            for (let j = i + 1; j < topDetections.length; j++) {
                if (seen.has(j)) continue;

                if (this.calculateIoU(topDetections[i].box, topDetections[j].box) > iouThreshold) {
                    seen.add(j);
                }
            }
        }

        return result;
    }

    private calculateIoU(box1: any, box2: any): number {
        const x1 = Math.max(box1.xmin, box2.xmin);
        const y1 = Math.max(box1.ymin, box2.ymin);
        const x2 = Math.min(box1.xmax, box2.xmax);
        const y2 = Math.min(box1.ymax, box2.ymax);

        const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
        const area1 = (box1.xmax - box1.xmin) * (box1.ymax - box1.ymin);
        const area2 = (box2.xmax - box2.xmin) * (box2.ymax - box2.ymin);
        const union = area1 + area2 - intersection;

        return intersection / union;
    }

    private getClassLabel(id: number): string {
        const labels = ["person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat", "traffic light", "fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat", "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe", "backpack", "umbrella", "handbag", "tie", "suitcase", "frisbee", "skis", "snowboard", "sports ball", "kite", "baseball bat", "baseball glove", "skateboard", "surfboard", "tennis racket", "bottle", "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana", "apple", "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair", "couch", "potted plant", "bed", "dining table", "toilet", "tv", "laptop", "mouse", "remote", "keyboard", "cell phone", "microwave", "oven", "toaster", "sink", "refrigerator", "book", "clock", "vase", "scissors", "teddy bear", "hair drier", "toothbrush"];
        return labels[id] || `class_${id}`;
    }

    async dispose(): Promise<void> {
        this.session = null;
    }
}
