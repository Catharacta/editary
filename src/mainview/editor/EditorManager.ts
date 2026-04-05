import { Editor } from "@tiptap/core";
import { state } from "../state/workspace";
import { getExtensions } from "./extensions";
import { htmlToMarkdown, markdownToHtml } from "../markdown-parser";
import { WorkerManager } from "./WorkerManager";
import { t } from "../utils/i18n";
import { renderOpenTabs, saveFile } from "../workspace/file-ops";
import { updateTitleBar } from "../utils/dom";
import { updateStatusBar } from "../ui/status-bar";
import { renderOutline } from "../ui/outline";

/**
 * Manager for the Tiptap editor instance.
 * Handles initialization, content operations, and integration.
 */
export class EditorManager {
    private static instance: Editor | null = null;
    private static autoSaveTimeout: any = null;

    /**
     * Resets the editor instance and global state reference.
     * Useful for testing and clean teardown.
     */
    static reset(): void {
        if (this.instance) {
            this.instance.destroy();
            this.instance = null;
        }
        state.editor = null;
    }

    /**
     * Initializes the editor in the specified element.
     */
    static init(element: HTMLElement, tableBubbleMenu: HTMLElement | null = null): Editor {
        if (this.instance) {
            this.instance.destroy();
        }

        const extensions = getExtensions({ tableBubbleMenu });

        this.instance = new Editor({
            element,
            extensions,
            content: "",
            editorProps: { attributes: { class: "ProseMirror" } },
            onUpdate: ({ editor }) => {
                // Sync with global state
                state.editor = editor;
                this.handleUpdate(editor);
            }
        });

        // Initialize global state reference
        state.editor = this.instance;
        
        return this.instance;
    }

    /**
     * Handles editor update events (auto-save, UI sync).
     */
    private static handleUpdate(editor: Editor) {
        if (state.currentFilePath) {
            const tab = state.openTabs.get(state.currentFilePath);
            if (tab && !tab.isDirty) {
                tab.isDirty = true;
                renderOpenTabs();
                updateTitleBar();
            }

            // Auto-save logic
            if (state.editorSettings.autoSave && tab && !tab.isUntitled) {
                if (this.autoSaveTimeout) clearTimeout(this.autoSaveTimeout);
                this.autoSaveTimeout = setTimeout(async () => {
                    if (state.currentFilePath === tab.filePath && tab.isDirty) {
                        await saveFile(tab.filePath);
                    }
                }, 2000); // 2 seconds delay
            }
        }
        updateStatusBar();
        renderOutline(editor);
    }

    /**
     * Returns the singleton editor instance.
     */
    static getEditor(): Editor | null {
        return this.instance;
    }

    /**
     * Set the editor content from a Markdown or HTML string.
     */
    static async setContent(content: string, isMarkdown: boolean = false): Promise<void> {
        const editor = this.instance || state.editor;
        if (!editor) return;

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
    static getHTML(): string {
        return (this.instance || state.editor)?.getHTML() || "";
    }

    /**
     * Get the editor content as plain text.
     */
    static getText(): string {
        return (this.instance || state.editor)?.getText() || "";
    }

    /**
     * Force a re-parse of the editor content.
     * Converts current HTML to Markdown, then back to HTML.
     */
    static async reparse(): Promise<{ success: boolean; message: string }> {
        if (!this.instance) return { success: false, message: "Editor not initialized" };

        try {
            const currentHtml = this.instance.getHTML();
            const markdown = htmlToMarkdown(currentHtml);
            let newHtml = markdownToHtml(markdown);
            
            this.instance.commands.setContent(newHtml);
            
            return { success: true, message: t("editor.syntaxUpdated") };
        } catch (e) {
            console.error("Reparse failed:", e);
            return { success: false, message: t("editor.syncFailed") };
        }
    }

    /**
     * Focus the editor.
     */
    static focus(position: 'start' | 'end' | number | boolean = true) {
        (this.instance || state.editor)?.commands.focus(position);
    }

    /**
     * Finds the specified text in the editor and jumps to it (scrolls and selects).
     * @param text The text snippet to search for.
     */
    static jumpToText(text: string) {
        if (!this.instance || !text) return;

        const { state, view } = this.instance;
        const { doc } = state;
        let foundPos = -1;

        // Search for the text in the document
        doc.descendants((node, pos) => {
            if (foundPos !== -1) return false; // Early exit if found

            if (node.isText && node.text) {
                const index = node.text.indexOf(text);
                if (index !== -1) {
                    foundPos = pos + index;
                    return false;
                }
            }
            return true;
        });

        if (foundPos !== -1) {
            // Select and scroll to the text
            this.instance.commands.setTextSelection({
                from: foundPos,
                to: foundPos + text.length
            });
            this.instance.commands.scrollIntoView();
        } else {
            // Fallback: If exact snippet not found (maybe due to formatting gaps), 
            // try focusing the start or showing a warning.
            console.warn(`Text snippet not found for jump: "${text}"`);
        }
    }
}
