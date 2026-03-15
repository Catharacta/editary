import CodeBlock from "@tiptap/extension-code-block";
import mermaid from "mermaid";

// Initialize mermaid with a safe config
mermaid.initialize({
    startOnLoad: false,
    theme: "default",
    securityLevel: "loose",
});

/**
 * EditaryCodeBlock — Extends @tiptap/extension-code-block.
 *
 * When language === "mermaid", renders a split-view:
 *   ┌─────────────────────────────┐
 *   │  code editor  (contentDOM)  │  ← ProseMirror manages text
 *   ├─────────────────────────────┤
 *   │  Mermaid SVG preview        │  ← re-rendered on every update (debounced)
 *   └─────────────────────────────┘
 *
 * For all other languages, renders the standard <pre><code>.
 */
export const EditaryCodeBlock = CodeBlock.extend({
    addNodeView() {
        return ({ node, editor, getPos }) => {
            const language = (node.attrs.language || "").toLowerCase();
            const isMermaid = language === "mermaid";

            if (!isMermaid) {
                // ─── Standard code block ───
                const pre = document.createElement("pre");
                const code = document.createElement("code");
                if (language) {
                    code.classList.add(`language-${language}`);
                }
                pre.appendChild(code);

                return {
                    dom: pre,
                    contentDOM: code,
                };
            }

            // ─── Mermaid split-view ───
            const dom = document.createElement("div");
            dom.classList.add("neo-mermaid-block");

            // Upper: code editor area
            const editorArea = document.createElement("div");
            editorArea.classList.add("neo-mermaid-editor");

            const pre = document.createElement("pre");
            pre.classList.add("neo-mermaid-code");
            const code = document.createElement("code");
            pre.appendChild(code);
            editorArea.appendChild(pre);

            // Lower: preview area
            const previewArea = document.createElement("div");
            previewArea.classList.add("neo-mermaid-preview");

            dom.appendChild(editorArea);
            dom.appendChild(previewArea);

            // Debounced render function
            let renderTimer: ReturnType<typeof setTimeout> | null = null;

            const renderPreview = (text: string) => {
                if (!text.trim()) {
                    previewArea.innerHTML =
                        '<span class="empty-mermaid">< Empty Mermaid Block ></span>';
                    return;
                }

                if (renderTimer) clearTimeout(renderTimer);
                renderTimer = setTimeout(async () => {
                    try {
                        const id = "mermaid-" + Math.random().toString(36).substring(2, 9);
                        const { svg } = await mermaid.render(id, text);
                        previewArea.innerHTML = svg;
                    } catch (e: any) {
                        previewArea.innerHTML = `<div class="mermaid-error">Syntax Error: ${e.message || e}</div>`;
                    }
                }, 400);
            };

            // Initial render
            renderPreview(node.textContent);

            return {
                dom,
                contentDOM: code,
                update: (updatedNode) => {
                    // If the node type changed, or language is no longer mermaid,
                    // return false to force ProseMirror to rebuild the view
                    if (updatedNode.type.name !== this.name) return false;
                    const updatedLang = (updatedNode.attrs.language || "").toLowerCase();
                    if (updatedLang !== "mermaid") return false;

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
                destroy: () => {
                    if (renderTimer) clearTimeout(renderTimer);
                },
            };
        };
    },
});
