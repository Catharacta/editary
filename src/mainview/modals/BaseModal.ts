/**
 * Base class for all modals.
 */
export abstract class BaseModal {
    protected container: HTMLElement | null;
    protected isVisible: boolean = false;

    constructor(containerId: string) {
        this.container = document.getElementById(containerId);
        this.setupCommonListeners();
    }

    /**
     * Set up common event listeners (e.g., clicking outside to close).
     */
    private setupCommonListeners() {
        if (!this.container) return;

        this.container.addEventListener("click", (e) => {
            if (e.target === this.container) {
                this.hide();
            }
        });
    }

    /**
     * Show the modal.
     */
    show(): void {
        if (this.container) {
            this.container.classList.remove("hidden");
            this.isVisible = true;
            this.onShow();
        }
    }

    /**
     * Hide the modal.
     */
    hide(): void {
        if (this.container) {
            this.container.classList.add("hidden");
            this.isVisible = false;
            this.onHide();
        }
    }

    /**
     * Hook called when the modal is shown.
     */
    protected onShow(): void {}

    /**
     * Hook called when the modal is hidden.
     */
    protected onHide(): void {}

    /**
     * Initialize modal-specific elements and listeners.
     */
    abstract init(): void;
}
