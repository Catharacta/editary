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
import { htmlToMarkdown, markdownToHtml } from "./markdown-parser";
import { electroview } from "./ipc";
import { state } from "./state/workspace";
import { t } from "./utils/i18n";

// Worker for heavy parsing
let parsingWorker: Worker | null | undefined = undefined;

function getParsingWorker() {
    // If it's already null, it means a previous attempt failed, so we don't try again.
    if (parsingWorker === undefined) {
        try {
            // We use a relative URL. In most browser environments, this is fine.
            // AVOID import.meta.url as it can cause syntax errors in some environments.
            const workerUrl = "parsing.worker.js";
            parsingWorker = new Worker(workerUrl);
            
            parsingWorker.onerror = (e) => {
                console.warn("[Editary] Parsing Worker failed to load or crashed. Falling back to synchronous parsing.", e);
                parsingWorker = null;
            };
        } catch (error) {
            console.error("[Editary] Failed to initialize Web Worker for parsing. Using synchronous fallback.", error);
            parsingWorker = null;
        }
    }
    return parsingWorker;
}

/**
 * Parses Markdown to HTML asynchronously using a Web Worker.
 * If the worker is unavailable, falls back to synchronous parsing.
 */
async function parseMarkdownAsync(markdown: string): Promise<string> {
    try {
        const worker = getParsingWorker();
        
        if (!worker) {
            return markdownToHtml(markdown);
        }

        return new Promise((resolve) => {
            const onMessage = (e: MessageEvent) => {
                cleanup();
                if (e.data.error) {
                    console.error("[Editary] Worker parse error:", e.data.error);
                    resolve(markdownToHtml(markdown));
                } else {
                    resolve(e.data.html);
                }
            };
            
            const onError = (e: ErrorEvent) => {
                cleanup();
                console.warn("[Editary] Worker execution error, falling back to sync:", e);
                resolve(markdownToHtml(markdown));
            };

            const cleanup = () => {
                worker.removeEventListener("message", onMessage);
                worker.removeEventListener("error", onError);
            };

            worker.addEventListener("message", onMessage);
            worker.addEventListener("error", onError);
            worker.postMessage({ markdown });

            // Safety timeout: if worker doesn't respond in 5s, fallback
            setTimeout(() => {
                cleanup();
                resolve(markdownToHtml(markdown));
            }, 5000);
        });
    } catch (e) {
        console.error("[Editary] Error in parseMarkdownAsync:", e);
        return markdownToHtml(markdown);
    }
}

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
            }).extend({
                addNodeView() {
                    return ({ node, editor, getPos }) => {
                        const { src } = node.attrs;
                        const container = document.createElement("div");
                        container.className = "neo-image-container";
                        
                        const img = document.createElement("img");
                        img.className = "neo-image";
                        
                        // If it's a relative path, use a placeholder until resolved
                        const isRelative = src && !src.startsWith("http") && !src.startsWith("data:") && !src.startsWith("views:");
                        
                        if (isRelative) {
                            img.src = ""; // Empty or placeholder
                            img.style.opacity = "0.3";
                            
                            let observer: IntersectionObserver | null = null;
                            if (typeof IntersectionObserver !== 'undefined') {
                                observer = new IntersectionObserver(async (entries) => {
                                    for (const entry of entries) {
                                        if (entry.isIntersecting) {
                                            if (observer) observer.disconnect();
                                            
                                            // Resolve path
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
                                                } catch (error) {
                                                    console.error("[LazyImage] Resolution failed:", fullPath, error);
                                                }
                                            }
                                        }
                                    }
                                }, { rootMargin: "200px" });
                                
                                window.requestAnimationFrame(() => {
                                    if (observer) observer.observe(container);
                                });
                            } else {
                                // Fallback: Immediate load if IntersectionObserver is missing
                                (async () => {
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
                                        } catch (error) {
                                            console.error("[LazyImage] Resolution failed (fallback):", fullPath, error);
                                        }
                                    }
                                })();
                            }
                        } else {
                            img.src = src;
                        }

                        container.appendChild(img);
                        
                        return {
                            dom: container,
                            update: (updatedNode) => {
                                if (updatedNode.type.name !== this.name) return false;
                                // If the src attribute changed, we let ProseMirror handle it by returning false 
                                // (rebuild the view) or we manually update.
                                if (updatedNode.attrs.src !== node.attrs.src) return false;
                                return true;
                            },
                        };
                    };
                }
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
 * Set the editor content from a Markdown or HTML string.
 */
export async function setEditorContent(editor: Editor, content: string, isMarkdown: boolean = false): Promise<void> {
    let finalContent = content;
    
    if (isMarkdown && content.trim()) {
        try {
            // Use worker for heavy markdown
            finalContent = await parseMarkdownAsync(content);
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
        
        // Image resolution is now handled lazily by the NodeView.
        
        editor.commands.setContent(newHtml);
        
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
