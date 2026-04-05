import { FileTreeManager } from "./FileTreeManager";
import { type FileEntry } from "../../shared/types";
import { state } from "../state/workspace";

/**
 * Legacy loader for the file tree.
 * @deprecated Use FileTreeManager.load() instead.
 */
export async function loadFileTree(dirPath: string) {
    await FileTreeManager.load(dirPath);
}

/**
 * Legacy renderer for the file tree.
 * @deprecated Use FileTreeManager.render() instead.
 */
export function renderFileTree(entries: FileEntry[]) {
    FileTreeManager.render(entries);
}

/**
 * Legacy entry point for creating a new file in the selected directory.
 */
export function createNewFileInSelected() {
    if (state.currentFolderPath) {
        let parentPath = state.currentFolderPath;
        if (state.selectedPath) {
            // Find if selected is dir or file
            const item = document.querySelector(`[data-path="${state.selectedPath}"]`);
            const isDir = item?.classList.contains("file-tree-item--directory");
            parentPath = isDir ? state.selectedPath : state.selectedPath.replace(/[\\/][^\\/]*$/, "");
        }
        FileTreeManager.startCreateInline(parentPath, false);
    }
}

/**
 * Legacy entry point for creating a new folder in the selected directory.
 */
export function createNewFolderInSelected() {
    if (state.currentFolderPath) {
        let parentPath = state.currentFolderPath;
        if (state.selectedPath) {
            const item = document.querySelector(`[data-path="${state.selectedPath}"]`);
            const isDir = item?.classList.contains("file-tree-item--directory");
            parentPath = isDir ? state.selectedPath : state.selectedPath.replace(/[\\/][^\\/]*$/, "");
        }
        FileTreeManager.startCreateInline(parentPath, true);
    }
}

// Global keyboard navigation (simplified, delegated to manager if needed)
// For now, keeping the global listener here but it could move to KeyboardManager.
document.addEventListener("keydown", (e: KeyboardEvent) => {
    if (FileTreeManager.isInputting()) return;
    
    // Enter to toggle/open
    if (e.key === "Enter" && state.selectedPath) {
        const item = document.querySelector(`[data-path="${state.selectedPath}"]`) as HTMLElement;
        if (item) item.click();
    }
    
    // F2 to rename
    if (e.key === "F2" && state.selectedPath) {
        const item = document.querySelector(`[data-path="${state.selectedPath}"]`) as HTMLElement;
        if (item) {
            const name = item.querySelector(".file-tree-name")?.textContent || "";
            FileTreeManager.startRename(item, state.selectedPath, name);
        }
    }
});
