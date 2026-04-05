import { markdownToHtml } from "../markdown-parser";

/**
 * Manager for the heavy parsing Web Worker.
 */
export class WorkerManager {
    private static _worker: Worker | null | undefined = undefined;

    /**
     * Initializes or retrieves the parsing worker.
     */
    static getWorker(): Worker | null {
        if (this._worker === undefined) {
            try {
                // workerUrl is relative to the directory containing index.html/main.js
                const workerUrl = "parsing.worker.js";
                this._worker = new Worker(workerUrl);
                
                this._worker.onerror = (e) => {
                    console.warn("[Editary] Parsing Worker failed to load or crashed. Falling back to synchronous parsing.", e);
                    this._worker = null;
                };
            } catch (error) {
                console.error("[Editary] Failed to initialize Web Worker for parsing. Using synchronous fallback.", error);
                this._worker = null;
            }
        }
        return this._worker || null;
    }

    /**
     * Parses Markdown to HTML asynchronously using a Web Worker.
     * If the worker is unavailable, falls back to synchronous parsing.
     */
    static async parseMarkdownAsync(markdown: string): Promise<string> {
        try {
            const worker = this.getWorker();
            
            if (!worker) {
                return markdownToHtml(markdown);
            }

            return new Promise((resolve) => {
                const onMessage = (e: MessageEvent) => {
                    cleanup();
                    if (e.data.error) {
                        console.error("[Editary] Worker parse error:", e.data.error);
                        resolve(markdownToHtml(markdown));
                    } else {
                        resolve(e.data.html);
                    }
                };
                
                const onError = (e: ErrorEvent) => {
                    cleanup();
                    console.warn("[Editary] Worker execution error, falling back to sync:", e);
                    resolve(markdownToHtml(markdown));
                };

                const cleanup = () => {
                    worker.removeEventListener("message", onMessage);
                    worker.removeEventListener("error", onError);
                };

                worker.addEventListener("message", onMessage);
                worker.addEventListener("error", onError);
                worker.postMessage({ markdown });

                // Safety timeout: if worker doesn't respond in 5s, fallback
                setTimeout(() => {
                    cleanup();
                    resolve(markdownToHtml(markdown));
                }, 5000);
            });
        } catch (e) {
            console.error("[Editary] Error in parseMarkdownAsync:", e);
            return markdownToHtml(markdown);
        }
    }
}
