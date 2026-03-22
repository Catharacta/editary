import { state } from "../state/workspace";
import { getEditorText } from "../editor";
import { t } from "../utils/i18n";

export function updateStatusBar() {
    const statusBar = document.getElementById("statusBar");
    const statusLines = document.getElementById("statusLines");
    const statusWords = document.getElementById("statusWords");
    const statusChars = document.getElementById("statusChars");

    if (!state.currentFilePath || !state.editor) {
        statusBar?.classList.add("hidden");
        return;
    }
    
    statusBar?.classList.remove("hidden");
    
    const countChars = state.editor.storage.characterCount.characters();
    const countWords = state.editor.storage.characterCount.words();
    
    // Line count: based on plain text length
    const text = getEditorText(state.editor);
    const lines = text === "" ? 1 : text.split(/\r\n|\r|\n/).length;
    
    if (statusLines) statusLines.textContent = `${t("status.lines")}: ${lines}`;
    if (statusWords) statusWords.textContent = `${t("status.words")}: ${countWords}`;
    if (statusChars) statusChars.textContent = `${t("status.chars")}: ${countChars}`;
}
