import { Node, mergeAttributes, InputRule } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import katex from "katex";

/**
 * MathBlock — Live-preview KaTeX block.
 *
 * Structure rendered in the editor:
 *   ┌─────────────────────────────┐
 *   │  code editor  (contentDOM)  │  ← ProseMirror manages text here
 *   ├─────────────────────────────┤
 *   │  KaTeX preview              │  ← re-rendered on every update
 *   └─────────────────────────────┘
 *
 * The node stores its LaTeX source as regular text content (not an attribute).
 * This means ProseMirror handles cursor, selection, undo/redo, and keyboard
 * events natively — no textarea hacks needed.
 */
export const MathBlock = Node.create({
    name: "mathBlock",
    group: "block",
    content: "text*",
    marks: "",
    code: true,
    defining: true,
    isolating: true,

    parseHTML() {
        return [
            { tag: 'div[data-type="math-block"]' },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return [
            "div",
            mergeAttributes({ "data-type": "math-block" }, HTMLAttributes),
            0,  // 0 = "content hole" — ProseMirror will insert text content here
        ];
    },

    addInputRules() {
        return [
            // Type "$$ " at the start of a line → create an empty math block
            new InputRule({
                find: /^$$\s$/,
                handler: ({ state, range }) => {
                    const { tr } = state;
                    const $from = state.doc.resolve(range.from);
                    if ($from.parent.type.name !== "paragraph") return;

                    const node = this.type.create(null);
                    tr.replaceWith($from.before(), $from.after(), node);

                    // Place cursor inside the new math block
                    const pos = $from.before() + 1; // inside the node
                    tr.setSelection(TextSelection.create(tr.doc, pos));
                },
            }),
        ];
    },

    addKeyboardShortcuts() {
        return {
            // When pressing Enter at the end of a math block, create a new
            // paragraph below instead of inserting a newline inside.
            Enter: ({ editor }) => {
                const { state } = editor;
                const { selection } = state;
                const { $from } = selection;

                // Only handle if we're inside a mathBlock
                if ($from.parent.type.name !== this.name) return false;

                // If cursor is at the very end of the block
                const atEnd = $from.parentOffset === $from.parent.content.size;
                // And the block content ends with a newline — exit the block
                const text = $from.parent.textContent;
                if (atEnd && text.endsWith("\n")) {
                    // Remove the trailing newline and create a paragraph after
                    const { tr } = state;
                    const blockEnd = $from.after();
                    // Remove trailing newline
                    tr.delete($from.pos - 1, $from.pos);
                    // Insert a new paragraph after the math block
                    tr.insert(blockEnd - 1, state.schema.nodes.paragraph.create());
                    tr.setSelection(
                        TextSelection.create(tr.doc, blockEnd)
                    );
                    editor.view.dispatch(tr);
                    return true;
                }

                return false;
            },
        };
    },

    addNodeView() {
        return ({ node, getPos, editor }) => {
            // ─── Outer container ───
            const dom = document.createElement("div");
            dom.classList.add("neo-math-block");

            // ─── Upper: code editor area ───
            const editorArea = document.createElement("div");
            editorArea.classList.add("neo-math-editor");

            const pre = document.createElement("pre");
            pre.classList.add("neo-math-code");
            const code = document.createElement("code");
            pre.appendChild(code);
            editorArea.appendChild(pre);

            // ─── Lower: preview area ───
            const previewArea = document.createElement("div");
            previewArea.classList.add("neo-math-preview");

            // ─── Toggle button ───
            const toggleBtn = document.createElement("button");
            toggleBtn.className = "neo-block-toggle-btn";
            toggleBtn.title = "コードを表示/非表示";
            // Eye icon (open)
            const iconEyeOpen = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
            // Eye icon (closed)/code
            const iconEyeClosed = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
            toggleBtn.innerHTML = iconEyeOpen;

            let isSourceHidden = false;
            // Handle toggle click
            toggleBtn.addEventListener("mousedown", (e) => {
                // Prevent selection loss in ProseMirror
                e.preventDefault();
            });
            toggleBtn.addEventListener("click", (e) => {
                e.preventDefault();
                isSourceHidden = !isSourceHidden;
                if (isSourceHidden) {
                    editorArea.classList.add("neo-editor-hidden");
                    toggleBtn.innerHTML = iconEyeClosed;
                    toggleBtn.classList.add("is-active");
                } else {
                    editorArea.classList.remove("neo-editor-hidden");
                    toggleBtn.innerHTML = iconEyeOpen;
                    toggleBtn.classList.remove("is-active");
                }
            });

            dom.appendChild(toggleBtn);

            dom.appendChild(editorArea);
            dom.appendChild(previewArea);

            // ─── Render function ───
            let hasRendered = false;
            const renderPreview = (text: string) => {
                if (!text.trim()) {
                    previewArea.innerHTML =
                        '<span class="empty-math">< Empty Math Block ></span>';
                    return;
                }
                try {
                    katex.render(text, previewArea, {
                        displayMode: true,
                        throwOnError: false,
                    });
                    hasRendered = true;
                } catch (err: any) {
                    previewArea.innerHTML = `<span class="math-error">${err.message}</span>`;
                }
            };

            // ─── Intersection Observer for Lazy Rendering ───
            let observer: IntersectionObserver | null = null;
            if (typeof IntersectionObserver !== 'undefined') {
                observer = new IntersectionObserver((entries) => {
                    entries.forEach((entry) => {
                        if (entry.isIntersecting && !hasRendered) {
                            renderPreview(node.textContent);
                        }
                    });
                }, { rootMargin: "200px" });

                // Wait for next frame to ensure DOM is attached before observing
                window.requestAnimationFrame(() => {
                    if (observer) observer.observe(dom);
                });
            } else {
                // Fallback for environments without IntersectionObserver
                renderPreview(node.textContent);
            }

            return {
                dom,
                contentDOM: code,  // ProseMirror controls text editing here
                update: (updatedNode) => {
                    if (updatedNode.type.name !== this.name) return false;
                    
                    // If content changed, we need to re-render. 
                    if (updatedNode.textContent !== node.textContent) {
                        node = updatedNode; // Update node reference to latest
                        hasRendered = false;
                        
                        // Check visibility for immediate re-render
                        const isVisible = dom.getBoundingClientRect().top < window.innerHeight && dom.getBoundingClientRect().bottom > 0;
                        if (isVisible || typeof IntersectionObserver === 'undefined') {
                            renderPreview(updatedNode.textContent);
                        }
                    } else {
                        node = updatedNode; // Always update node reference
                    }
                    return true;
                },
                ignoreMutation: (mutation: any) => {
                    if (mutation.type === "selection") return true;
                    if (mutation.type === "characterData" || mutation.type === "childList") {
                        return true;
                    }
                    if (!code.contains(mutation.target)) {
                        return true;
                    }
                    return false;
                },
                destroy: () => {
                    if (observer) observer.disconnect();
                }
            };
        };
    },
});
