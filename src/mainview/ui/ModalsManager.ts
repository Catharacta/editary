import { state } from "../state/workspace";
import { ExportModal } from "../modals/ExportModal";
import { SettingsModal } from "../modals/SettingsModal";
import { AboutModal } from "../modals/AboutModal";
import { UtilityModals } from "../modals/UtilityModals";

/**
 * Manager for main application modals.
 */
export class ModalsManager {
    /**
     * Initializes all specialized modals.
     */
    static init() {
        const exportModal = new ExportModal();
        exportModal.init();

        const settingsModal = new SettingsModal();
        settingsModal.init();

        const aboutModal = new AboutModal();
        aboutModal.init();

        UtilityModals.init();
        
        // Initial view update
        this.updateEditorView();
    }

    /**
     * Updates the editor view (e.g. line numbers) based on current settings.
     */
    static updateEditorView() {
        const editor = document.getElementById("editor");
        if (editor) {
            const shouldShow = state.editorSettings.showLineNumbers && state.currentFilePath !== null;
            editor.classList.toggle("show-line-numbers", shouldShow);
        }
    }

    /**
     * Shows a confirmation modal for unsaved changes.
     */
    static showUnsavedChanges(fileName: string) {
        return UtilityModals.showUnsaved(fileName);
    }

    /**
     * Shows a generic alert modal.
     */
    static showAlert(title: string, message: string) {
        return UtilityModals.showAlert(title, message);
    }

    /**
     * Shows a generic confirmation modal.
     */
    static showConfirm(title: string, message: string) {
        return UtilityModals.showConfirm(title, message);
    }
}
