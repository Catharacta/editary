import { EditorManager } from "./EditorManager";
import { setupTablePicker } from "./table-picker";
import { setupToolbar } from "./toolbar";
import { setupOutline } from "../ui/outline";

/**
 * Initializes the editor instance and binds application-level UI components.
 */
export function setupEditorInstance() {
    const editorElement = document.getElementById("editor");
    const tableBubbleMenu = document.getElementById("tableBubbleMenu");

    if (!editorElement) {
        throw new Error("Editor element not found");
    }

    // Initialize the centralized EditorManager
    const editor = EditorManager.init(editorElement, tableBubbleMenu);
    
    // Initial state: readonly until a file is opened
    editor.setEditable(false);

    // Initialize associated UI components
    setupTablePicker();
    setupToolbar();
    setupOutline();
}
