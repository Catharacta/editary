import { electroview } from "../ipc";
import { type FileEntry } from "../../shared/types";
import { openFile, renameEntry, deleteEntry, moveEntry } from "./file-ops";
import { showContextMenu } from "../ui/context-menu";
import { state } from "../state/workspace";

// Store a map of path to HTMLElement to easily find folders for inline creation
const itemMap = new Map<string, HTMLElement>();
const childrenMap = new Map<string, HTMLElement>();

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
    itemMap.clear();
    childrenMap.clear();

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
        item.dataset.path = entry.path;
        item.dataset.type = entry.isDirectory ? "directory" : "file";
        itemMap.set(entry.path, item);
        
        // Drag & Drop
        item.draggable = true;
        item.addEventListener("dragstart", (e) => {
            if (e.dataTransfer) {
                e.dataTransfer.setData("text/plain", entry.path);
                e.dataTransfer.effectAllowed = "move";
            }
        });

        if (entry.isDirectory) {
            item.addEventListener("dragover", (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
                item.classList.add("drag-over");
            });

            item.addEventListener("dragleave", () => {
                item.classList.remove("drag-over");
            });

            item.addEventListener("drop", async (e) => {
                e.preventDefault();
                e.stopPropagation();
                item.classList.remove("drag-over");
                
                if (e.dataTransfer) {
                    const draggedPath = e.dataTransfer.getData("text/plain");
                    if (draggedPath && draggedPath !== entry.path) {
                        await moveEntry(draggedPath, entry.path);
                    }
                }
            });

            item.innerHTML = `
                <svg class="file-tree-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square" style="margin-right: 4px; flex-shrink: 0; transition: transform 0.1s;">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square" style="margin-right: 6px; flex-shrink: 0;">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
                <span class="file-tree-name">${entry.name}</span>
            `;
            parent.appendChild(item);

            const childrenContainer = document.createElement("div");
            childrenContainer.className = "file-tree-children";
            parent.appendChild(childrenContainer);

            item.addEventListener("click", () => {
                const isCollapsed = childrenContainer.classList.toggle("collapsed");
                item.classList.toggle("collapsed", isCollapsed);
                state.selectedPath = entry.path;
                highlightSelected(entry.path);
            });

            childrenMap.set(entry.path, childrenContainer);

            if (entry.children) {
                renderEntries(childrenContainer, entry.children, depth + 1);
            }
        } else {
            item.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square" style="margin-right: 6px; flex-shrink: 0;">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
                <span class="file-tree-name">${entry.name}</span>
            `;
            item.addEventListener("click", () => {
                state.selectedPath = entry.path;
                highlightSelected(entry.path);
                openFile(entry.path);
            });
            parent.appendChild(item);
        }

        // Context Menu
        item.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            state.selectedPath = entry.path;
            highlightSelected(entry.path);

            const menuItems = [];
            
            if (entry.isDirectory) {
                menuItems.push(
                    { label: "新規ファイル", action: () => startCreateInline(entry.path, false) },
                    { label: "新規フォルダ", action: () => startCreateInline(entry.path, true) },
                    { type: "separator" }
                );
            }

            menuItems.push(
                { label: "名前を変更", action: () => startRename(item, entry.path, entry.name) },
                { 
                    label: "削除", 
                    danger: true, 
                    action: async () => {
                        if (confirm(`本当に「${entry.name}」を削除しますか？`)) {
                            await deleteEntry(entry.path);
                        }
                    } 
                }
            );

            showContextMenu(e.clientX, e.clientY, menuItems as any);
        });
    }
}

/**
 * Start inline renaming of a file tree item.
 */
function startRename(item: HTMLElement, path: string, oldName: string) {
    const nameSpan = item.querySelector(".file-tree-name") as HTMLElement;
    if (!nameSpan) return;

    const input = document.createElement("input");
    input.type = "text";
    input.className = "file-tree-rename-input";
    input.value = oldName;

    const finishRename = async () => {
        const newName = input.value.trim();
        if (newName && newName !== oldName) {
            await renameEntry(path, newName);
        } else {
            nameSpan.textContent = oldName;
        }
    };

    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            finishRename();
        } else if (e.key === "Escape") {
            nameSpan.textContent = oldName;
        }
    });

    input.addEventListener("blur", finishRename);

    nameSpan.innerHTML = "";
    nameSpan.appendChild(input);
    input.focus();
    
    // Select filename without extension if it's a file
    const dotIndex = oldName.lastIndexOf(".");
    if (dotIndex > 0 && !item.classList.contains("file-tree-item--directory")) {
        input.setSelectionRange(0, dotIndex);
    } else {
        input.select();
    }
}

function highlightSelected(path: string) {
    document.querySelectorAll(".file-tree-item--selected").forEach(el => el.classList.remove("file-tree-item--selected"));
    const item = itemMap.get(path);
    if (item) {
        item.classList.add("file-tree-item--selected");
    }
}

/**
 * Handle creation from header buttons
 */
export function createNewFileInSelected() {
    handleCreateRequest(false);
}

export function createNewFolderInSelected() {
    handleCreateRequest(true);
}

async function handleCreateRequest(isDirectory: boolean) {
    let parentPath = state.currentFolderPath;
    
    if (state.selectedPath) {
        // If file is selected, parent is its directory. If folder, it's the folder itself.
        const isSelectedDir = itemMap.get(state.selectedPath)?.classList.contains("file-tree-item--directory");
        if (isSelectedDir) {
            parentPath = state.selectedPath;
        } else {
            // Get parent directory of the file
            parentPath = state.selectedPath.replace(/[\\/][^\\/]*$/, "");
        }
    }

    if (!parentPath) return;
    startCreateInline(parentPath, isDirectory);
}

/**
 * Start inline creation of a file or folder.
 */
function startCreateInline(parentPath: string, isDirectory: boolean) {
    const childrenContainer = childrenMap.get(parentPath) || document.getElementById("fileTree");
    if (!childrenContainer) return;

    // Ensure parent folder is expanded if it is a directory in the tree
    const parentItem = itemMap.get(parentPath);
    if (parentItem && childrenContainer !== document.getElementById("fileTree")) {
        childrenContainer.classList.remove("collapsed");
        parentItem.classList.remove("collapsed");
    }

    const depth = parentItem ? (parseInt(parentItem.style.paddingLeft) - 16) / 16 + 1 : 0;

    const tempItem = document.createElement("div");
    tempItem.className = isDirectory ? "file-tree-item file-tree-item--directory temp-creation" : "file-tree-item temp-creation";
    tempItem.style.paddingLeft = `${16 + depth * 16}px`;
    
    const icon = isDirectory ? 
        `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square" style="margin-right: 6px; flex-shrink: 0;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>` :
        `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square" style="margin-right: 6px; flex-shrink: 0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`;

    tempItem.innerHTML = `
        ${isDirectory ? '<div style="width: 16px;"></div>' : ''}
        ${icon}
        <input type="text" class="file-tree-rename-input" placeholder="${isDirectory ? 'フォルダ名...' : 'ファイル名...'}">
    `;

    // Insert at the beginning of children
    if (childrenContainer.firstChild) {
        childrenContainer.insertBefore(tempItem, childrenContainer.firstChild);
    } else {
        childrenContainer.appendChild(tempItem);
    }

    const input = tempItem.querySelector("input") as HTMLInputElement;
    input.focus();

    const finishCreate = async () => {
        const name = input.value.trim();
        if (name) {
            try {
                if (isDirectory) {
                    await electroview.rpc?.request.createDirectory({ dirPath: parentPath, dirName: name });
                } else {
                    const newPath = await electroview.rpc?.request.createFile({ dirPath: parentPath, fileName: name });
                    if (newPath) await openFile(newPath);
                }
                // Reload tree
                if (state.currentFolderPath) {
                    await loadFileTree(state.currentFolderPath);
                }
            } catch (error) {
                console.error("Failed to create:", error);
                tempItem.remove();
            }
        } else {
            tempItem.remove();
        }
    };

    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            finishCreate();
        } else if (e.key === "Escape") {
            tempItem.remove();
        }
    });

    input.addEventListener("blur", () => {
        // Use timeout to allow click events to process if needed
        setTimeout(() => {
            if (tempItem.parentNode) finishCreate();
        }, 100);
    });
}
