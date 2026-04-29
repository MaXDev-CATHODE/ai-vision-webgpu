# Implementation Plan: Real-Time AI Vision (Serverless WebGPU)

**Feature Branch**: `[001-ai-vision-webgpu]`
**Created**: 2026-04-29
**Status**: Draft
**Reference Spec**: [spec.md](./spec.md)

## 1. Cel i Tło
Wdrożenie aplikacji typu SPA (Single Page Application) demonstrującej możliwości detekcji obiektów w czasie rzeczywistym z wykorzystaniem sieci neuronowych działających w 100% po stronie klienta (WebGPU/WASM), z możliwością bezpłatnego hostingu na GitHub Pages.

## 2. Architektura Systemu

### 2.1 Stos Technologiczny
- **Framework UI**: React 19 + TypeScript + Vite.
- **Stylizacja**: Tailwind CSS (motyw Dark/Glassmorphism).
- **Zarządzanie Stanem**: Zustand (przechowywanie konfiguracji kamery, modeli AI i historii detekcji).
- **Inference Engine (AI)**: `Transformers.js` (Hugging Face) uruchamiający modele w formacie ONNX.
- **Renderowanie Wyników**: Canvas API nakładane (overlay) na element `<video>`.
- **Akceleracja**: WebGPU (priorytet) z fallbackiem do WebGL/WASM.

### 2.2 Kluczowe Komponenty

#### A. Wątek Główny (UI & Video Capture)
- `CameraFeed.tsx`: Obsługa `navigator.mediaDevices.getUserMedia`, streamowanie obrazu z kamery do niewidocznego tagu `<video>`.
- `OverlayCanvas.tsx`: Rysowanie ramek (Bounding Boxes) nad strumieniem wideo w oparciu o koordynaty z modelu.
- `ControlPanel.tsx`: UI do włączania/wyłączania kamery, wyświetlania progresu pobierania modelu i zmiany progu pewności (Confidence Threshold).

#### B. Wątek Poboczny (AI Worker)
Z uwagi na to, że nawet najszybsze inferencje mogą zaburzyć 60 FPS interfejsu użytkownika, silnik AI zostanie odizolowany w Web Workerze:
- `ai.worker.ts`: Odbiera klatki z kamery (przez `OffscreenCanvas` lub zserializowane `ImageData`), przekazuje do `Transformers.js` (pipeline `object-detection`), i asynchronicznie odsyła wyniki (`DetectionResult[]`) z powrotem do wątku głównego.

## 3. Szczegółowy Plan Wdrożenia

### Faza 1: Inicjalizacja i Środowisko
- [ ] Utworzenie projektu `vite` (React + TS).
- [ ] Konfiguracja Tailwind CSS i przestrzeni roboczej.
- [ ] Instalacja kluczowych pakietów: `@xenova/transformers`, `zustand`, `lucide-react`.
- [ ] Utworzenie struktury katalogów (`components/`, `lib/`, `store/`, `workers/`).

### Faza 2: Integracja Kamery i UI
- [ ] Zbudowanie komponentu `CameraFeed` z obsługą błędów (brak uprawnień, brak kamery).
- [ ] Stworzenie układu graficznego aplikacji (Dark Mode, szklany panel nawigacyjny).
- [ ] Zbudowanie komponentu przesyłania plików (Drag & Drop) jako alternatywy dla kamery (User Story 2).

### Faza 3: AI Engine i Web Worker
- [ ] Utworzenie `ai.worker.ts` z kodem ładującym model detekcji obiektów (np. `Xenova/detr-resnet-50` lub lżejszy mobilny odpowiednik).
- [ ] Obsługa zdarzeń `postMessage` dla śledzenia postępu ładowania modelu bajt po bajcie (na potrzeby UI - User Story 1).
- [ ] Wpięcie funkcji przekazującej pojedynczą klatkę wideo do obiektu `pipeline` z biblioteki `Transformers.js`.
- [ ] Ekstrakcja wymiarów, etykiet klas (labels) i ułamków pewności (scores).

### Faza 4: Canvas Overlay i Pętla
- [ ] Połączenie wyjścia z Workera z wbudowanym w React komponentem `OverlayCanvas`.
- [ ] Implementacja mechanizmu RequestAnimationFrame (rAF), by odpytywać Workera o nową klatkę natychmiast po przetworzeniu poprzedniej, unikając zapychania kolejki.
- [ ] Dopracowanie stylizacji "Bounding Boxes" i etykiet tekstowych (kolory w zależności od pewności).

### Faza 5: Deployment i Fallback
- [ ] Optymalizacja ścieżek `basename` w Vite dla repozytorium GitHub Pages.
- [ ] Obsługa błędów braku WebGPU – włączenie flag WASM w `Transformers.js`.
- [ ] Wdrożenie (GitHub Actions lub ręczny deploy do gałęzi `gh-pages`).

## 4. Testowanie i Weryfikacja

### Testy Jednostkowe i Integracyjne
*Brak na tym etapie wymogu pełnego pokrycia testami dla portfolio (chyba że uznamy to za atut biznesowy).* Skupimy się na weryfikacji manualnej.

### Weryfikacja Wymagań (Manualna)
- [ ] Otwarcie strony na laptopie i smartfonie z załadowanym wskaźnikiem pobierania modelu z precyzją od 0% do 100%.
- [ ] Sprawdzenie w Menedżerze Zadań/Narzędziach Deweloperskich faktu użycia Web Workerów (brak freeze UI).
- [ ] Wykonanie detekcji przynajmniej 3 różnych obiektów i narysowanie poprawnych ramek.

## 5. Otwarte Pytania / Ograniczenia
- **Rozmiar Modelu**: Domyślny model `detr-resnet-50` waży w ONNX ok. 40MB. Możemy użyć mniejszego z serii MobileNet, jeśli czasy ładowania będą stanowić problem.
- **Polityka CORS dla Modeli**: Hugging Face z reguły zezwala na odczyt przez przeglądarkę, upewnimy się, że CDN to wspiera przed twardym hardcodowaniem.

---
**Plan gotowy do zatwierdzenia i generacji zadań (Tasks).**
