import { IpcManager } from "../ipc/IpcManager";

/**
 * Manager for the window control buttons (minimize, maximize, close).
 */
export class WindowControlsManager {
    /**
     * Initializes window control event listeners.
     */
    static init() {
        const minimizeBtn = document.getElementById("minimizeBtn");
        const maximizeBtn = document.getElementById("maximizeBtn");
        const closeBtn = document.getElementById("closeBtn");

        minimizeBtn?.addEventListener("click", () => {
            IpcManager.minimizeWindow();
        });

        maximizeBtn?.addEventListener("click", () => {
            IpcManager.maximizeWindow();
        });

        closeBtn?.addEventListener("click", () => {
            IpcManager.closeWindow();
        });
    }
}
