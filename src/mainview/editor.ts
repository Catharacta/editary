import { Editor } from "@tiptap/core";
import { EditorManager } from "./editor/EditorManager";
import { CustomImage } from "./editor/extensions/CustomImage";

/**
 * Legacy factory function for createEditor.
 * @deprecated Use EditorManager.init() instead.
 */
export function createEditor(element: HTMLElement, tableBubbleMenu: HTMLElement | null = null): Editor {
    return EditorManager.init(element, tableBubbleMenu);
}

// Re-export EditorManager methods for compatibility
export const setEditorContent = (editor: Editor, content: string, isMarkdown: boolean = false) => 
    EditorManager.setContent(content, isMarkdown);

export const getEditorHTML = (editor: Editor) => EditorManager.getHTML();
export const getEditorText = (editor: Editor) => EditorManager.getText();
export const reparseContent = (editor: Editor) => EditorManager.reparse();
export const jumpToText = (editor: Editor, text: string) => EditorManager.jumpToText(text);

// Re-export extension handlers
export { handleImageInsert } from "./editor/extensions/ImageHandler";

// Export CustomImage for direct use if needed
export { CustomImage };
