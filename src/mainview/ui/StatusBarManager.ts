import { state } from "../state/workspace";
import { getEditorText } from "../editor";
import { t } from "../utils/i18n";

/**
 * Manager for the status bar UI component.
 */
export class StatusBarManager {
    private static elements = {
        statusBar: null as HTMLElement | null,
        statusLines: null as HTMLElement | null,
        statusWords: null as HTMLElement | null,
        statusChars: null as HTMLElement | null,
    };

    /**
     * Initializes the status bar elements.
     */
    static init() {
        this.elements.statusBar = document.getElementById("statusBar");
        this.elements.statusLines = document.getElementById("statusLines");
        this.elements.statusWords = document.getElementById("statusWords");
        this.elements.statusChars = document.getElementById("statusChars");
    }

    /**
     * Updates the status bar with current editor metrics.
     */
    static update() {
        if (!this.elements.statusBar) {
            this.init();
        }

        const { statusBar, statusLines, statusWords, statusChars } = this.elements;

        if (!state.currentFilePath || !state.editor) {
            statusBar?.classList.add("hidden");
            return;
        }

        statusBar?.classList.remove("hidden");

        // Metrics from TipTap character count extension
        const countChars = state.editor.storage.characterCount.characters();
        const countWords = state.editor.storage.characterCount.words();

        // Line count based on raw text
        const text = getEditorText(state.editor);
        const lines = text === "" ? 1 : text.split(/\r\n|\r|\n/).length;

        if (statusLines) statusLines.textContent = `${t("status.lines")}: ${lines}`;
        if (statusWords) statusWords.textContent = `${t("status.words")}: ${countWords}`;
        if (statusChars) statusChars.textContent = `${t("status.chars")}: ${countChars}`;
    }

    /**
     * Hides the status bar.
     */
    static hide() {
        if (!this.elements.statusBar) this.init();
        this.elements.statusBar?.classList.add("hidden");
    }
}
