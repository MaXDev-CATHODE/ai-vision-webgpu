# 🤖 Real-Time AI Vision (Serverless WebGPU)

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen.svg)](https://maxdev-cathode.github.io/ai-vision-webgpu/)
[![GitHub license](https://img.shields.io/github/license/MaXDev-CATHODE/ai-vision-webgpu)](https://github.com/MaXDev-CATHODE/ai-vision-webgpu/blob/main/LICENSE)
[![Vite](https://img.shields.io/badge/Vite-B73BFE?logo=vite&logoColor=FFD62D)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://react.dev/)

Eksperymentalna aplikacja typu **Serverless AI**, która demonstruje potęgę nowoczesnych przeglądarek. Wykorzystuje **WebGPU** oraz bibliotekę **Transformers.js** do uruchamiania zaawansowanych sieci neuronowych (Object Detection) w 100% po stronie klienta.

> **Zero kosztów serwera. Zero przesyłania obrazu do chmury. 100% Prywatności.**

---

## 🚀 Kluczowe Funkcje

- **Detekcja w czasie rzeczywistym:** Wykrywanie ponad 80 klas obiektów (ludzie, telefony, laptopy, zwierzęta) na żywo z kamery.
- **WebGPU Inference:** Najwyższa wydajność dzięki bezpośredniemu dostępowi do rdzeni GPU użytkownika.
- **Bezpieczeństwo:** Przetwarzanie obrazu odbywa się lokalnie — klatki z kamery nigdy nie opuszczają Twojej przeglądarki.
- **Progressive Model Loading:** Model AI (ok. 40MB) jest pobierany asynchronicznie i zapisywany w cache (IndexedDB) dla błyskawicznego startu przy kolejnych wizytach.
- **Web Worker Isolation:** Cała ciężka praca matematyczna AI odbywa się w osobnym wątku, dzięki czemu interfejs użytkownika pozostaje idealnie płynny (60 FPS).

---

## 🛠 Stos Technologiczny

- **Core:** React 19 + TypeScript + Vite
- **AI Engine:** [Transformers.js](https://huggingface.co/docs/transformers.js) (Hugging Face)
- **Model:** `Xenova/detr-resnet-50` (ONNX Quantized)
- **Stylizacja:** Tailwind CSS v4 + Glassmorphism Design
- **State Management:** Zustand
- **Deployment:** GitHub Pages

---

## 📦 Jak to działa?

1. **Inicjalizacja:** Aplikacja ładuje statyczne pliki z GitHub Pages.
2. **Setup Workera:** Tworzony jest `Web Worker`, który asynchronicznie pobiera i kompiluje model sieci neuronowej.
3. **Stream:** Po wyrażeniu zgody, strumień wideo z kamery jest przechwytywany i wysyłany klatka po klatce do Workera.
4. **Inferencja:** Silnik AI (Transformers.js) analizuje piksele, używając WebGPU lub WebGL, i zwraca współrzędne wykrytych obiektów.
5. **Render:** Wyniki są nakładane na przezroczysty `Canvas`, tworząc interaktywny interfejs w stylu "Heads-Up Display" (HUD).

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
