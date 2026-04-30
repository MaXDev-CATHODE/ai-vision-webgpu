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
                `https://huggingface.co/onnx-community/yolov11n-v2/resolve/main/onnx/model.onnx`,
                `./models/yolov11/onnx/model.onnx`
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
            // 1. PREPROCESSING (Letterbox)
            let width, height;
            if (image && typeof image === 'object' && 'width' in image && 'height' in image) {
                width = image.width;
                height = image.height;
            } else {
                const raw = await RawImage.read(image);
                width = raw.width;
                height = raw.height;
            }

            const scale = Math.min(640 / width, 640 / height);
            const newWidth = Math.round(width * scale);
            const newHeight = Math.round(height * scale);
            const padX = (640 - newWidth) / 2;
            const padY = (640 - newHeight) / 2;

            const canvas = new OffscreenCanvas(640, 640);
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error("Canvas context failed");
            
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, 640, 640);
            ctx.drawImage(image, padX, padY, newWidth, newHeight);
            
            const imageData = ctx.getImageData(0, 0, 640, 640);
            const { data } = imageData; 
            
            const floatData = new Float32Array(3 * 640 * 640);
            for (let i = 0; i < 640 * 640; i++) {
                floatData[i] = data[i * 4] / 255.0;           
                floatData[i + 640 * 640] = data[i * 4 + 1] / 255.0; 
                floatData[i + 2 * 640 * 640] = data[i * 4 + 2] / 255.0; 
            }

            const inputTensor = new ort.Tensor('float32', floatData, [1, 3, 640, 640]);
            const feeds: Record<string, ort.Tensor> = {};
            feeds[this.session.inputNames[0]] = inputTensor;
            
            const outputs = await this.session.run(feeds);
            const outputTensor = outputs[this.session.outputNames[0]];
            
            // 2. POST-PROCESSING (Z ograniczeniem tłumu)
            // threshold z UI jest już w skali 0.0 - 1.0 (np. 0.3 dla 30%)
            const confThreshold = (typeof threshold === 'number' && threshold > 0) ? threshold : 0.3;
            
            return this.postProcess(outputTensor, confThreshold, padX, padY, newWidth, newHeight);
        } catch (error: any) {
            console.error(`[YoloEngine] Błąd inferencji:`, error);
            return [];
        }
    }

    private postProcess(output: ort.Tensor, threshold: number, padX: number, padY: number, newWidth: number, newHeight: number): DetectionResult[] {
        const data = output.data as Float32Array;
        const numAnchors = output.dims[2];
        const results: DetectionResult[] = [];

        // Przeszukujemy wszystkie 8400 anchorów
        for (let i = 0; i < numAnchors; i++) {
            let maxScore = 0;
            let classId = -1;

            // Szukamy najlepszej klasy dla tego anchora
            for (let c = 0; c < 80; c++) {
                const score = data[numAnchors * (c + 4) + i];
                if (score > maxScore) {
                    maxScore = score;
                    classId = c;
                }
            }

            // KRYTYCZNE: Odcinamy słabe detekcje ZANIM wejdą do NMS (oszczędność CPU i czystość)
            if (maxScore > threshold) {
                const cx = data[i];
                const cy = data[numAnchors + i];
                const w = data[numAnchors * 2 + i];
                const h = data[numAnchors * 3 + i];

                // Korekta letterboxu
                const x1 = (cx - w / 2 - padX) / newWidth;
                const y1 = (cy - h / 2 - padY) / newHeight;
                const x2 = (cx + w / 2 - padX) / newWidth;
                const y2 = (cy + h / 2 - padY) / newHeight;

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

        // 3. AGRESYWNY NMS (usuwanie tłumu)
        // Zmniejszamy iouThreshold do 0.4, aby silniej czyścić nakładające się ramki
        return this.nms(results, 0.4);
    }

    private nms(detections: DetectionResult[], iouThreshold: number): DetectionResult[] {
        // Sortujemy od najwyższego score
        detections.sort((a, b) => b.score - a.score);
        
        const result: DetectionResult[] = [];
        const seen = new Set<number>();
        
        // Ograniczamy do max 50 detekcji przed NMS, aby oszczędzić CPU
        const topDetections = detections.slice(0, 100);

        for (let i = 0; i < topDetections.length; i++) {
            if (seen.has(i)) continue;

            result.push(topDetections[i]);
            
            // Jeśli mamy już 15 dobrych detekcji, przerywamy (ograniczenie tłumu w UI)
            if (result.length >= 15) break;

            for (let j = i + 1; j < topDetections.length; j++) {
                if (seen.has(j)) continue;

                // Sprawdzamy czy ramki się nakładają
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
        if (intersection === 0) return 0;

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
