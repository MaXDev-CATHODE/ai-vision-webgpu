import { pipeline, env } from '@huggingface/transformers';

// KONFIGURACJA ŚRODOWISKA
env.allowLocalModels = false; 
env.allowRemoteModels = true; 
env.useBrowserCache = false;

export class ModelLoader {
    private static log(msg: string) {
        console.log(`[ModelLoader] ${msg}`);
        self.postMessage({ status: 'log', message: msg });
    }

    static async loadModelWithFallback(
        modelId: string, 
        task: any, 
        options: any = {}, 
        progress_callback?: (progress: any) => void
    ) {
        const origin = self.location.origin;
        const baseUrl = (import.meta as any).env.BASE_URL || '/';
        
        // Budujemy bezpieczną ścieżkę do modeli
        let modelsPath = new URL(`${baseUrl}models/`, origin).toString();
        if (!modelsPath.endsWith('/')) modelsPath += '/';

        this.log(`Base URL: ${baseUrl}`);
        this.log(`Próba lokalizacji modeli: ${modelsPath}`);

        // Weryfikacja czy plik konfiguracyjny istnieje pod tą ścieżką
        const testUrl = `${modelsPath}${modelId}/preprocessor_config.json`;
        try {
            this.log(`Testowanie połączenia: ${testUrl}`);
            const response = await fetch(testUrl, { method: 'HEAD', cache: 'no-store' });
            if (!response.ok) {
                this.log(`UWAGA: Brak lokalnego pliku (Status ${response.status}). Przełączam na ścieżkę domyślną.`);
                // Fallback: jeśli base URL zawiódł, spróbujmy bez niego (może Vite dev server)
                if (baseUrl !== '/') {
                   modelsPath = new URL('/models/', origin).toString();
                   if (!modelsPath.endsWith('/')) modelsPath += '/';
                   this.log(`Nowa ścieżka testowa: ${modelsPath}`);
                }
            } else {
                this.log(`SUKCES: Znaleziono plik pod ${testUrl}`);
            }
        } catch (e) {
            this.log(`BŁĄD TESTU FETCH: ${e instanceof Error ? e.message : String(e)}`);
        }

        env.remoteHost = modelsPath;
        // KLUCZOWE: Zapobiega dodawaniu "/resolve/main/" do ścieżki
        (env as any).remotePathTemplate = '{model}/';
        
        // Wymuszamy brak cache dla WSZYSTKICH zapytań fetch wewnątrz transformers.js
        (env as any).fetch_options = { 
            cache: 'no-store',
            headers: { 
                'Cache-Control': 'no-cache', 
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        };

        const maxRetries = 3;
        let lastError: any = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const device = attempt === maxRetries ? 'wasm' : 'webgpu';
                this.log(`Próba ${attempt}/${maxRetries} (${device}): Ładowanie ${modelId}...`);
                
                const instance = await pipeline(task, modelId, {
                    ...options,
                    quantized: false,
                    progress_callback: (p) => {
                        this.handleProgress(p);
                        if (progress_callback) progress_callback(p);
                    },
                    device: device as any,
                });

                this.log(`SUKCES: Model załadowany za ${attempt}. razem.`);
                return instance;

            } catch (err: any) {
                lastError = err;
                this.log(`BŁĄD (Próba ${attempt}): ${err.message}`);
                
                if (attempt < maxRetries) {
                    const delay = 2000 * attempt;
                    this.log(`Czekam ${delay}ms przed ponowieniem...`);
                    await new Promise(res => setTimeout(res, delay));
                }
            }
        }

        this.log(`BŁĄD KRYTYCZNY: Nie udało się załadować modelu po ${maxRetries} próbach.`);
        throw lastError;
    }

    private static handleProgress(p: any) {
        if (p.status === 'initiate') this.log(`Inicjalizacja pliku: ${p.file}`);
        if (p.status === 'progress') {
            const progress = (p.progress || 0).toFixed(1);
            const loaded = (p.loaded / 1024 / 1024).toFixed(2);
            const total = (p.total / 1024 / 1024).toFixed(2);
            this.log(`Pobieranie: ${p.file} (${progress}% - ${loaded}/${total}MB)`);
        }
        if (p.status === 'done') this.log(`Zakończono: ${p.file}`);
    }
}
