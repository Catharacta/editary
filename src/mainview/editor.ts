import { Editor, Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { EditorView } from "@tiptap/pm/view";
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
import { InputRule } from "@tiptap/core";
import CharacterCount from "@tiptap/extension-character-count";
import { MathBlock } from "./extensions/math-block";
import { MathInline } from "./extensions/math-inline";
import { EditaryCodeBlock } from "./extensions/mermaid-block";
import { TextSelection } from "@tiptap/pm/state";
import { Kbd, MarkTag, Underline, Details, Summary, Ruby, Rt, RawHtml } from "./extensions/html-tags";
import { htmlToMarkdown, markdownToHtml, resolveRelativeImages } from "./markdown-parser";
import { electroview } from "./ipc";
import { state } from "./state/workspace";
import { t } from "./utils/i18n";

import BubbleMenu from "@tiptap/extension-bubble-menu";

/**
 * Tiptap Extension to handle drag and drop / paste for images.
 */
const ImageHandler = Extension.create({
    name: "imageHandler",
    addProseMirrorPlugins() {
        return [
            new Plugin({
                props: {
                    // @ts-ignore: Tiptap types might not include all ProseMirror props
                    handleDragOver: (view: EditorView, event: DragEvent) => {
                        event.preventDefault();
                        return false;
                    },
                    handleDrop: (view: EditorView, event: DragEvent) => {
                        if (event.dataTransfer?.files?.length) {
                            const file = event.dataTransfer.files[0];
                            if (file.type.startsWith("image/")) {
                                handleImageInsert(this.editor, file);
                                return true;
                            }
                        }
                        return false;
                    },
                    handlePaste: (view: EditorView, event: ClipboardEvent) => {
                        const items = event.clipboardData?.items;
                        if (items) {
                            for (let i = 0; i < items.length; i++) {
                                if (items[i].type.startsWith("image/")) {
                                    const file = items[i].getAsFile();
                                    if (file) {
                                        handleImageInsert(this.editor, file);
                                        return true;
                                    }
                                }
                            }
                        }
                        return false;
                    },
                },
            }),
        ];
    },
});

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
            TextAlign.configure({
                types: ["tableCell", "tableHeader"],
                alignments: ["left", "center", "right"],
            }),
            Extension.create({
                name: "slashCommands",
                addInputRules() {
                    return [
                        new InputRule({
                            find: /(?:^|\s)\/image\s$/,
                            handler: ({ state, range }) => {
                                const { tr } = state;
                                tr.delete(range.from, range.to);
                                this.editor.view.dispatch(tr);

                                // Trigger file picker
                                const input = document.createElement("input");
                                input.type = "file";
                                input.accept = "image/*";
                                input.onchange = (e) => {
                                    const file = (e.target as HTMLInputElement).files?.[0];
                                    if (file) {
                                        handleImageInsert(this.editor, file);
                                    }
                                };
                                input.click();
                            },
                        }),
                        new InputRule({
                            find: /(?:^|\s)\/table\s$/,
                            handler: ({ state, range }) => {
                                const { tr } = state;
                                const { schema } = state;

                                // Deleting the "/table " command
                                tr.delete(range.from, range.to);

                                // Create the table structure logically
                                const table = schema.nodes.table.create({}, [
                                    schema.nodes.tableRow.create({}, [
                                        schema.nodes.tableHeader.create({}, [schema.nodes.paragraph.create()]),
                                        schema.nodes.tableHeader.create({}, [schema.nodes.paragraph.create()]),
                                    ]),
                                    schema.nodes.tableRow.create({}, [
                                        schema.nodes.tableCell.create({}, [schema.nodes.paragraph.create()]),
                                        schema.nodes.tableCell.create({}, [schema.nodes.paragraph.create()]),
                                    ]),
                                    schema.nodes.tableRow.create({}, [
                                        schema.nodes.tableCell.create({}, [schema.nodes.paragraph.create()]),
                                        schema.nodes.tableCell.create({}, [schema.nodes.paragraph.create()]),
                                    ]),
                                ]);

                                // Insert at the command's position
                                tr.insert(range.from, table);

                                // Set selection precisely to the head of the first cell
                                // Position: range.from (table start) + 1 (row start) + 1 (cell start) + 1 (paragraph start)
                                const firstCellPos = range.from + 3;
                                const $pos = tr.doc.resolve(firstCellPos);
                                tr.setSelection(TextSelection.near($pos));
                                
                                this.editor.view.dispatch(tr);

                                // Fix for BubbleMenu (Table Menu) appearing at (0,0) top-left.
                                // We wait for the next animation frame to ensure the DOM has rendered the new table
                                // before refocusing, which triggers the menu's position calculation at the correct coordinates.
                                window.requestAnimationFrame(() => {
                                    this.editor.commands.focus(firstCellPos);
                                });
                            },
                        }),
                    ];
                },
            }),
            Placeholder.configure({
                placeholder: t("editor.placeholder"),
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: "neo-link",
                },
            }),
            Image.extend({
                addAttributes() {
                    return {
                        ...this.parent?.(),
                        "data-original-src": {
                            default: null,
                            parseHTML: (element) => element.getAttribute("data-original-src"),
                            renderHTML: (attributes) => {
                                if (!attributes["data-original-src"]) {
                                    return {};
                                }
                                return {
                                    "data-original-src": attributes["data-original-src"],
                                };
                            },
                        },
                    };
                },
            }).configure({
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
            ImageHandler,
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
export async function reparseContent(editor: Editor): Promise<{ success: boolean; message: string }> {
    try {
        const currentHtml = editor.getHTML();
        const markdown = htmlToMarkdown(currentHtml);
        let newHtml = markdownToHtml(markdown);
        
        if (state.currentFilePath) {
            const baseDir = state.currentFilePath.replace(/[\\/][^\\/]*$/, "") || ".";
            newHtml = await resolveRelativeImages(newHtml, baseDir, electroview);
        }

        editor.commands.setContent(newHtml);
        
        // Basic check: if dompurify removed something, we might want to know
        // (Though technically we don't have a direct comparison for "removed" items here without complex diffing)
        return { success: true, message: t("editor.syntaxUpdated") };
    } catch (e) {
        console.error("Reparse failed:", e);
        return { success: false, message: t("editor.syncFailed") };
    }
}

export function getEditorText(editor: Editor): string {
    return editor.getText();
}

/**
 * Handle image file insertion (Drop or Paste).
 * If a file path exists, save to assets/. If not (Untitled), keep as Base64.
 */

export async function handleImageInsert(editor: Editor, file: File) {
    const reader = new FileReader();
    reader.onload = async () => {
        const base64Data = reader.result as string;

        if (state.currentFilePath && electroview.rpc) {
            // Document has a path - save to assets/
            const targetDir = state.currentFilePath.replace(/[\\/][^\\/]*$/, "") || ".";
            const response = await electroview.rpc.request.saveImage({
                targetDir,
                fileName: file.name,
                base64Data
            });

            if (response.success) {
                // Use base64 for immediate preview, but store relative path for saving
                editor.chain().focus().setImage({ 
                    src: base64Data,
                    // @ts-ignore: custom attribute
                    "data-original-src": response.relativePath 
                }).run();
            } else {
                console.error("Failed to save image:", response.error);
                // Fallback to Base64 if saving fails
                editor.chain().focus().setImage({ src: base64Data }).run();
            }
        } else {
            // Untitled document - keep as Base64 for now
            editor.chain().focus().setImage({ src: base64Data }).run();
        }
    };
    reader.readAsDataURL(file);
}
