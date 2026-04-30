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
      self.postMessage({ type: 'scan_result', data: results });
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
