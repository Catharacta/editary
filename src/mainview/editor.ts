import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Typography from "@tiptap/extension-typography";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import SearchAndReplace from "@sereneinserenade/tiptap-search-and-replace";
import CharacterCount from "@tiptap/extension-character-count";
import { MathBlock } from "./extensions/math-block";
import { MathInline } from "./extensions/math-inline";
import { EditaryCodeBlock } from "./extensions/mermaid-block";
import { Kbd, MarkTag, Underline, Details, Summary, Ruby, Rt, RawHtml } from "./extensions/html-tags";
import { htmlToMarkdown, markdownToHtml } from "./markdown-parser";

import BubbleMenu from "@tiptap/extension-bubble-menu";

/**
 * Initialize the Tiptap editor with Markdown-friendly extensions.
 * Uses StarterKit as a base (includes Heading, Bold, Italic, Strike,
 * Code, CodeBlock, Blockquote, BulletList, OrderedList, ListItem,
 * HorizontalRule, HardBreak, History).
 */
export function createEditor(element: HTMLElement, tableBubbleMenu: HTMLElement | null = null): Editor {
    const extensions: any[] = [
        MathBlock,
            MathInline,
            EditaryCodeBlock,
            Kbd,
            MarkTag,
            Underline,
            Details,
            Summary,
            Ruby,
            Rt,
            RawHtml,
            StarterKit.configure({
                // Disable Link from StarterKit — we configure it separately below
                link: false,
                // Disable StarterKit's CodeBlock — EditaryCodeBlock replaces it
                codeBlock: false,
                heading: {
                    levels: [1, 2, 3, 4, 5, 6],
                },
                blockquote: {
                    HTMLAttributes: {
                        class: "neo-blockquote",
                    },
                },
                horizontalRule: {
                    HTMLAttributes: {
                        class: "neo-hr",
                    },
                },
            }),
            Placeholder.configure({
                placeholder: "ここに Markdown を書き始めてください...",
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: "neo-link",
                },
            }),
            Image.configure({
                inline: false,
                allowBase64: true,
                HTMLAttributes: {
                    class: "neo-image",
                },
            }),
            Typography,

            // Table extensions
            Table.configure({
                resizable: true,
                HTMLAttributes: {
                    class: "neo-table",
                },
            }),
            TableRow,
            TableCell.configure({
                HTMLAttributes: {
                    class: "neo-table-cell",
                },
            }),
            TableHeader.configure({
                HTMLAttributes: {
                    class: "neo-table-header",
                },
            }),

            // Task list extensions
            TaskList.configure({
                HTMLAttributes: {
                    class: "neo-task-list",
                },
            }),
            TaskItem.configure({
                nested: true,
                HTMLAttributes: {
                    class: "neo-task-item",
                },
            }),
            SearchAndReplace.configure({
                searchResultClass: 'search-result',
            }),
            CharacterCount,
    ];

    if (tableBubbleMenu) {
        extensions.push(
            BubbleMenu.configure({
                pluginKey: "tableBubbleMenu",
                element: tableBubbleMenu,
                shouldShow: ({ editor, state }) => {
                    return editor.isActive("table");
                },
                // @ts-ignore: tippyOptions is valid but may not be available in types
                tippyOptions: {
                    duration: 100,
                    placement: "bottom",

                    interactive: true,
                },
            })
        );
    }

    const editor = new Editor({
        element,
        extensions,
        content: "",
        editorProps: {
            attributes: {
                class: "ProseMirror",
            },
        },
        // Enable Markdown-like input rules (provided by StarterKit):
        // - `# ` → H1, `## ` → H2, etc.
        // - `**text**` → Bold
        // - `*text*` or `_text_` → Italic
        // - `~~text~~` → Strike
        // - `- ` or `* ` → Bullet List
        // - `1. ` → Ordered List
        // - `> ` → Blockquote
        // - ``` → Code Block
        // - `---` → Horizontal Rule
        // - `[text](url)` → Link (via Link extension)
    });

    return editor;
}

/**
 * Set the editor content from a Markdown/HTML string.
 * For now, we load content as HTML. In the future, a Markdown parser
 * (e.g., markdown-it) can convert .md content to HTML before loading.
 */
export function setEditorContent(editor: Editor, content: string): void {
    editor.commands.setContent(content);
}

/**
 * Get the editor content as HTML.
 */
export function getEditorHTML(editor: Editor): string {
    return editor.getHTML();
}

/**
 * Force a re-parse of the editor content.
 * Converts current HTML to Markdown, then back to HTML.
 * This ensures hand-typed HTML tags are processed as Tiptap nodes.
 */
export function reparseContent(editor: Editor): { success: boolean; message: string } {
    try {
        const currentHtml = editor.getHTML();
        const markdown = htmlToMarkdown(currentHtml);
        const newHtml = markdownToHtml(markdown);
        
        editor.commands.setContent(newHtml);
        
        // Basic check: if dompurify removed something, we might want to know
        // (Though technically we don't have a direct comparison for "removed" items here without complex diffing)
        return { success: true, message: "シンタックスを更新しました" };
    } catch (e) {
        console.error("Reparse failed:", e);
        return { success: false, message: "同期に失敗しました" };
    }
}

export function getEditorText(editor: Editor): string {
    return editor.getText();
}
