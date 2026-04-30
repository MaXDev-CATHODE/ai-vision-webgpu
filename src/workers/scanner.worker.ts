import { detectCodes, isBarcodeDetectorSupported } from '../utils/scannerUtils';

// Scanner Worker for QR and Barcode detection
self.addEventListener('message', async (event) => {
  const { type, data } = event.data;

  if (type === 'init') {
    console.log('[ScannerWorker] Initializing...');
    const supported = isBarcodeDetectorSupported();
    console.log(`[ScannerWorker] BarcodeDetector supported: ${supported}`);
    self.postMessage({ type: 'ready', supported });
  }

  if (type === 'scan') {
    const { image, mode } = data;
    try {
      const results = await detectCodes(image, mode);
      
      // NORMALIZACJA WYNIKÓW (0-1)
      // BarcodeDetector zwraca wyniki w pikselach przekazanego obrazu.
      // Aby OverlayCanvas mógł je poprawnie narysować (niezależnie od rozmiaru bitmapy),
      // musimy je sprowadzić do zakresu 0-1.
      const normalizedResults = results.map(res => {
        const { x, y, width, height } = res.boundingBox;
        return {
          ...res,
          boundingBox: {
            x: x / image.width,
            y: y / image.height,
            width: width / image.width,
            height: height / image.height
          }
        };
      });

      self.postMessage({ type: 'scan_result', data: normalizedResults });
    } catch (err) {
      console.error('[ScannerWorker] Scan error:', err);
      self.postMessage({ type: 'error', data: String(err) });
    } finally {
      // Bardzo ważne: zwalniamy bitmapę w workerze
      if (image instanceof ImageBitmap) {
        image.close();
      }
    }
  }
});
