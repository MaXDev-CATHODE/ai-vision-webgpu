// Utility for QR and Barcode scanning
export const isBarcodeDetectorSupported = () => 'BarcodeDetector' in globalThis;

export interface ScanResult {
  rawValue: string;
  format: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  cornerPoints: { x: number; y: number }[];
}

export async function detectCodes(image: ImageBitmap, mode: 'qr' | 'barcode'): Promise<ScanResult[]> {
  if (!isBarcodeDetectorSupported()) {
    throw new Error('BarcodeDetector API is not supported in this browser.');
  }

  // Specyfikacja formatów w zależności od trybu
  const formats = mode === 'qr' 
    ? ['qr_code'] 
    : ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'data_matrix'];

  try {
    // @ts-ignore - BarcodeDetector might not be in types yet
    const detector = new BarcodeDetector({ formats });
    const detections = await detector.detect(image);

    return detections.map((det: any) => ({
      rawValue: det.rawValue,
      format: det.format,
      boundingBox: {
        x: det.boundingBox.x,
        y: det.boundingBox.y,
        width: det.boundingBox.width,
        height: det.boundingBox.height
      },
      cornerPoints: det.cornerPoints
    }));
  } catch (err) {
    console.error('Błąd detekcji kodów:', err);
    return [];
  }
}
