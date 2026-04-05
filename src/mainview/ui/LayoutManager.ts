/**
 * Manager for layout adjustments like sidebar resizing.
 */
export class LayoutManager {
    private static isResizing = false;
    private static currentWidth = 250;
    private static minWidth = 150;
    private static maxWidth = 600;

    static init() {
        const resizer = document.getElementById("sidebarResizer");
        const root = document.documentElement;

        if (!resizer) return;

        // Restore initial width from local storage
        const savedWidth = localStorage.getItem("editary-sidebar-width");
        if (savedWidth) {
            this.currentWidth = parseInt(savedWidth);
            root.style.setProperty("--sidebar-width", `${this.currentWidth}px`);
        }

        resizer.addEventListener("mousedown", (e) => {
            this.isResizing = true;
            document.body.classList.add("resizing");
            resizer.classList.add("resizing");
            e.preventDefault();
        });

        window.addEventListener("mousemove", (e) => {
            if (!this.isResizing) return;

            const activityBarWidth = 48; // Fixed width from CSS
            this.currentWidth = e.clientX - activityBarWidth;

            if (this.currentWidth < this.minWidth) this.currentWidth = this.minWidth;
            if (this.currentWidth > this.maxWidth) this.currentWidth = this.maxWidth;

            root.style.setProperty("--sidebar-width", `${this.currentWidth}px`);
        });

        window.addEventListener("mouseup", () => {
            if (this.isResizing) {
                this.isResizing = false;
                document.body.classList.remove("resizing");
                resizer.classList.remove("resizing");
                
                // Save final width to local storage
                localStorage.setItem("editary-sidebar-width", this.currentWidth.toString());
            }
        });
    }
}
