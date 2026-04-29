# 🤖 Real-Time AI Vision & Universal Scanner (Serverless WebGPU)

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen.svg)](https://maxdev-cathode.github.io/ai-vision-webgpu/)
[![GitHub license](https://img.shields.io/github/license/MaXDev-CATHODE/ai-vision-webgpu)](https://github.com/MaXDev-CATHODE/ai-vision-webgpu/blob/main/LICENSE)
[![Vite](https://img.shields.io/badge/Vite-B73BFE?logo=vite&logoColor=FFD62D)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://react.dev/)

Eksperymentalna aplikacja typu **Universal Vision Suite**, która demonstruje potęgę nowoczesnych przeglądarek. Łączy w sobie zaawansowaną detekcję obiektów przez **WebGPU** oraz błyskawiczne skanowanie kodów QR i kreskowych przy użyciu natywnych API systemu.

> **Zero kosztów serwera. Zero przesyłania obrazu do chmury. 100% Prywatności.**

---

## 🚀 Kluczowe Funkcje

### 🧠 Moduł AI Vision
- **Detekcja w czasie rzeczywistym:** Wykrywanie ponad 80 klas obiektów (ludzie, telefony, laptopy, zwierzęta) na żywo z kamery.
- **WebGPU Acceleration:** Bezpośrednie wykorzystanie mocy karty graficznej (GPU) dla błyskawicznych obliczeń sieci neuronowych.
- **Serverless Inference:** Wykorzystanie modelu `yolos-tiny` uruchamianego lokalnie przez Transformers.js.

### 🔍 Moduł Universal Scanner
- **Skaner QR & Barcode:** Obsługa najpopularniejszych formatów (QR, EAN-13, Code 128, UPC).
- **Native Speed:** Wykorzystanie **BarcodeDetector API** (Shape Detection API) dla natychmiastowej reakcji bez narzutu bibliotek zewnętrznych.
- **Smart Actions:** Automatyczne wykrywanie linków URL, funkcja kopiowania do schowka i interaktywny HUD.

---

## 🛠 Stos Technologiczny

- **Core:** React 19 + TypeScript + Vite
- **AI Engine:** [Transformers.js](https://huggingface.co/docs/transformers.js) (Hugging Face) + WebGPU
- **Native Vision:** BarcodeDetector API (Shape Detection API)
- **Stylizacja:** Tailwind CSS v4 + Glassmorphism Design
- **Ikonografia:** Lucide React
- **State Management:** Zustand
- **Multithreading:** Podwójna izolacja Web Worker (osobne wątki dla AI i Skanera)

---

## 📦 Architektura Systemu

Aplikacja wykorzystuje hybrydowe podejście do przetwarzania wizyjnego:

1. **AI Worker:** Zarządza cyklem życia modelu ONNX, pobieraniem wag i procesem inferencji WebGPU.
2. **Scanner Worker:** Lekki wątek obsługujący natywne API detekcji kształtów, zapewniający 60 FPS podczas skanowania.
3. **Zero-Copy Pipeline:** Przesyłanie obrazu z kamery jako surowej bitmapy (`ImageBitmap`) z flagą `Transferable`, co eliminuje opóźnienia związane z kopiowaniem pamięci.
4. **Collision-Aware HUD:** Inteligentny system renderowania etykiet na Canvasie, który zapobiega nakładaniu się tekstów przy wielu wykrytych obiektach.

---

## 🚦 Instalacja Lokalna

```bash
# Sklonuj repozytorium
git clone https://github.com/MaXDev-CATHODE/ai-vision-webgpu.git

# Wejdź do folderu
cd ai-vision-webgpu

# Zainstaluj zależności
npm install

# Uruchom serwer deweloperski
npm run dev
```

---

## 📄 Licencja

Projekt udostępniony na licencji MIT. Możesz go dowolnie modyfikować i używać w celach edukacyjnych lub komercyjnych.

---

### Autor

**MaXDev-CATHODE** - [GitHub](https://github.com/MaXDev-CATHODE)
