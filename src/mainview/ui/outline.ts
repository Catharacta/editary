import { Editor } from "@tiptap/core";
import { state } from "../state/workspace";
import { t } from "../utils/i18n";

export function setupOutline() {
    const refreshBtn = document.getElementById("refreshOutlineBtn");
    refreshBtn?.addEventListener("click", () => {
        if (state.editor) {
            renderOutline(state.editor);
        }
    });

    // Handle section toggle for outline
    document.querySelector("#outlineSection .section-header")?.addEventListener("click", (e) => {
        if ((e.target as HTMLElement).closest(".section-actions")) return;
        const content = document.getElementById("outlineList");
        const header = document.querySelector("#outlineSection .section-header");
        const isCollapsed = content?.classList.toggle("collapsed");
        header?.classList.toggle("collapsed", isCollapsed);
    });
}

export function renderOutline(editor: Editor) {
    const outlineList = document.getElementById("outlineList");
    if (!outlineList) return;

    const headings: { text: string; level: number; pos: number }[] = [];

    editor.state.doc.descendants((node, pos) => {
        if (node.type.name === "heading") {
            headings.push({
                text: node.textContent || t("outline.emptyHeading"),
                level: node.attrs.level,
                pos: pos,
            });
        }
    });

    if (headings.length === 0) {
        outlineList.innerHTML = `<div class="outline-empty">${t("sidebar.noHeadings")}</div>`;
        return;
    }

    outlineList.innerHTML = "";
    headings.forEach((heading) => {
        const item = document.createElement("div");
        item.className = "outline-item";
        item.setAttribute("data-level", heading.level.toString());
        item.textContent = heading.text;
        
        item.addEventListener("click", () => {
            editor.commands.focus();
            editor.commands.setTextSelection(heading.pos);
            
            // Highlight active item
            document.querySelectorAll(".outline-item").forEach(el => el.classList.remove("outline-item--active"));
            item.classList.add("outline-item--active");
            
            // Smooth scroll to the node
            const node = editor.view.nodeDOM(heading.pos) as HTMLElement;
            if (node) {
                node.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        });

        outlineList.appendChild(item);
    });
}
