import { setupEditorInstance } from "./editor/setup";
import { setupSidebar } from "./ui/sidebar";
import { setupModals } from "./ui/modals";
import { setupSearchPanel } from "./ui/search-panel";
import { setupTooltips } from "./ui/tooltips";
import { setupKeyboardShortcuts } from "./keyboard";
import { setupWindowControls } from "./ui/window-controls";
import { ActivityBarManager } from "./ui/ActivityBarManager";
import { SearchManager } from "./ui/SearchManager";
import { LayoutManager } from "./ui/LayoutManager";
import { IpcManager } from "./ipc/IpcManager";
import { state } from "./state/workspace";
import { initI18n, updateUI } from "./utils/i18n";
import "./index.css";

document.addEventListener("DOMContentLoaded", async () => {
    // 0. i18n Initialization
    await initI18n();
    updateUI();

    // 1. UI Modules
    setupWindowControls();
    setupTooltips();
    ActivityBarManager.init();
    SearchManager.init();
    LayoutManager.init();
    setupSidebar();
    setupModals();
    setupSearchPanel();

    // 2. Keyboard & App
    setupKeyboardShortcuts();
    setupEditorInstance();

    // 3. Dynamic Metadata (Version)
    try {
        const version = await IpcManager.getVersion();
        const versionEl = document.getElementById("aboutVersion");
        if (versionEl && version) {
            versionEl.textContent = `Version ${version}`;
        }
    } catch (e) {
        console.warn("Failed to fetch version from main process:", e);
    }

    // Prevent default browser behavior for drag & drop navigation
    window.addEventListener("dragover", (e) => {
        e.preventDefault();
    }, false);
    window.addEventListener("drop", (e) => {
        e.preventDefault();
    }, false);
});

// For debugging and state access
(window as any).__editary_state = state;
(window as any).__ipc_manager = IpcManager;
