import { electroview } from "../ipc";
import { state } from "../state/workspace";
import { loadFileTree } from "../workspace/file-tree";
import { saveAllFiles, closeAllTabs, createNewFile, createNewFolder } from "../workspace/file-ops";

let isPathChoosing = false;

import { initSidebarLayout } from "./sidebar-layout";

export function setupSidebar() {
    initSidebarLayout();
    const sidebar = document.getElementById("sidebar");
    const openFolderBtn = document.getElementById("openFolderBtn");
    const closeWorkspaceBtn = document.getElementById("closeWorkspaceBtn");

    // Titlebar sidebar actions
    const btnSidebarToggle = document.getElementById("btnSidebarToggle");
    const btnRefresh = document.getElementById("refreshBtn");

    // Action Buttons - Editor Section
    const newFileFromEditorsBtn = document.getElementById("newFileFromEditorsBtn");
    const saveAllBtn = document.getElementById("saveAllBtn");
    const closeAllBtn = document.getElementById("closeAllBtn");

    // Action Buttons - Workspace Section
    const newFileBtn = document.getElementById("newFileBtn");
    const newFolderBtn = document.getElementById("newFolderBtn");
    const collapseAllBtn = document.getElementById("collapseAllBtn");

    // Section toggles
    document.querySelector("#openEditorsSection .section-header")?.addEventListener("click", (e) => {
        if ((e.target as HTMLElement).closest(".section-actions")) return;
        const content = document.getElementById("openEditorsList");
        const header = document.querySelector("#openEditorsSection .section-header");
        const isCollapsed = content?.classList.toggle("collapsed");
        header?.classList.toggle("collapsed", isCollapsed);
    });

    document.querySelector("#workspaceSection .section-header")?.addEventListener("click", (e) => {
        if ((e.target as HTMLElement).closest(".section-actions")) return;
        const content = document.getElementById("fileTree");
        const header = document.querySelector("#workspaceSection .section-header");
        const isCollapsed = content?.classList.toggle("collapsed");
        header?.classList.toggle("collapsed", isCollapsed);
    });

    // Sidebar Visibility
    btnSidebarToggle?.addEventListener("click", () => {
        sidebar?.classList.toggle("hidden");
    });

    // Refresh
    btnRefresh?.addEventListener("click", () => {
        if (state.currentFolderPath) {
            loadFileTree(state.currentFolderPath);
        }
    });

    // Editor Actions
    newFileFromEditorsBtn?.addEventListener("click", () => createNewFile());
    saveAllBtn?.addEventListener("click", () => saveAllFiles());
    closeAllBtn?.addEventListener("click", () => closeAllTabs());

    // Workspace Actions
    newFileBtn?.addEventListener("click", () => createNewFile());
    newFolderBtn?.addEventListener("click", () => createNewFolder());
    collapseAllBtn?.addEventListener("click", () => {
        // Simple implementation: just refresh for now
        if (state.currentFolderPath) loadFileTree(state.currentFolderPath);
    });

    // Folder Logic
    openFolderBtn?.addEventListener("click", () => openFolder());
    closeWorkspaceBtn?.addEventListener("click", () => {
        state.currentFolderPath = null;
        updateSidebarVisibility();
    });

    // Initial state
    updateSidebarVisibility();
}

export async function openFolder() {
    if (isPathChoosing) return;
    isPathChoosing = true;

    try {
        const dirPath = await electroview.rpc?.request.openFolder({});
        if (dirPath) {
            state.currentFolderPath = dirPath;
            await loadFileTree(dirPath);
            updateSidebarVisibility();
        }
    } catch (error) {
        console.error("Failed to open folder:", error);
    } finally {
        isPathChoosing = false;
    }
}

export function updateSidebarVisibility() {
    const fileTree = document.getElementById("fileTree");
    const openFolderPrompt = document.getElementById("openFolderPrompt");

    if (!state.currentFolderPath) {
        if (fileTree) fileTree.innerHTML = "";
        fileTree?.classList.add("hidden");
        openFolderPrompt?.classList.remove("hidden");
    } else {
        fileTree?.classList.remove("hidden");
        openFolderPrompt?.classList.add("hidden");
    }
}
