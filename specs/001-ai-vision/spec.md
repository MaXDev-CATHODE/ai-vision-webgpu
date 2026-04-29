# Feature Specification: Real-Time AI Vision (Serverless WebGPU)

**Feature Branch**: `[001-ai-vision-webgpu]`  
**Created**: 2026-04-29  
**Status**: Draft  
**Input**: User description: "Real-Time AI Vision (Sztuczna Inteligencja bez serwera w 100% Client-Side oparta na Transformers.js i WebGPU na GitHub Pages)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Detekcja Obiektów na Żywo (Priority: P1)

Jako użytkownik końcowy chcę uruchomić stronę, zezwolić na dostęp do kamery i natychmiast zobaczyć ramki detekcji na rozpoznawanych obiektach wokół mnie, aby przekonać się o możliwościach sztucznej inteligencji działającej lokalnie w przeglądarce.

**Why this priority**: Podstawowa funkcjonalność demonstrująca inżynieryjny efekt "WOW" bez udziału backendu. Zapewnia natychmiastowy odbiór wizualny na darmowym hostingu (GitHub Pages).

**Independent Test**: Zezwolenie na użycie kamery w przeglądarce ładuje model lokalnie i z opóźnieniem do 150ms rysuje precyzyjne ramki z procentową pewnością detekcji dla standardowych obiektów (np. "Osoba: 98%").

**Acceptance Scenarios**:

1. **Given** użytkownik wchodzi na stronę po raz pierwszy, **When** klika przycisk "Uruchom Kamerę", **Then** system pyta o uprawnienia i rozpoczyna asynchroniczne pobieranie modelu AI do pamięci podręcznej (z paskiem postępu).
2. **Given** model został załadowany, **When** użytkownik porusza się przed kamerą, **Then** ramki (Bounding Boxes) śledzą obiekty na żywo bez przycinania się interfejsu aplikacji.

---

### User Story 2 - Wgranie i Analiza Zdjęcia Statycznego (Priority: P2)

Jako użytkownik, który nie posiada kamery internetowej lub odmawia do niej dostępu, chcę móc przeciągnąć i upuścić (Drag & Drop) własne zdjęcie, aby system wykrył na nim obiekty.

**Why this priority**: Ważne jako fallback (plan awaryjny) dla urządzeń bez kamery oraz weryfikacja precyzji modelu na testowych obrazach o wysokiej rozdzielczości.

**Independent Test**: Przeciągnięcie dowolnego pliku `.jpg` / `.png` powoduje niemal natychmiastową analizę lokalną obrazu i narysowanie adnotacji bez widocznego ładowania przez sieć.

**Acceptance Scenarios**:

1. **Given** użytkownik odmawia dostępu do kamery, **When** przeciąga plik `.jpg` na oznaczony obszar, **Then** aplikacja renderuje zdjęcie i w ciągu 1 sekundy nakłada odpowiednie znaczniki detekcji.

---

### Edge Cases

- Co się stanie, gdy użytkownik otworzy stronę w przeglądarce nieobsługującej WebGPU? (Aplikacja powinna płynnie zrezygnować na rzecz WebGL lub WASM z komunikatem informacyjnym).
- Jak system zachowuje się przy bardzo dużej liczbie rozmytych obiektów w kadrze? (Limitowanie liczby rysowanych ramek do X najważniejszych, aby utrzymać wydajność w okolicach 30 FPS).
- Co w przypadku braku połączenia internetowego podczas pierwszej próby załadowania modelu?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST uruchamiać model uczenia maszynowego (np. YOLOv8 lub MobileNet) w 100% po stronie klienta (Client-Side).
- **FR-002**: System MUST renderować podgląd z kamery z szybkością co najmniej 30 klatek na sekundę na średniej klasy sprzęcie.
- **FR-003**: System MUST buforować pobrany model AI w cache przeglądarki, aby kolejne wizyty na stronie wymagały pobierania 0 MB danych modelu.
- **FR-004**: System MUST oferować przejrzysty wskaźnik ładowania (Progress Bar) z dokładną wielkością pobieranych bajtów podczas początkowej inicjalizacji modelu z sieci CDN (np. Hugging Face).
- **FR-005**: Użytkownik MUST mieć możliwość zatrzymania/wyłączenia strumienia wideo i zwolnienia zasobów karty graficznej w dowolnym momencie.

### Key Entities 

- **SessionConfiguration**: Reprezentuje wybór metody wejścia (Camera, Image, Video) i aktualny stan silnika.
- **DetectionResult**: Wynik wywnioskowany z modelu, zawierający współrzędne pola (x, y, width, height), nazwę zidentyfikowanego obiektu oraz współczynnik pewności (Confidence Score).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Opóźnienie między uchwyconą ramką kamery a wyrenderowaniem adnotacji AI (Inference Time) nie przekracza średnio 50ms na nowoczesnym komputerze stacjonarnym.
- **SC-002**: Aplikacja może być z powodzeniem budowana jako statyczne pliki HTML/JS/CSS i ładować się pomyślnie z darmowego hostingu (GitHub Pages).
- **SC-003**: Obciążenie głównego wątku (Main Thread) pozostaje wolne (UI nie zacina się), dzięki asynchronicznemu odpalaniu przetwarzania wizji.
- **SC-004**: System pomyślnie używa WebGPU, jeśli jest dostępne, z mechanizmem obniżenia wymagań do WebGL dla 100% kompatybilności w dół.

## Assumptions

- Zakładamy, że aplikacja będzie hostowana w środowisku bez backendu, co wymusza całkowite unikanie zapytań CORS do zewnętrznych API, z wyjątkiem bezpośredniego i zezwolonego pobierania modeli ONNX.
- Zakładamy, że użytkownicy testujący projekt na nowoczesnych urządzeniach będą mieli sprzęt ze wsparciem dla akceleracji sprzętowej w przeglądarkach (Chrome 113+ dla WebGPU).
- Zakładamy dostarczanie modeli o wadze nie większej niż 50 MB ze względu na dbałość o czasy ładowania przez sieć dla typowych klientów.
