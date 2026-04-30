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

/**
 * Zwraca listę wspieranych formatów przez przeglądarkę
 */
export async function getSupportedFormats(): Promise<string[]> {
  if (!isBarcodeDetectorSupported()) return [];
  // @ts-ignore
  return await BarcodeDetector.getSupportedFormats();
}

export async function detectCodes(image: ImageBitmap, mode: 'qr' | 'barcode'): Promise<ScanResult[]> {
  if (!isBarcodeDetectorSupported()) {
    throw new Error('BarcodeDetector API nie jest wspierany w tej przeglądarce (wymagany Chrome/Android lub Chrome/Mac).');
  }

  // Pobieramy wspierane formaty dla pewności
  const supported = await getSupportedFormats();
  
  // Specyfikacja formatów w zależności od trybu
  let formats: string[] = [];
  if (mode === 'qr') {
    formats = ['qr_code'].filter(f => supported.includes(f));
  } else {
    // Próbujemy włączyć jak najwięcej popularnych formatów barcodów
    const targetFormats = ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'data_matrix', 'itf', 'pdf417'];
    formats = targetFormats.filter(f => supported.includes(f));
  }

  // Jeśli brak wspieranych formatów dla wybranego trybu
  if (formats.length === 0) {
    // Jeśli pusty, spróbujmy bez formatów (automatyczna detekcja wszystkiego co wspiera system)
    formats = supported;
  }

  try {
    // @ts-ignore
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
    throw err; // Rzucamy dalej do workera
  }
}
