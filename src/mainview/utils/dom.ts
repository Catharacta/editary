import { state } from "../state/workspace";

export function updateTitleBar() {
    const titleEl = document.querySelector(".titlebar-title");
    if (!titleEl) return;

    const tab = state.currentFilePath ? state.openTabs.get(state.currentFilePath) : null;
    const fileName = state.currentFilePath ? state.currentFilePath.split(/[/\\]/).pop() : null;
    const isDirty = tab?.isDirty || false;

    const prefix = isDirty ? "<span style='color: #ff3333; margin-right: 4px;'>*</span>" : "";
    titleEl.innerHTML = fileName ? `${prefix}${fileName} &mdash; Editary` : "Editary";
}

export function highlightActiveFile(filePath: string) {
    document.querySelectorAll(".file-tree-item").forEach((el) => {
        el.classList.remove("file-tree-item--active");
    });
    if (filePath) {
        document
            .querySelector(`.file-tree-item[data-path="${CSS.escape(filePath)}"]`)
            ?.classList.add("file-tree-item--active");
    }
}
