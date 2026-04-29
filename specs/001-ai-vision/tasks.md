# Lista Zadań: Real-Time AI Vision (WebGPU)

**Status**: W Trakcie  
**Reference Plan**: [plan.md](./plan.md)

Poniższe zadania zostały ułożone w kolejności zależności i wdrożenia. Wymagają sekwencyjnego wykonania, ze szczególnym uwzględnieniem bezpiecznej izolacji silnika sztucznej inteligencji.

## Faza 1: Konfiguracja i Zależności
- [ ] Zainicjuj projekt Vite (React + TS) w głównym katalogu `ai-vision-webgpu` (usunięcie zbędnych plików początkowych).
- [ ] Zainstaluj Tailwind CSS v4 wraz z niezbędnymi zależnościami.
- [ ] Zainstaluj paczki: `@xenova/transformers`, `zustand`, `lucide-react`.
- [ ] Zaktualizuj plik `vite.config.ts`, włączając obsługę modułów i odpowiednie headery bezpieczeństwa/izolacji cross-origin (Cross-Origin-Embedder-Policy), jeśli będą wymagane przez SharedArrayBuffer.
- [ ] Skonfiguruj podstawowy layout `App.tsx` (ciemne tło neutral-900, minimalizm).

## Faza 2: Połączenie z Kamerą i Interfejs Użytkownika (UI)
- [ ] Utwórz `src/components/CameraFeed.tsx` z tagiem `<video autoPlay playsInline muted>`.
- [ ] Zaimplementuj hak Reacta proszący o uprawnienia do `navigator.mediaDevices.getUserMedia`.
- [ ] Skonfiguruj globalny stan w Zustand (`src/store/useVisionStore.ts`) śledzący: 
  - Status modelu (idle, loading, ready)
  - Postęp ładowania (w %)
  - Konfigurację kamery (włączona/wyłączona)
- [ ] Utwórz `src/components/ControlPanel.tsx` z przyciskami włączającymi analizę, animowanym paskiem ładowania (progress bar).
- [ ] Dodaj obsługę Drag & Drop do wgrywania plików na wypadek braku kamery.

## Faza 3: Izolacja Silnika AI w Web Workerze
- [ ] Utwórz `src/workers/ai.worker.ts`.
- [ ] Zaimplementuj wzorzec singletona do pobierania pipeline'u detekcji obiektów z biblioteki `Transformers.js` (`pipeline('object-detection', 'Xenova/detr-resnet-50')`).
- [ ] Oprogramuj komunikację w obydwie strony (Main Thread <-> Worker) z użyciem interfejsu `postMessage`.
  - Main -> Worker: Inicjalizacja modelu.
  - Worker -> Main: Emitowanie eventów "progress" (wartości procentowe).
  - Worker -> Main: Event "ready" z informacją o ukończeniu pobierania z CDN.
- [ ] Przygotuj metodę Workera przyjmującą zakodowany obraz (ImageBitmap lub base64 z klatki wideo) do metody `predict`.

## Faza 4: Nakładanie Obrazu i Pętla Główna
- [ ] Utwórz `src/components/OverlayCanvas.tsx` z bezwzględnym pozycjonowaniem (absolute) dokładnie nad strumieniem `<video>`.
- [ ] Zbuduj "Pętlę Przechwytywania Klatek" (Frame Capture Loop) wewnątrz głownego wątku:
  1. Pobranie bieżącej klatki z `<video>` do małego ukrytego `<canvas>`.
  2. Ekstrakcja pikseli i wysłanie do `ai.worker.ts`.
  3. Oczekiwanie na wyniki.
  4. Narysowanie wyników w `OverlayCanvas.tsx`.
  5. Rzucenie `requestAnimationFrame` na kolejną klatkę (pętla).
- [ ] Zaimplementuj skalowanie współrzędnych wyników: ramki (X, Y, szerokość, wysokość) zwracane przez model muszą być poprawnie przeliczone na responsywną rozdzielczość na ekranie klienta.

## Faza 5: Polerowanie Wizualne (Wow Effect) i Wdrożenie
- [ ] Ostyluj rysowane w Canvasie ramki (grubsze narożniki, eleganckie fonty i półprzezroczyste tła za etykietami detekcji).
- [ ] Dopełnij stylizację Tailwindem całej aplikacji (Glow effects, ikony Lucide).
- [ ] Dodaj testowe sprawdzenie środowiska (komunikat "Ładowanie silnika AI w przeglądarce...").
- [ ] Zbuduj projekt lokalnie (`npm run build`) i sprawdź czy nie ma błędów TS/ESLint.
- [ ] Zweryfikuj, że ścieżki assetów (pliki ONNX i model) odpowiednio ładują się po stronie CDN firmy Hugging Face.

---
**Dokument gotowy do rozpoczęcia implementacji (`speckit-implement`).**
