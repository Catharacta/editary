import { t } from "../utils/i18n";

/**
 * Manager for utility modals (Alert, Confirm, Unsaved Changes).
 * These are slightly different as they return Promises.
 */
export class UtilityModals {
    private static unsavedResolver: ((value: 'save' | 'discard' | 'cancel') => void) | null = null;
    private static alertResolver: (() => void) | null = null;
    private static confirmResolver: ((value: boolean) => void) | null = null;

    static init(): void {
        this.setupUnsaved();
        this.setupAlert();
        this.setupConfirm();
    }

    private static setupUnsaved() {
        const modal = document.getElementById("unsavedChangesModal");
        const resolve = (res: 'save' | 'discard' | 'cancel') => {
            modal?.classList.add("hidden");
            this.unsavedResolver?.(res);
            this.unsavedResolver = null;
        };

        document.getElementById("saveAndCloseBtn")?.addEventListener("click", () => resolve('save'));
        document.getElementById("discardAndCloseBtn")?.addEventListener("click", () => resolve('discard'));
        document.getElementById("cancelCloseBtn")?.addEventListener("click", () => resolve('cancel'));
        document.getElementById("closeUnsavedModal")?.addEventListener("click", () => resolve('cancel'));
    }

    private static setupAlert() {
        const modal = document.getElementById("utilityAlertModal");
        const resolve = () => {
            modal?.classList.add("hidden");
            this.alertResolver?.();
            this.alertResolver = null;
        };

        document.getElementById("utilityAlertOkBtn")?.addEventListener("click", resolve);
        document.getElementById("closeUtilityAlert")?.addEventListener("click", resolve);
    }

    private static setupConfirm() {
        const modal = document.getElementById("confirmModal");
        const resolve = (res: boolean) => {
            modal?.classList.add("hidden");
            this.confirmResolver?.(res);
            this.confirmResolver = null;
        };

        document.getElementById("confirmOkBtn")?.addEventListener("click", () => resolve(true));
        document.getElementById("confirmCancelBtn")?.addEventListener("click", () => resolve(false));
        document.getElementById("closeConfirm")?.addEventListener("click", () => resolve(false));
    }

    /**
     * Show unsaved changes warning.
     */
    static showUnsaved(fileName: string): Promise<'save' | 'discard' | 'cancel'> {
        return new Promise((resolve) => {
            const modal = document.getElementById("unsavedChangesModal");
            const message = document.getElementById("unsavedChangesMessage");
            if (message) message.innerText = t("unsaved.message", { filename: fileName });
            
            this.unsavedResolver = resolve;
            modal?.classList.remove("hidden");
        });
    }

    /**
     * Show an alert message.
     */
    static showAlert(title: string, message: string): Promise<void> {
        return new Promise((resolve) => {
            const modal = document.getElementById("utilityAlertModal");
            const titleEl = document.getElementById("utilityAlertTitle");
            const messageEl = document.getElementById("utilityAlertMessage");

            if (titleEl) titleEl.innerText = title;
            if (messageEl) messageEl.innerText = message;

            this.alertResolver = resolve;
            modal?.classList.remove("hidden");
        });
    }

    /**
     * Show a confirmation dialog.
     */
    static showConfirm(title: string, message: string): Promise<boolean> {
        return new Promise((resolve) => {
            const modal = document.getElementById("confirmModal");
            const titleEl = document.getElementById("confirmTitle");
            const messageEl = document.getElementById("confirmMessage");

            if (titleEl) titleEl.innerText = title;
            if (messageEl) messageEl.innerText = message;

            this.confirmResolver = resolve;
            modal?.classList.remove("hidden");
        });
    }
}
