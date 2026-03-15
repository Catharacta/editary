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
                find: /^\$\$\s$/,
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

            dom.appendChild(editorArea);
            dom.appendChild(previewArea);

            // ─── Render function ───
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
                } catch (err: any) {
                    previewArea.innerHTML = `<span class="math-error">${err.message}</span>`;
                }
            };

            // Initial render
            renderPreview(node.textContent);

            return {
                dom,
                contentDOM: code,  // ProseMirror controls text editing here
                update: (updatedNode) => {
                    if (updatedNode.type.name !== this.name) return false;
                    renderPreview(updatedNode.textContent);
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
            };
        };
    },
});
