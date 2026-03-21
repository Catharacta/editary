export function setupTooltips() {
    const tooltip = document.getElementById("tooltip");
    if (!tooltip) return;

    document.addEventListener("mouseover", (e) => {
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

        // Keep inside window
        if (left < 4) left = 4;
        if (left + tooltipRect.width > window.innerWidth - 4) {
            left = window.innerWidth - tooltipRect.width - 4;
        }
        if (top + tooltipRect.height > window.innerHeight - 4) {
            top = rect.top - tooltipRect.height - 8;
        }

        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
    });

    document.addEventListener("mouseout", (e) => {
        const target = (e.target as HTMLElement).closest("[data-tooltip]");
        if (target) {
            tooltip.classList.add("hidden");
        }
    });

    // Also hide on click to avoid sticky tooltips
    document.addEventListener("click", () => {
        tooltip.classList.add("hidden");
    });
}
