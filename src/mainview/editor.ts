import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Typography from "@tiptap/extension-typography";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import { TextAlign } from "@tiptap/extension-text-align";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import SearchAndReplace from "@sereneinserenade/tiptap-search-and-replace";
import CharacterCount from "@tiptap/extension-character-count";
import BubbleMenu from "@tiptap/extension-bubble-menu";

// Extensions
import { MathBlock } from "./extensions/math-block";
import { MathInline } from "./extensions/math-inline";
import { EditaryCodeBlock } from "./extensions/mermaid-block";
import { Kbd, MarkTag, Underline, Details, Summary, Ruby, Rt, RawHtml } from "./extensions/html-tags";

// Internal modules
import { electroview } from "./ipc";
import { state } from "./state/workspace";
import { ImageHandlerExtension } from "./editor/ImageHandler";
import { SlashCommandsExtension } from "./editor/SlashCommands";
import { EditorAPI } from "./editor/EditorAPI";

/**
 * Initialize the Tiptap editor with Markdown-friendly extensions.
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
            link: false,
            codeBlock: false,
            heading: { levels: [1, 2, 3, 4, 5, 6] },
            blockquote: { HTMLAttributes: { class: "neo-blockquote" } },
            horizontalRule: { HTMLAttributes: { class: "neo-hr" } },
        }),
        TextAlign.configure({
            types: ["tableCell", "tableHeader"],
            alignments: ["left", "center", "right"],
        }),
        Link.configure({
            openOnClick: false,
            HTMLAttributes: { class: "neo-link" },
        }),
        Placeholder.configure({
            placeholder: "Write something...",
            includeChildren: true,
        }),
        Image.extend({
            addAttributes() {
                return {
                    ...this.parent?.(),
                    "data-original-src": { default: null },
                };
            },
            renderHTML({ HTMLAttributes }) {
                // Return a container with custom rendering (lazy loading) logic
                const container = document.createElement("div");
                container.className = "image-container";
                
                const src = HTMLAttributes.src;
                const img = document.createElement("img");
                img.className = "neo-image";
                
                // If it's a relative path, use lazy loading
                const isRelative = src && !src.startsWith("http") && !src.startsWith("data:") && !src.startsWith("views:");
                
                if (isRelative) {
                    img.src = "";
                    img.style.opacity = "0.3";
                    
                    if (typeof IntersectionObserver !== 'undefined') {
                        const observer = new IntersectionObserver(async (entries) => {
                            for (const entry of entries) {
                                if (entry.isIntersecting) {
                                    observer.disconnect();
                                    if (state.currentFilePath && electroview.rpc) {
                                        const baseDir = state.currentFilePath.replace(/[\\/][^\\/]*$/, "") || ".";
                                        const fullPath = baseDir + (baseDir.endsWith("/") || baseDir.endsWith("\\") ? "" : "/") + src;
                                        try {
                                            const response = await electroview.rpc.request.readImageAsDataUrl({ filePath: fullPath });
                                            if (response?.dataUrl) {
                                                img.src = response.dataUrl;
                                                img.setAttribute("data-original-src", src);
                                                img.style.opacity = "1";
                                            }
                                        } catch (e) {}
                                    }
                                }
                            }
                        }, { rootMargin: "200px" });
                        
                        window.requestAnimationFrame(() => observer.observe(container));
                    }
                } else {
                    img.src = src;
                }

                container.appendChild(img);
                return container;
            }
        }),
        Typography,
        Table.configure({
            resizable: true,
            HTMLAttributes: { class: "neo-table" },
        }),
        TableRow,
        TableCell.configure({ HTMLAttributes: { class: "neo-table-cell" } }),
        TableHeader.configure({ HTMLAttributes: { class: "neo-table-header" } }),
        TaskList.configure({ HTMLAttributes: { class: "neo-task-list" } }),
        TaskItem.configure({ nested: true, HTMLAttributes: { class: "neo-task-item" } }),
        SearchAndReplace.configure({ searchResultClass: 'search-result' }),
        CharacterCount,
        ImageHandlerExtension,
        SlashCommandsExtension,
    ];

    if (tableBubbleMenu) {
        extensions.push(
            BubbleMenu.configure({
                pluginKey: "tableBubbleMenu",
                element: tableBubbleMenu,
                shouldShow: ({ editor }) => editor.isActive("table"),
                // @ts-ignore
                tippyOptions: { duration: 100, placement: "bottom", interactive: true },
            })
        );
    }

    return new Editor({
        element,
        extensions,
        content: "",
        editorProps: { attributes: { class: "ProseMirror" } },
    });
}

// Re-export API methods
export const setEditorContent = EditorAPI.setEditorContent;
export const getEditorHTML = EditorAPI.getEditorHTML;
export const getEditorText = EditorAPI.getEditorText;
export const reparseContent = EditorAPI.reparseContent;
export { handleImageInsert } from "./editor/ImageHandler";
