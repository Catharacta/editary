import { electroview } from "../ipc";
import { type FileEntry } from "../../shared/types";
import { openFile } from "./file-ops";

export async function loadFileTree(dirPath: string) {
    try {
        const entries = await electroview.rpc?.request.readDirectory({ dirPath });
        renderFileTree(entries ?? []);
    } catch (error) {
        console.error("Failed to load file tree:", error);
    }
}

export function renderFileTree(entries: FileEntry[]) {
    const container = document.getElementById("fileTree");
    if (!container) return;

    container.innerHTML = "";

    if (entries.length === 0) {
        container.innerHTML = `<div class="file-tree-empty">Markdownファイルが見つかりません</div>`;
        return;
    }

    renderEntries(container, entries, 0);
}

function renderEntries(parent: HTMLElement, entries: FileEntry[], depth: number) {
    for (const entry of entries) {
        const item = document.createElement("div");
        item.className = entry.isDirectory ? "file-tree-item file-tree-item--directory" : "file-tree-item";
        item.style.paddingLeft = `${16 + depth * 16}px`;

        if (entry.isDirectory) {
            item.innerHTML = `
                <svg class="file-tree-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square" style="margin-right: 4px; flex-shrink: 0; transition: transform 0.1s;">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square" style="margin-right: 6px; flex-shrink: 0;">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${entry.name}</span>
            `;
            parent.appendChild(item);

            const childrenContainer = document.createElement("div");
            childrenContainer.className = "file-tree-children";
            parent.appendChild(childrenContainer);

            item.addEventListener("click", () => {
                const isCollapsed = childrenContainer.classList.toggle("collapsed");
                item.classList.toggle("collapsed", isCollapsed);
            });

            if (entry.children) {
                renderEntries(childrenContainer, entry.children, depth + 1);
            }
        } else {
            item.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square" style="margin-right: 6px; flex-shrink: 0;">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${entry.name}</span>
            `;
            item.dataset.path = entry.path;
            item.addEventListener("click", () => openFile(entry.path));
            parent.appendChild(item);
        }
    }
}
