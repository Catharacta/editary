import { createEditor } from "../editor";
import { state } from "../state/workspace";
import { renderOpenTabs } from "../workspace/file-ops";
import { updateTitleBar } from "../utils/dom";
import { updateStatusBar } from "../ui/status-bar";
import { setupTablePicker } from "./table-picker";
import { setupToolbar } from "./toolbar";

export function setupEditorInstance() {
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
        }
        updateStatusBar();
    });

    setupTablePicker();
    setupToolbar();
}
