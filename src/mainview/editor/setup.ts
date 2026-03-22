import { createEditor } from "../editor";
import { state } from "../state/workspace";
import { renderOpenTabs, saveFile } from "../workspace/file-ops";
import { updateTitleBar } from "../utils/dom";
import { updateStatusBar } from "../ui/status-bar";
import { setupTablePicker } from "./table-picker";
import { setupToolbar } from "./toolbar";
import { setupOutline, renderOutline } from "../ui/outline";

export function setupEditorInstance() {
    let autoSaveTimeout: any = null;
    const editorElement = document.getElementById("editor");
    const tableBubbleMenu = document.getElementById("tableBubbleMenu");

    if (!editorElement) {
        throw new Error("Editor element not found");
    }

    const editor = createEditor(editorElement, tableBubbleMenu);
    editor.setEditable(false);
    state.editor = editor;

    editor.on("update", () => {
        if (state.currentFilePath) {
            const tab = state.openTabs.get(state.currentFilePath);
            if (tab && !tab.isDirty) {
                tab.isDirty = true;
                renderOpenTabs();
                updateTitleBar();
            }

            // Auto-save logic
            if (state.editorSettings.autoSave && tab && !tab.isUntitled) {
                if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
                autoSaveTimeout = setTimeout(async () => {
                    if (state.currentFilePath === tab.filePath && tab.isDirty) {
                        await saveFile(tab.filePath);
                    }
                }, 2000); // 2 seconds delay
            }
        }
        updateStatusBar();
        renderOutline(editor);
    });

    setupTablePicker();
    setupToolbar();
    setupOutline();
}
