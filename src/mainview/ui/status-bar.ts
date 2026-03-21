import { state } from "../state/workspace";
import { getEditorText } from "../editor";

const statusBar = document.getElementById("statusBar");
const statusLines = document.getElementById("statusLines");
const statusWords = document.getElementById("statusWords");
const statusChars = document.getElementById("statusChars");

export function updateStatusBar() {
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
    
    if (statusLines) statusLines.textContent = `行: ${lines}`;
    if (statusWords) statusWords.textContent = `単語数: ${countWords}`;
    if (statusChars) statusChars.textContent = `文字数: ${countChars}`;
}
