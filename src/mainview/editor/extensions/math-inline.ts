import { Node, mergeAttributes, InputRule } from "@tiptap/core";
import katex from "katex";

/**
 * MathInline — Inline KaTeX formula.
 *
 * This is an atom node (not editable inline). It renders the formula and
 * on double-click converts back to editable text `$...$`.
 */
export const MathInline = Node.create({
    name: "mathInline",
    group: "inline",
    inline: true,
    atom: true,

    addAttributes() {
        return {
            latex: {
                default: "",
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'span[data-type="math-inline"]',
                getAttrs: (node) => ({
                    latex: (node as HTMLElement).getAttribute("data-latex") ||
                           (node as HTMLElement).textContent || "",
                }),
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return [
            "span",
            mergeAttributes(
                {
                    "data-type": "math-inline",
                    "data-latex": HTMLAttributes.latex,
                },
                HTMLAttributes,
            ),
        ];
    },

    addInputRules() {
        return [
            // Match $...$ (non-greedy, at least 1 char inside)
            new InputRule({
                find: /$([^$]+)$$/,
                handler: ({ state, range, match }) => {
                    const latex = match[1];
                    if (!latex) return;
                    const node = this.type.create({ latex });
                    const tr = state.tr.replaceWith(range.from, range.to, node);
                    // Don't dispatch — return by modifying tr
                },
            }),
        ];
    },

    addNodeView() {
        return ({ node, editor, getPos }) => {
            const dom = document.createElement("span");
            dom.classList.add("neo-math-inline");

            const renderInline = (latex: string) => {
                if (!latex.trim()) {
                    dom.textContent = "$...$";
                    return;
                }
                try {
                    katex.render(latex, dom, {
                        displayMode: false,
                        throwOnError: false,
                    });
                } catch {
                    dom.textContent = `$${latex}$`;
                }
            };

            renderInline(node.attrs.latex);

            // Double-click → convert back to editable text $...$
            dom.addEventListener("dblclick", () => {
                const pos = typeof getPos === "function" ? getPos() : null;
                if (pos == null) return;
                const { tr } = editor.state;
                const text = `$${node.attrs.latex}$`;
                tr.replaceWith(pos, pos + 1, editor.state.schema.text(text));
                editor.view.dispatch(tr);
            });

            return {
                dom,
                update: (updatedNode) => {
                    if (updatedNode.type.name !== this.name) return false;
                    renderInline(updatedNode.attrs.latex);
                    return true;
                },
            };
        };
    },
});
