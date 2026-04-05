import { Editor } from "@tiptap/core";
import { OutlineManager } from "./OutlineManager";

/**
 * Legacy wrapper for setupOutline.
 * @deprecated Use OutlineManager.init() instead.
 */
export function setupOutline() {
    OutlineManager.init();
}

/**
 * Legacy wrapper for renderOutline.
 * @deprecated Use OutlineManager.render() instead.
 */
export function renderOutline(editor: Editor) {
    OutlineManager.render(editor);
}
