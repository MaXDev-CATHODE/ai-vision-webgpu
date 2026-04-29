import { detectCodes } from '../utils/scannerUtils';

// Scanner Worker for QR and Barcode detection
self.addEventListener('message', async (event) => {
  const { type, data } = event.data;

  if (type === 'init') {
    self.postMessage({ type: 'ready' });
  }

  if (type === 'scan') {
    const { image, mode } = data;
    try {
      const results = await detectCodes(image, mode);
      self.postMessage({ type: 'scan_result', data: results });
    } catch (err) {
      self.postMessage({ type: 'error', data: String(err) });
    } finally {
      // Bardzo ważne: zwalniamy bitmapę w workerze
      if (image instanceof ImageBitmap) {
        image.close();
      }
    }
  }
});
