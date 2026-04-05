import { Editor } from "@tiptap/core";
import { htmlToMarkdown, markdownToHtml } from "../markdown-parser";
import { WorkerManager } from "./WorkerManager";
import { t } from "../utils/i18n";

/**
 * Public API for the Editor.
 */
export class EditorAPI {
    /**
     * Set the editor content from a Markdown or HTML string.
     */
    static async setEditorContent(editor: Editor, content: string, isMarkdown: boolean = false): Promise<void> {
        let finalContent = content;
        
        if (isMarkdown && content.trim()) {
            try {
                // Use worker for heavy markdown
                finalContent = await WorkerManager.parseMarkdownAsync(content);
            } catch (e) {
                console.error("Worker parsing failed, falling back to sync:", e);
                finalContent = markdownToHtml(content);
            }
        }
        
        editor.commands.setContent(finalContent);
    }

    /**
     * Get the editor content as HTML.
     */
    static getEditorHTML(editor: Editor): string {
        return editor.getHTML();
    }

    /**
     * Get the editor content as plain text.
     */
    static getEditorText(editor: Editor): string {
        return editor.getText();
    }

    /**
     * Force a re-parse of the editor content.
     * Converts current HTML to Markdown, then back to HTML.
     */
    static async reparseContent(editor: Editor): Promise<{ success: boolean; message: string }> {
        try {
            const currentHtml = editor.getHTML();
            const markdown = htmlToMarkdown(currentHtml);
            let newHtml = markdownToHtml(markdown);
            
            // Image resolution is now handled lazily by the NodeView.
            
            editor.commands.setContent(newHtml);
            
            return { success: true, message: t("editor.syntaxUpdated") };
        } catch (e) {
            console.error("Reparse failed:", e);
            return { success: false, message: t("editor.syncFailed") };
        }
    }
}
