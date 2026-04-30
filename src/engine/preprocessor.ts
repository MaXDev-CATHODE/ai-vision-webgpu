import { RawImage } from '@huggingface/transformers';

/**
 * Narzędzia do przygotowania obrazu wejściowego
 */
export class ImagePreprocessor {
  /**
   * Konwertuje HTMLImageElement lub HTMLVideoElement na RawImage o konkretnym rozmiarze
   */
  public static async prepare(
    source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
    targetSize: { width: number; height: number } = { width: 640, height: 640 }
  ): Promise<RawImage> {
    const canvas = new OffscreenCanvas(targetSize.width, targetSize.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');

    // Zachowanie proporcji (letterbox) lub proste rozciągnięcie (YOLO zazwyczaj używa rozciągnięcia lub letterbox)
    // Tutaj stosujemy proste rozciągnięcie dla uproszczenia, Transformers.js pipeline i tak to znormalizuje
    ctx.drawImage(source, 0, 0, targetSize.width, targetSize.height);

    const imageData = ctx.getImageData(0, 0, targetSize.width, targetSize.height);
    return new RawImage(imageData.data, targetSize.width, targetSize.height, 4);
  }

  /**
   * Pomocnicza funkcja do pobierania klatki z wideo
   */
  public static captureFrame(video: HTMLVideoElement): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
    }
    return canvas;
  }
}
