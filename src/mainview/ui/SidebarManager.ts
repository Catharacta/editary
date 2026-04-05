import { IpcManager } from "../ipc/IpcManager";
import { state } from "../state/workspace";
import { loadFileTree, createNewFileInSelected, createNewFolderInSelected } from "../workspace/file-tree";
import { saveAllFiles, closeAllTabs, createNewFile, createNewFolder } from "../workspace/file-ops";
import { initSidebarLayout } from "./sidebar-layout";

/**
 * Manager for the Sidebar UI component.
 * Handles the file tree, workspace sections, and folder operations.
 */
export class SidebarManager {
    private static isPathChoosing = false;
    private static elements = {
        sidebar: null as HTMLElement | null,
        fileTree: null as HTMLElement | null,
        openFolderPrompt: null as HTMLElement | null,
        workspaceActions: null as HTMLElement | null,
        btnSidebarToggle: null as HTMLElement | null,
    };

    /**
     * Initializes the sidebar and binds all events.
     */
    static init() {
        initSidebarLayout();

        this.elements.sidebar = document.getElementById("sidebar");
        this.elements.fileTree = document.getElementById("fileTree");
        this.elements.openFolderPrompt = document.getElementById("openFolderPrompt");
        this.elements.workspaceActions = document.querySelector("#workspaceSection .section-actions");
        this.elements.btnSidebarToggle = document.getElementById("btnSidebarToggle");

        const openFolderBtn = document.getElementById("openFolderBtn");
        const closeWorkspaceBtn = document.getElementById("closeWorkspaceBtn");
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
        this.setupSectionToggle("#openEditorsSection", "openEditorsList");
        this.setupSectionToggle("#workspaceSection", "fileTree");

        // Sidebar Visibility Toggle
        this.elements.btnSidebarToggle?.addEventListener("click", () => {
            this.elements.sidebar?.classList.toggle("hidden");
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
        newFileBtn?.addEventListener("click", () => createNewFileInSelected());
        newFolderBtn?.addEventListener("click", () => createNewFolderInSelected());
        collapseAllBtn?.addEventListener("click", () => {
            if (state.currentFolderPath) loadFileTree(state.currentFolderPath);
        });

        // Folder Logic
        openFolderBtn?.addEventListener("click", () => this.openFolder());
        closeWorkspaceBtn?.addEventListener("click", () => {
            state.currentFolderPath = null;
            this.updateVisibility();
        });

        // Initial state
        this.updateVisibility();
    }

    /**
     * Handles section header click to toggle collapse.
     */
    private static setupSectionToggle(sectionSelector: string, contentId: string) {
        const header = document.querySelector(`${sectionSelector} .section-header`);
        const content = document.getElementById(contentId);

        header?.addEventListener("click", (e) => {
            // Don't toggle if an action button was clicked
            if ((e.target as HTMLElement).closest(".section-actions")) return;
            
            const isCollapsed = content?.classList.toggle("collapsed");
            header.classList.toggle("collapsed", isCollapsed);
        });
    }

    /**
     * Opens the folder selection dialog.
     */
    static async openFolder() {
        if (this.isPathChoosing) return;
        this.isPathChoosing = true;

        try {
            const dirPath = await IpcManager.openFolder();
            if (dirPath) {
                state.currentFolderPath = dirPath;
                await loadFileTree(dirPath);
                this.updateVisibility();
            }
        } finally {
            this.isPathChoosing = false;
        }
    }

    /**
     * Updates visibility of sections based on whether a folder is open.
     */
    static updateVisibility() {
        if (!this.elements.fileTree) {
            // Re-fetch if not initialized yet
            this.elements.fileTree = document.getElementById("fileTree");
            this.elements.openFolderPrompt = document.getElementById("openFolderPrompt");
            this.elements.workspaceActions = document.querySelector("#workspaceSection .section-actions");
        }

        const { fileTree, openFolderPrompt, workspaceActions } = this.elements;

        if (!state.currentFolderPath) {
            if (fileTree) fileTree.innerHTML = "";
            fileTree?.classList.add("hidden");
            openFolderPrompt?.classList.remove("hidden");
            workspaceActions?.classList.add("hidden");
        } else {
            fileTree?.classList.remove("hidden");
            openFolderPrompt?.classList.add("hidden");
            workspaceActions?.classList.remove("hidden");
        }
    }

    /**
     * Toggles sidebar hidden state.
     */
    static toggle() {
        this.elements.sidebar?.classList.toggle("hidden");
    }
}
