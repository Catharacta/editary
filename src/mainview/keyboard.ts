import { state } from "./state/workspace";
import { saveFile, createNewFile } from "./workspace/file-ops";

export function setupKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
        // Ctrl+S: Save current file
        if (e.ctrlKey && e.key === "s") {
            e.preventDefault();
            if (state.currentFilePath) {
                saveFile(state.currentFilePath);
            }
        }

        // Ctrl+N: New file
        if (e.ctrlKey && e.key === "n") {
            e.preventDefault();
            createNewFile();
        }

        // Ctrl+B: Toggle Sidebar
        if (e.ctrlKey && e.key === "b") {
            e.preventDefault();
            const sidebar = document.getElementById("sidebar");
            if (sidebar) {
                sidebar.classList.toggle("hidden");
            }
        }
    });
}
