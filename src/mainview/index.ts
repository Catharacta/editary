import { setupEditorInstance } from "./editor/setup";
import { setupSidebar } from "./ui/sidebar";
import { setupModals } from "./ui/modals";
import { setupSearchPanel } from "./ui/search-panel";
import { setupTooltips } from "./ui/tooltips";
import { setupKeyboardShortcuts } from "./keyboard";
import { setupWindowControls } from "./ui/window-controls";
import { electroview } from "./ipc";
import { state } from "./state/workspace";
import "./index.css";

document.addEventListener("DOMContentLoaded", () => {
    // 1. UI Modules
    setupWindowControls();
    setupTooltips();
    setupSidebar();
    setupModals();
    setupSearchPanel();

    // 2. Keyboard & App
    setupKeyboardShortcuts();
    setupEditorInstance();
});

// Fallback for debugging and RPC internals if needed
(window as any).__editary_state = state;
(window as any).__editary_rpc = electroview.rpc;

// Fallback for debugging and RPC internals if needed
(window as any).__editary_state = state;
(window as any).__editary_rpc = electroview.rpc;
