import { electroview } from "../ipc";
import { type FileEntry } from "../../shared/types";
import { openFile, renameEntry, deleteEntry, moveEntry } from "./file-ops";
import { showContextMenu } from "../ui/context-menu";
import { showConfirm } from "../ui/modals";
import { state } from "../state/workspace";
import { t } from "../utils/i18n";

/**
 * Manager for the File Tree UI component.
 */
export class FileTreeManager {
    private static container: HTMLElement | null = null;
    private static itemMap = new Map<string, HTMLElement>();
    private static childrenMap = new Map<string, HTMLElement>();
    private static isInputActive = false;

    /**
     * Initializes or reloads the entire file tree.
     */
    static async load(dirPath: string = state.currentFolderPath || "") {
        if (!dirPath) return;
        
        try {
            // Root level is loaded shallowly for speed
            const entries = await electroview.rpc?.request.readDirectory({ dirPath, recursive: false });
            this.render(entries ?? []);
            
            // Re-expand previously expanded paths
            for (const path of state.expandedPaths) {
                if (path !== dirPath && path.startsWith(dirPath)) {
                    await this.expandFolder(path);
                }
            }
        } catch (error) {
            console.error("Failed to load file tree:", error);
        }
    }

    /**
     * Renders the top-level entries and clears state.
     */
    static render(entries: FileEntry[]) {
        this.container = document.getElementById("fileTree");
        if (!this.container) return;

        this.container.innerHTML = "";
        this.itemMap.clear();
        this.childrenMap.clear();

        if (entries.length === 0) {
            this.container.innerHTML = `<div class="file-tree-empty">${t("workspace.empty")}</div>`;
            return;
        }

        this.renderEntries(this.container, entries, 0);
    }

