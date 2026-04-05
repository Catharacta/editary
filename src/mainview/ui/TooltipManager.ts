/**
 * Manager for the application-wide custom tooltip system.
 */
export class TooltipManager {
    private static elements = {
        tooltip: null as HTMLElement | null,
    };

    /**
     * Initializes tooltip listeners.
     */
    static init() {
        this.elements.tooltip = document.getElementById("tooltip");
        if (!this.elements.tooltip) return;

        document.addEventListener("mouseover", (e) => this.handleMouseOver(e));
        document.addEventListener("mouseout", (e) => this.handleMouseOut(e));
        document.addEventListener("click", () => this.hide());
    }

    /**
     * Mouseover handler for elements with data-tooltip.
     */
    private static handleMouseOver(e: MouseEvent) {
        const tooltip = this.elements.tooltip;
        if (!tooltip) return;

        const target = (e.target as HTMLElement).closest("[data-tooltip]");
        if (!target) return;

        const text = target.getAttribute("data-tooltip");
        if (!text) return;

        tooltip.textContent = text;
        tooltip.classList.remove("hidden");

        const rect = target.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();

        let top = rect.bottom + 8;
        let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);

        // Positioning logic (keep within viewport)
        if (left < 4) left = 4;
        if (left + tooltipRect.width > window.innerWidth - 4) {
            left = window.innerWidth - tooltipRect.width - 4;
        }
        if (top + tooltipRect.height > window.innerHeight - 4) {
            top = rect.top - tooltipRect.height - 8;
        }

        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
    }

    /**
     * Mouseout handler.
     */
    private static handleMouseOut(e: MouseEvent) {
        const target = (e.target as HTMLElement).closest("[data-tooltip]");
        if (target) {
            this.hide();
        }
    }

    /**
     * Hides the current tooltip.
     */
    static hide() {
        this.elements.tooltip?.classList.add("hidden");
    }
}
