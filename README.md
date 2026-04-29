# 🤖 Real-Time AI Vision (Serverless WebGPU)

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen.svg)](https://maxdev-cathode.github.io/ai-vision-webgpu/)
[![GitHub license](https://img.shields.io/github/license/MaXDev-CATHODE/ai-vision-webgpu)](https://github.com/MaXDev-CATHODE/ai-vision-webgpu/blob/main/LICENSE)
[![Vite](https://img.shields.io/badge/Vite-B73BFE?logo=vite&logoColor=FFD62D)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://react.dev/)

Eksperymentalna aplikacja typu **Serverless AI**, która demonstruje potęgę nowoczesnych przeglądarek. Wykorzystuje **WebGPU** oraz bibliotekę **Transformers.js** do uruchamiania zaawansowanych sieci neuronowych (Object Detection) w 100% po stronie klienta.

> **Zero kosztów serwera. Zero przesyłania obrazu do chmury. 100% Prywatności.**

---

## 🚀 Kluczowe Funkcje

- **Detekcja w czasie rzeczywistym:** Wykrywanie ponad 80 klas obiektów (ludzie, telefony, laptopy, zwierzęta) na żywo z kamery z ultra-niskim opóźnieniem.
- **YOLOv8 Nano Inference:** Wykorzystanie modelu YOLOv8, światowego lidera prędkości, dla płynności klasy Real-Time.
- **WebGPU Acceleration:** Bezpośrednie wykorzystanie mocy karty graficznej (GPU) dla błyskawicznych obliczeń.
- **Zero-Copy Image Transfer:** Wykorzystanie obiektów `ImageBitmap` oraz `Transferables` do przesyłania obrazu między wątkami bez obciążania pamięci RAM.
- **Bezpieczeństwo:** Przetwarzanie obrazu odbywa się lokalnie — klatki z kamery nigdy nie opuszczają Twojej przeglądarki.
- **Web Worker Isolation:** Cała ciężka praca matematyczna AI odbywa się w osobnym wątku, dzięki czemu interfejs użytkownika pozostaje idealnie płynny.

---

## 🛠 Stos Technologiczny

- **Core:** React 19 + TypeScript + Vite
- **AI Engine:** [Transformers.js](https://huggingface.co/docs/transformers.js) (Hugging Face)
- **Model:** `Xenova/yolos-tiny` (ONNX Quantized)
- **Stylizacja:** Tailwind CSS v4 + Glassmorphism Design
- **State Management:** Zustand
- **Deployment:** GitHub Pages

---

## 📦 Jak to działa?

1. **Inicjalizacja:** Aplikacja ładuje statyczne pliki z GitHub Pages.
2. **Setup Workera:** Tworzony jest `Web Worker`, który asynchronicznie pobiera i kompiluje model YOLOv8.
3. **Stream:** Po wyrażeniu zgody, strumień wideo jest przechwytywany i przesyłany jako surowa bitmapa (`ImageBitmap`) do Workera.
4. **Inferencja:** Silnik AI analizuje klatkę na GPU (WebGPU) i zwraca współrzędne wykrytych obiektów.
5. **Render:** Wyniki (Bounding Boxes) są nakładane na przezroczysty `Canvas` z inteligentnym systemem unikania kolizji etykiet.

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
