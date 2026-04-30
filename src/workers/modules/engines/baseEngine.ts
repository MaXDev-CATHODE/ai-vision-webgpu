export interface DetectionResult {
    label: string;
    score: number;
    box: {
        xmin: number;
        ymin: number;
        xmax: number;
        ymax: number;
    };
}

export interface IAIEngine {
    loadModel(modelId: string, progress_callback?: (progress: any) => void): Promise<void>;
    detect(image: any, threshold: number): Promise<DetectionResult[]>;
    dispose(): Promise<void>;
}