    /**
     * Internal: Recursive-style rendering for a list of entries.
     */
    private static renderEntries(parent: HTMLElement, entries: FileEntry[], depth: number) {
        for (const entry of entries) {
            const item = document.createElement("div");
            item.className = entry.isDirectory ? "file-tree-item file-tree-item--directory" : "file-tree-item";
            item.style.paddingLeft = `${16 + depth * 16}px`;
            item.dataset.path = entry.path;
            
            if (state.selectedPath === entry.path) {
                item.classList.add("file-tree-item--selected");
            }
            
            this.itemMap.set(entry.path, item);

            // Drag & Drop Setup
            this.setupDragAndDrop(item, entry);

            if (entry.isDirectory) {
                const isExpanded = state.expandedPaths.has(entry.path);
                if (isExpanded) item.classList.add("expanded");
                else item.classList.add("collapsed");

                item.innerHTML = `
                    <svg class="file-tree-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square" class="folder-icon">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <span class="file-tree-name">${entry.name}</span>
                `;
                
                item.onclick = (e) => {
                    e.stopPropagation();
                    this.toggleFolder(entry.path);
                };

                const childrenContainer = document.createElement("div");
                childrenContainer.className = isExpanded ? "file-tree-children" : "file-tree-children collapsed";
                this.childrenMap.set(entry.path, childrenContainer);
                
                parent.appendChild(item);
                parent.appendChild(childrenContainer);

                // If already expanded in state, load children
                if (isExpanded && entry.children) {
                    this.renderEntries(childrenContainer, entry.children, depth + 1);
                }
            } else {
                item.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square" class="file-icon">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                    <span class="file-tree-name">${entry.name}</span>
                `;
                item.onclick = (e) => {
                    e.stopPropagation();
                    this.selectItem(entry.path);
                    openFile(entry.path);
                };
                parent.appendChild(item);
            }

            // Context Menu
            item.oncontextmenu = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.selectItem(entry.path);
                this.showItemContextMenu(e, entry);
            };
        }
    }

    /**
     * Toggles a folder's expanded state and loads children lazily.
     */
    static async toggleFolder(path: string) {
        const item = this.itemMap.get(path);
        const childrenContainer = this.childrenMap.get(path);
        if (!item || !childrenContainer) return;

        const isExpanded = state.expandedPaths.has(path);
        
        if (isExpanded) {
            // Collapse
            state.expandedPaths.delete(path);
            item.classList.remove("expanded");
            item.classList.add("collapsed");
            childrenContainer.classList.add("collapsed");
        } else {
            // Expand
            state.expandedPaths.add(path);
            item.classList.remove("collapsed");
            item.classList.add("expanded");
            childrenContainer.classList.remove("collapsed");
            
            // Lazy load if empty
            if (childrenContainer.children.length === 0) {
                await this.loadChildren(path, childrenContainer);
            }
        }
        
        this.selectItem(path);
    }

    /**
     * Forces expansion of a specific folder (used for recovery).
     */
    static async expandFolder(path: string) {
        state.expandedPaths.add(path);
        const item = this.itemMap.get(path);
        const childrenContainer = this.childrenMap.get(path);
        
        if (item && childrenContainer) {
            item.classList.remove("collapsed");
            item.classList.add("expanded");
            childrenContainer.classList.remove("collapsed");
            if (childrenContainer.children.length === 0) {
                await this.loadChildren(path, childrenContainer);
            }
        }
    }

    /**
     * Loads immediate children of a directory and renders them.
     */
    private static async loadChildren(path: string, container: HTMLElement) {
        try {
            const entries = await electroview.rpc?.request.readDirectory({ dirPath: path, recursive: false });
            if (entries && entries.length > 0) {
                const parentItem = this.itemMap.get(path);
                const depth = parentItem ? (parseInt(parentItem.style.paddingLeft) - 16) / 16 + 1 : 0;
                this.renderEntries(container, entries, depth);
            } else {
                container.innerHTML = `<div class="file-tree-empty-small">${t("workspace.empty")}</div>`;
            }
        } catch (e) {
            console.error("Failed to lazy load directory:", path, e);
        }
    }

    /**
     * Highlights the selected item and syncs state.
     */
    static selectItem(path: string) {
        state.selectedPath = path;
        document.querySelectorAll(".file-tree-item--selected").forEach(el => el.classList.remove("file-tree-item--selected"));
        const item = this.itemMap.get(path);
        if (item) {
            item.classList.add("file-tree-item--selected");
            item.scrollIntoView({ block: "nearest" });
        }
    }

    /**
     * Setup drag and drop event listeners.
     */
    private static setupDragAndDrop(item: HTMLElement, entry: FileEntry) {
        item.draggable = true;
        item.ondragstart = (e) => {
            if (e.dataTransfer) {
                e.dataTransfer.setData("text/plain", entry.path);
                e.dataTransfer.effectAllowed = "move";
            }
        };

        if (entry.isDirectory) {
            item.ondragover = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
                item.classList.add("drag-over");
            };

            item.ondragleave = () => {
                item.classList.remove("drag-over");
            };

            item.ondrop = async (e) => {
                e.preventDefault();
                e.stopPropagation();
                item.classList.remove("drag-over");
                
                if (e.dataTransfer) {
                    const draggedPath = e.dataTransfer.getData("text/plain");
                    if (draggedPath && draggedPath !== entry.path) {
                        await moveEntry(draggedPath, entry.path);
                        this.load(); // Refresh after move
                    }
                }
            };
        }
    }

    /**
     * Show context menu for a tree item.
     */
    private static showItemContextMenu(e: MouseEvent, entry: FileEntry) {
        const item = this.itemMap.get(entry.path);
        if (!item) return;

        const menuItems = [];
        
        if (entry.isDirectory) {
            menuItems.push(
                { label: t("workspace.contextMenu.newFile"), action: () => this.startCreateInline(entry.path, false) },
                { label: t("workspace.contextMenu.newFolder"), action: () => this.startCreateInline(entry.path, true) },
                { type: "separator" }
            );
        }

        menuItems.push(
            { label: `${t("workspace.contextMenu.rename")} (F2)`, action: () => this.startRename(item, entry.path, entry.name) },
            { 
                label: `${t("workspace.contextMenu.delete")} (Delete)`, 
                danger: true, 
                action: () => this.handleDelete(entry.path, entry.name) 
            }
        );

        showContextMenu(e.clientX, e.clientY, menuItems as any);
    }

    /**
     * Inline renaming logic.
     */
    static startRename(item: HTMLElement, path: string, oldName: string) {
        const nameSpan = item.querySelector(".file-tree-name") as HTMLElement;
        if (!nameSpan) return;

        this.isInputActive = true;
        const input = document.createElement("input");
        input.type = "text";
        input.className = "file-tree-rename-input";
        input.value = oldName;

        const finishRename = async () => {
            if (!this.isInputActive) return;
            this.isInputActive = false;
            const newName = input.value.trim();
            if (newName && newName !== oldName) {
                await renameEntry(path, newName);
                this.load();
            } else {
                nameSpan.textContent = oldName;
            }
        };

        input.onkeydown = (e) => {
            if (e.key === "Enter") finishRename();
            else if (e.key === "Escape") {
                this.isInputActive = false;
                nameSpan.textContent = oldName;
            }
        };

        input.onblur = finishRename;
        nameSpan.innerHTML = "";
        nameSpan.appendChild(input);
        input.focus();
        
        const dotIndex = oldName.lastIndexOf(".");
        if (dotIndex > 0 && !item.classList.contains("file-tree-item--directory")) {
            input.setSelectionRange(0, dotIndex);
        } else {
            input.select();
        }
    }

    /**
     * Inline creation logic.
     */
    static startCreateInline(parentPath: string, isDirectory: boolean) {
        const childrenContainer = this.childrenMap.get(parentPath) || this.container;
        if (!childrenContainer) return;

        this.isInputActive = true;
        this.expandFolder(parentPath);

        const parentItem = this.itemMap.get(parentPath);
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
            <input type="text" class="file-tree-rename-input" placeholder="${isDirectory ? t("workspace.contextMenu.newFolder") + '...' : t("workspace.contextMenu.newFile") + '...'}">
        `;

        if (childrenContainer.firstChild) childrenContainer.insertBefore(tempItem, childrenContainer.firstChild);
        else childrenContainer.appendChild(tempItem);

        const input = tempItem.querySelector("input") as HTMLInputElement;
        input.focus();

        const finishCreate = async () => {
            if (!this.isInputActive) return;
            this.isInputActive = false;
            const name = input.value.trim();
            if (name) {
                try {
                    if (isDirectory) {
                        await electroview.rpc?.request.createDirectory({ dirPath: parentPath, dirName: name });
                    } else {
                        const newPath = await electroview.rpc?.request.createFile({ dirPath: parentPath, fileName: name });
                        if (newPath) await openFile(newPath);
                    }
                    this.load();
                } catch (error) {
                    console.error("Failed to create:", error);
                    tempItem.remove();
                }
            } else {
                tempItem.remove();
            }
        };

        input.onkeydown = (e) => {
            if (e.key === "Enter") finishCreate();
            else if (e.key === "Escape") {
                this.isInputActive = false;
                tempItem.remove();
            }
        };

        input.onblur = () => setTimeout(finishCreate, 150);
    }

    private static async handleDelete(path: string, name: string) {
        if (await showConfirm(t("workspace.contextMenu.delete"), t("workspace.deleteConfirm", { name: name }))) {
            await deleteEntry(path);
            this.load();
        }
    }

    /**
     * Returns true if any input (rename/create) is active.
     */
    static isInputting(): boolean {
        return this.isInputActive;
    }
}
