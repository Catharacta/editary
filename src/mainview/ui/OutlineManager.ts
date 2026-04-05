import { Editor } from "@tiptap/core";
import { state } from "../state/workspace";
import { t } from "../utils/i18n";

/**
 * Manager for the document outline (table of contents) UI component.
 */
export class OutlineManager {
    private static elements = {
        outlineList: null as HTMLElement | null,
        refreshBtn: null as HTMLElement | null,
        header: null as HTMLElement | null,
    };

    /**
     * Initializes the outline component.
     */
    static init() {
        this.elements.outlineList = document.getElementById("outlineList");
        this.elements.refreshBtn = document.getElementById("refreshOutlineBtn");
        this.elements.header = document.querySelector("#outlineSection .section-header");

        this.elements.refreshBtn?.addEventListener("click", () => {
            if (state.editor) {
                this.render(state.editor);
            }
        });

        // Toggle section visibility
        this.elements.header?.addEventListener("click", (e) => {
            if ((e.target as HTMLElement).closest(".section-actions")) return;
            const isCollapsed = this.elements.outlineList?.classList.toggle("collapsed");
            this.elements.header?.classList.toggle("collapsed", isCollapsed);
        });
    }

    /**
     * Renders the outline based on current editor content.
     */
    static render(editor: Editor) {
        if (!this.elements.outlineList) this.init();
        const { outlineList } = this.elements;
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

        const fragment = document.createDocumentFragment();
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

            fragment.appendChild(item);
        });

        outlineList.innerHTML = "";
        outlineList.appendChild(fragment);
    }
}
