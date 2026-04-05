import { state } from "../state/workspace";
import { saveFile, createNewFile } from "../workspace/file-ops";
import { SidebarManager } from "../ui/SidebarManager";

/**
 * Manager for application keyboard shortcuts.
 */
export class KeyboardManager {
    /**
     * Initializes keyboard shortcut listeners.
     */
    static init() {
        document.addEventListener("keydown", (e) => this.handleKeyDown(e));
    }

    /**
     * Centralized keydown event handler.
     */
    private static handleKeyDown(e: KeyboardEvent) {
        const isCtrl = e.ctrlKey || e.metaKey; // Support Meta for macOS as well

        // Ctrl+S: Save current file
        if (isCtrl && e.key === "s") {
            e.preventDefault();
            if (state.currentFilePath) {
                saveFile(state.currentFilePath);
            }
            return;
        }

        // Ctrl+N: New file
        if (isCtrl && e.key === "n") {
            e.preventDefault();
            createNewFile();
            return;
        }

        // Ctrl+B: Toggle Sidebar
        if (isCtrl && e.key === "b") {
            e.preventDefault();
            SidebarManager.toggle();
            return;
        }

        // Ctrl+F: Search
        if (isCtrl && e.key === "f") {
            e.preventDefault();
            // We use global fallback for now, but will eventually call SearchPanelManager directly
            (window as any).toggleSearchPanel?.(false);
            return;
        }

        // Ctrl+H: Replace
        if (isCtrl && e.key === "h") {
            e.preventDefault();
            (window as any).toggleSearchPanel?.(true);
            return;
        }
    }
}
