import * as ort from 'onnxruntime-web';
import { RawImage } from '@huggingface/transformers';
import type { IAIEngine, DetectionResult } from './baseEngine';

// Konfiguracja ONNX Runtime dla WebGPU
ort.env.wasm.numThreads = 1;

export class YoloEngine implements IAIEngine {
    private session: ort.InferenceSession | null = null;

    async loadModel(modelId: string, progress_callback?: (progress: any) => void): Promise<void> {
        try {
            console.log(`[YoloEngine] Inicjalizacja silnika ONNX dla ${modelId}...`);

            const baseUrl = (import.meta as any).env.BASE_URL || '/';
            
            const potentialUrls = [
                `${self.location.origin}${baseUrl}models/yolov11/onnx/model.onnx`.replace(/\/+/g, '/').replace(':/', '://'),
                `${self.location.origin}/models/yolov11/onnx/model.onnx`,
                // Fallback do HuggingFace (stabilność w dev/prod)
                `https://huggingface.co/onnx-community/yolov11n-v2/resolve/main/onnx/model.onnx`,
                `./models/yolov11/onnx/model.onnx`,
                `${baseUrl}models/yolov11/onnx/model.onnx`.replace(/\/+/g, '/')
            ];

            let response: Response | null = null;
            let finalUrl = '';

            for (const url of potentialUrls) {
                try {
                    const fetchOptions: RequestInit = url.includes('huggingface') ? {} : { cache: 'no-cache' };
                    const res = await fetch(url, fetchOptions);
                    
                    if (res.ok) {
                        const contentType = res.headers.get('content-type');
                        if (contentType && contentType.includes('text/html')) continue;
                        response = res;
                        finalUrl = url;
                        break;
                    }
                } catch (e) {
                    console.warn(`[YoloEngine] Błąd fetch dla ${url}:`, e);
                }
            }

            if (!response) throw new Error(`Nie znaleziono modelu.`);
            
            console.log(`[YoloEngine] Sukces! Pobieranie z: ${finalUrl}`);
            const arrayBuffer = await response.arrayBuffer();
            await this.initSession(arrayBuffer, progress_callback);

        } catch (error: any) {
            console.error(`[YoloEngine] Błąd ładowania:`, error);
            throw error;
        }
    }

    private async initSession(arrayBuffer: ArrayBuffer, progress_callback?: (p: any) => void) {
        if (progress_callback) progress_callback({ status: 'progress', progress: { progress: 95, file: 'model.onnx' } });

        this.session = await ort.InferenceSession.create(arrayBuffer, {
            executionProviders: ['webgpu'],
        });

        if (progress_callback) progress_callback({ status: 'progress', progress: { progress: 100, file: 'model.onnx' } });
        console.log(`[YoloEngine] Sesja ONNX gotowa.`);
    }

    async detect(image: any, threshold: number): Promise<DetectionResult[]> {
        if (!this.session) return [];

        try {
            // 1. PREPROCESSING (Letterbox - Zachowanie proporcji)
            // Pobieramy oryginalne wymiary
            let width, height;
            if (image instanceof ImageBitmap) {
                width = image.width;
                height = image.height;
            } else {
                const raw = await RawImage.read(image);
                width = raw.width;
                height = raw.height;
            }

            // Obliczamy skalę (letterbox)
            const scale = Math.min(640 / width, 640 / height);
            const newWidth = Math.round(width * scale);
            const newHeight = Math.round(height * scale);
            const padX = (640 - newWidth) / 2;
            const padY = (640 - newHeight) / 2;

            // Tworzymy czarny canvas 640x640 i rysujemy na nim obraz z zachowaniem proporcji
            const canvas = new OffscreenCanvas(640, 640);
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error("Canvas context failed");
            
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, 640, 640);
            ctx.drawImage(image, padX, padY, newWidth, newHeight);
            
            const imageData = ctx.getImageData(0, 0, 640, 640);
            const { data } = imageData; // RGBA [640*640*4]
            
            // Konwersja do Float32 CHW
            const floatData = new Float32Array(3 * 640 * 640);
            for (let i = 0; i < 640 * 640; i++) {
                floatData[i] = data[i * 4] / 255.0;           // R
                floatData[i + 640 * 640] = data[i * 4 + 1] / 255.0; // G
                floatData[i + 2 * 640 * 640] = data[i * 4 + 2] / 255.0; // B
            }

            const inputTensor = new ort.Tensor('float32', floatData, [1, 3, 640, 640]);
            const feeds: Record<string, ort.Tensor> = {};
            feeds[this.session.inputNames[0]] = inputTensor;
            
            const outputs = await this.session.run(feeds);
            const outputTensor = outputs[this.session.outputNames[0]];
            
            // 2. POST-PROCESSING (Korekta letterbox)
            return this.postProcess(outputTensor, threshold / 100, padX, padY);
        } catch (error: any) {
            console.error(`[YoloEngine] Błąd inferencji:`, error);
            return [];
        }
    }

    private postProcess(output: ort.Tensor, threshold: number, padX: number, padY: number): DetectionResult[] {
        const data = output.data as Float32Array;
        const numAnchors = output.dims[2];
        const results: DetectionResult[] = [];

        for (let i = 0; i < numAnchors; i++) {
            let maxScore = -1;
            let classId = -1;
            for (let c = 0; c < 80; c++) {
                const score = data[numAnchors * (c + 4) + i];
                if (score > maxScore) {
                    maxScore = score;
                    classId = c;
                }
            }

            if (maxScore > threshold) {
                // Współrzędne w układzie 640x640 (z letterboxem)
                const cx = data[i];
                const cy = data[numAnchors + i];
                const w = data[numAnchors * 2 + i];
                const h = data[numAnchors * 3 + i];

                // Korekta letterboxu (powrót do proporcji oryginalnego obrazu 0-1)
                // 1. Odejmujemy pad
                // 2. Dzielimy przez skalę (aby wrócić do wymiarów wejściowych)
                // 3. Dzielimy przez oryginalne wymiary (czyli x / width_orig)
                // UWAGA: Prościej jest: ((val - pad) / scale) / original_dim
                // Ale ponieważ finalnie chcemy 0-1 względem oryginalnego obrazu, to:
                // (val - pad) / (640 - 2*pad) jest błędne. Poprawne: (val - pad) / newWidth
                
                const newWidth = 640 - 2 * padX;
                const newHeight = 640 - 2 * padY;

                const x1 = (cx - w / 2 - padX) / newWidth;
                const y1 = (cy - h / 2 - padY) / newHeight;
                const x2 = (cx + w / 2 - padX) / newWidth;
                const y2 = (cy + h / 2 - padY) / newHeight;

                // Ograniczenie do zakresu 0-1 (clip)
                results.push({
                    label: this.getClassLabel(classId),
                    score: maxScore,
                    box: { 
                        xmin: Math.max(0, Math.min(1, x1)), 
                        ymin: Math.max(0, Math.min(1, y1)), 
                        xmax: Math.max(0, Math.min(1, x2)), 
                        ymax: Math.max(0, Math.min(1, y2)) 
                    }
                });
            }
        }
        return this.nms(results, 0.45);
    }

    private nms(detections: DetectionResult[], iouThreshold: number): DetectionResult[] {
        detections.sort((a, b) => b.score - a.score);
        const result: DetectionResult[] = [];
        const seen = new Set<number>();
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
