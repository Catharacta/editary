import { Electroview } from "electrobun/view";
import { type EditaryRPCType, type FileEntry } from "../shared/types";
import { createEditor, setEditorContent, getEditorHTML, getEditorText, reparseContent } from "./editor";
import { markdownToHtml, htmlToMarkdown } from "./markdown-parser";

// ========================================
// State
// ========================================
let currentFilePath: string | null = null;
let currentFolderPath: string | null = null;

type TabState = {
    filePath: string;
    isDirty: boolean;
    isUntitled?: boolean;
    cachedContent?: string; // HTML content cached in memory for tab switching
};
const openTabs: Map<string, TabState> = new Map();
let untitledCount = 0;

// ========================================
// Electroview + RPC
// ========================================
const rpc = Electroview.defineRPC<EditaryRPCType>({
    maxRequestTime: 300000, // 5 minutes (must match Bun side — native dialogs block until user acts)
    handlers: {
        requests: {},
        messages: {
            fileSaved: ({ filePath }) => {
                const tab = openTabs.get(filePath);
                if (tab) {
                    tab.isDirty = false;
                    renderOpenTabs();
                    if (currentFilePath === filePath) {
                        updateTitleBar();
                    }
                }
            },
        },
    },
});

const electroview = new Electroview({ rpc });

// ========================================
// Initialize Tiptap Editor
// ========================================
const editorElement = document.getElementById("editor");
const tableBubbleMenu = document.getElementById("tableBubbleMenu");

if (!editorElement) {
    throw new Error("Editor element not found");
}

const editor = createEditor(editorElement, tableBubbleMenu);
editor.setEditable(false); // Disable until a file is opened

// Track changes for dirty state
editor.on("update", () => {
    if (currentFilePath) {
        const tab = openTabs.get(currentFilePath);
        if (tab && !tab.isDirty) {
            tab.isDirty = true;
            renderOpenTabs();
            updateTitleBar();
        }
    }
    updateStatusBar();
});

// ========================================
// Editor Toolbar Actions
// ========================================
const editorToolbar = document.getElementById("editorToolbar");
const updateBtn = document.getElementById("updateContentBtn");
const syntaxStatus = document.getElementById("syntaxStatus");
const syntaxStatusText = document.getElementById("syntaxStatusText");
const statusIconInfo = document.getElementById("statusIconInfo");
const statusIconWarning = document.getElementById("statusIconWarning");

updateBtn?.addEventListener("click", () => {
    const result = reparseContent(editor);
    showSyntaxStatus(result.message, result.success ? "info" : "warning");
});

function showSyntaxStatus(message: string, type: "info" | "warning") {
    if (!syntaxStatus || !syntaxStatusText) return;

    syntaxStatusText.textContent = message;
    syntaxStatus.className = `syntax-status ${type === "warning" ? "syntax-status--warning" : ""}`;
    
    // Toggle SVG icons
    statusIconInfo?.classList.toggle("hidden", type !== "info");
    statusIconWarning?.classList.toggle("hidden", type !== "warning");
    
    syntaxStatus.classList.remove("hidden");

    // Auto-hide after 3 seconds
    setTimeout(() => {
        syntaxStatus.classList.add("hidden");
    }, 3000);
}

// ========================================
// Window Controls
// ========================================
document.getElementById("closeBtn")?.addEventListener("click", () => {
    electroview.rpc?.send.closeWindow({});
});

document.getElementById("minimizeBtn")?.addEventListener("click", () => {
    electroview.rpc?.send.minimizeWindow({});
});

document.getElementById("maximizeBtn")?.addEventListener("click", () => {
    electroview.rpc?.send.maximizeWindow({});
});

// ========================================
// UI Sections & Toggles
// ========================================
function setupToggles() {
    const editToggle = document.getElementById("openEditorsToggle");
    const editContent = document.getElementById("openEditorsList");
    editToggle?.addEventListener("click", () => {
        document.getElementById("openEditorsSection")?.querySelector(".section-header")?.classList.toggle("collapsed");
        editContent?.classList.toggle("collapsed");
    });

    const workToggle = document.getElementById("workspaceToggle");
    const workContent = document.getElementById("fileTree");
    workToggle?.addEventListener("click", () => {
        document.getElementById("workspaceSection")?.querySelector(".section-header")?.classList.toggle("collapsed");
        workContent?.classList.toggle("collapsed");
    });
}
setupToggles();

function updateSidebarVisibility() {
    const workspaceSec = document.getElementById("workspaceSection");
    const prompt = document.getElementById("openFolderPrompt");
    if (currentFolderPath) {
        workspaceSec!.style.display = "flex";
        prompt!.style.display = "none";
    } else {
        workspaceSec!.style.display = "none";
        prompt!.style.display = "block";
    }
}

// ========================================
// Open Folder
// ========================================
document.getElementById("openFolderBtn")?.addEventListener("click", openFolder);

async function openFolder() {
    // Try native dialog first, fall back to manual path input
    try {
        const folderPath = await electroview.rpc?.request.openFolder({});
        if (folderPath) {
            currentFolderPath = folderPath;
            updateSidebarVisibility();
            await loadFileTree(folderPath);
            return;
        }
        
        // if user cancelled the natived dialog, folderPath will be null, so exit.
        if (folderPath === null) {
            return;
        }
    } catch (error) {
        console.error("openFolder RPC failed (likely FFI timeout on Windows):", error);
    }

    // Fallback: Use PowerShell native dialog instead of manual text prompt
    try {
        const manualPath = await electroview.rpc?.request.showFolderBrowserDialog({
            title: "ワークスペースとするフォルダを選択してください"
        });

        if (manualPath) {
            currentFolderPath = manualPath;
            updateSidebarVisibility();
            await loadFileTree(manualPath);
        }
    } catch (error) {
        console.error("showFolderBrowserDialog RPC failed or timed out:", error);
    }
}

// ========================================
// Workspace Actions
// ========================================
document.getElementById("newFileBtn")?.addEventListener("click", createNewFile);
document.getElementById("newFolderBtn")?.addEventListener("click", createNewFolder);
document.getElementById("refreshBtn")?.addEventListener("click", () => {
    if (currentFolderPath) loadFileTree(currentFolderPath);
});
document.getElementById("closeWorkspaceBtn")?.addEventListener("click", () => {
    currentFolderPath = null;
    const container = document.getElementById("fileTree");
    if (container) container.innerHTML = "";
    updateSidebarVisibility();
});
document.getElementById("collapseAllBtn")?.addEventListener("click", () => {
    // Implement tree collapse if needed
});

async function createNewFile() {
    untitledCount++;
    const virtualPath = `Untitled-${untitledCount}`;

    openTabs.set(virtualPath, {
        filePath: virtualPath,
        isDirty: false,
        isUntitled: true,
    });

    // Switch to the new untitled tab
    await switchToTab(virtualPath);
}

async function createNewFolder() {
    if (!currentFolderPath) return;

    try {
        const selectedPath = await electroview.rpc?.request.showFolderBrowserDialog({
            defaultPath: currentFolderPath,
            title: "新しいフォルダを作成・選択"
        });

        if (selectedPath) {
            // The directory was created/selected in the native dialog. Just refresh the tree.
            await loadFileTree(currentFolderPath);
        }
    } catch (error) {
        console.error("Failed to sequence folder creation:", error);
    }
}

// ========================================
// Open Editors Actions
// ========================================
document.getElementById("newFileFromEditorsBtn")?.addEventListener("click", createNewFile);
document.getElementById("saveAllBtn")?.addEventListener("click", async () => {
    for (const [path, tab] of openTabs.entries()) {
        if (tab.isDirty) {
            // Save logic
            // Since our saveCurrentFile only saves the current one, let's make a generic save
            await saveFile(path);
        }
    }
});
document.getElementById("closeAllBtn")?.addEventListener("click", async () => {
    // Collect paths to avoid mutating map while iterating
    const paths = Array.from(openTabs.keys());
    for (const p of paths) {
        await closeTab(p);
    }
});

// ========================================
// File Tree Rendering
// ========================================
async function loadFileTree(dirPath: string) {
    try {
        const entries = await electroview.rpc?.request.readDirectory({ dirPath });
        renderFileTree(entries ?? []);
    } catch (error) {
        console.error("Failed to load file tree:", error);
    }
}

function renderFileTree(entries: FileEntry[]) {
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square" style="margin-right: 6px; flex-shrink: 0;">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${entry.name}</span>
            `;
            parent.appendChild(item);
            if (entry.children) {
                renderEntries(parent, entry.children, depth + 1);
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

// ========================================
// Open Tabs Rendering
// ========================================
function renderOpenTabs() {
    const list = document.getElementById("openEditorsList");
    if (!list) return;

    list.innerHTML = "";

    for (const [path, tab] of openTabs.entries()) {
        const fileName = path.split(/[/\\]/).pop() || "";
        const dirName = path.substring(0, path.length - fileName.length - 1).split(/[/\\]/).pop() || "";

        const item = document.createElement("div");
        item.className = `open-editor-tab ${currentFilePath === path ? "open-editor-tab--active" : ""}`;
        item.dataset.path = path;

        item.innerHTML = `
            <span class="open-editor-tab-name">${fileName}</span>
            <span class="open-editor-tab-dir">${dirName}</span>
            <div class="open-editor-tab-status">
                ${tab.isDirty ? '<div class="open-editor-tab-dirty"></div>' : ''}
                <button class="open-editor-tab-close" title="閉じる">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
        `;

        item.addEventListener("click", (e) => {
            // Check if clicking close btn
            const target = e.target as HTMLElement;
            if (target.closest(".open-editor-tab-close")) {
                e.stopPropagation();
                closeTab(path);
            } else {
                switchToTab(path);
            }
        });

        list.appendChild(item);
    }
}

async function closeTab(filePath: string) {
    const tab = openTabs.get(filePath);
    if (!tab) return;

    if (tab.isDirty && currentFilePath === filePath) {
        // Using confirm logic. Ideally should switch to tab first if it's dirty and close another tab.
        switchToTab(filePath);
        const fileName = tab.isUntitled ? tab.filePath : filePath;
        const confirmed = confirm(`ファイル ${fileName} に未保存の変更があります。保存しますか？`);
        if (confirmed) {
            await saveFile(filePath);
        }
    }

    // After attempting save, if it's still dirty (meaning they cancelled the save dialog),
    // we should probably abort closing. But for MVP, confirm means "yes save it", 
    // if save fails or is cancelled, do we close?
    // Let's check if the user actually saved it:
    if (tab.isDirty && currentFilePath === filePath) {
        // If they said yes but cancelled the prompt, it remains dirty.
        // We'll ask "本当に破棄して閉じますか？" if it's still dirty.
        // Or simpler: just close it if they said "No" to the first confirm.
        // If they said "Yes" but cancelled the save prompt, it's still dirty. Do not close.
        if (openTabs.get(filePath)?.isDirty) {
            const forceClose = confirm("保存されませんでした。変更を破棄してタブを閉じますか？");
            if (!forceClose) return;
        }
    }

    openTabs.delete(filePath);

    if (currentFilePath === filePath) {
        // Pick the last tab to open, or clear
        const remaining = Array.from(openTabs.keys());
        if (remaining.length > 0) {
            switchToTab(remaining[remaining.length - 1]);
        } else {
            currentFilePath = null;
            setEditorContent(editor, "");
            editor.setEditable(false);
            editorToolbar?.classList.add("hidden");
            updateTitleBar();
            renderOpenTabs();
            highlightActiveFile("");
            updateStatusBar();
        }
    } else {
        renderOpenTabs();
    }
}

async function switchToTab(filePath: string) {
    if (currentFilePath === filePath) return;

    // Cache current editor content before switching (non-blocking, no confirm)
    if (currentFilePath) {
        const curTab = openTabs.get(currentFilePath);
        if (curTab) {
            curTab.cachedContent = getEditorHTML(editor);
        }
    }

    try {
        const targetTab = openTabs.get(filePath);

        if (targetTab?.cachedContent !== undefined) {
            // Restore from in-memory cache
            setEditorContent(editor, targetTab.cachedContent);
        } else if (targetTab?.isUntitled) {
            // Brand-new untitled tab with no cached content yet
            setEditorContent(editor, "");
        } else {
            // Load from disk (first open)
            const content = await electroview.rpc?.request.readFile({ filePath });
            const html = markdownToHtml(content ?? "");
            setEditorContent(editor, html);
        }

        editor.setEditable(true);
        editorToolbar?.classList.remove("hidden");
        currentFilePath = filePath;

        updateTitleBar();
        renderOpenTabs();
        highlightActiveFile(filePath);
        editor.commands.focus("start");
        updateStatusBar();
    } catch (error) {
        console.error("Failed to load tab:", error);
    }
}

// ========================================
// File Operations
// ========================================
async function openFile(filePath: string) {
    if (!openTabs.has(filePath)) {
        openTabs.set(filePath, { filePath, isDirty: false, isUntitled: false });
    }
    await switchToTab(filePath);
}

async function saveFile(filePath: string) {
    if (currentFilePath !== filePath) return;
    const tab = openTabs.get(filePath);
    if (!tab) return;

    let targetPath = filePath;

    // Handle Untitled sequence
    if (tab.isUntitled) {
        const defaultPath = currentFolderPath ? currentFolderPath + "\\untitled.md" : "C:\\Users\\untitled.md";
        let manualPath: string | null | undefined = null;
        try {
            manualPath = await electroview.rpc?.request.showSaveFileDialog({
                defaultPath,
                title: "未保存のファイルを保存"
            });
        } catch (error) {
            console.error("showSaveFileDialog RPC failed or timed out:", error);
            return; // Exit early if dialog times out
        }

        if (!manualPath) return; // cancelled

        targetPath = manualPath;
        if (!targetPath.toLowerCase().endsWith('.md')) {
            targetPath += '.md';
        }
    }

    try {
        const html = getEditorHTML(editor);
        const markdown = htmlToMarkdown(html);

        // Write the file to disk
        const success = await electroview.rpc?.request.writeFile({
            filePath: targetPath,
            content: markdown,
        });


        if (success) {
            if (tab.isUntitled && targetPath !== filePath) {
                // If it was untitled, replace the old key with new saved file key
                openTabs.delete(filePath);
                openTabs.set(targetPath, { filePath: targetPath, isDirty: false, isUntitled: false });
                currentFilePath = targetPath;
            } else {
                tab.isDirty = false;
            }
            // Refresh file tree if the saved file is within the workspace
            if (currentFolderPath) {
                await loadFileTree(currentFolderPath);
            }
            updateTitleBar();
            renderOpenTabs();
        } else {
            console.error("[saveFile] writeFile returned false — file was NOT saved. Path:", targetPath);
        }
    } catch (error) {
        console.error("Failed to save file:", error);
    }
}

// ========================================
// UI Helpers
// ========================================
function updateTitleBar() {
    const titleEl = document.querySelector(".titlebar-title");
    if (!titleEl) return;

    const tab = currentFilePath ? openTabs.get(currentFilePath) : null;
    const fileName = currentFilePath ? currentFilePath.split(/[/\\]/).pop() : null;
    const isDirty = tab?.isDirty || false;

    const prefix = isDirty ? "<span style='color: #ff3333; margin-right: 4px;'>*</span>" : "";
    titleEl.innerHTML = fileName ? `${prefix}${fileName} &mdash; Editary` : "Editary";
}

function highlightActiveFile(filePath: string) {
    document.querySelectorAll(".file-tree-item").forEach((el) => {
        el.classList.remove("file-tree-item--active");
    });
    if (filePath) {
        document
            .querySelector(`.file-tree-item[data-path="${CSS.escape(filePath)}"]`)
            ?.classList.add("file-tree-item--active");
    }
}

// ========================================
// Status Bar Updates
// ========================================
const statusBar = document.getElementById("statusBar");
const statusLines = document.getElementById("statusLines");
const statusWords = document.getElementById("statusWords");
const statusChars = document.getElementById("statusChars");

function updateStatusBar() {
    if (!currentFilePath) {
        statusBar?.classList.add("hidden");
        return;
    }
    
    statusBar?.classList.remove("hidden");
    
    const countChars = editor.storage.characterCount.characters();
    const countWords = editor.storage.characterCount.words();
    
    // Line count: based on plain text length
    const text = getEditorText(editor);
    const lines = text === "" ? 1 : text.split(/\r\n|\r|\n/).length;
    
    if (statusLines) statusLines.textContent = `行: ${lines}`;
    if (statusWords) statusWords.textContent = `単語数: ${countWords}`;
    if (statusChars) statusChars.textContent = `文字数: ${countChars}`;
}

// Initialize UI
updateSidebarVisibility();

// ========================================
// Search & Replace Panel Logic
// ========================================
const searchPanel = document.getElementById("searchPanel");
const searchInput = document.getElementById("searchInput") as HTMLInputElement;
const replaceInput = document.getElementById("replaceInput") as HTMLInputElement;
const searchResultCount = document.getElementById("searchResultCount");
const searchPrevBtn = document.getElementById("searchPrevBtn");
const searchNextBtn = document.getElementById("searchNextBtn");
const searchCloseBtn = document.getElementById("searchCloseBtn");
const replaceRowContainer = document.getElementById("replaceRowContainer");
const toggleReplaceBtn = document.getElementById("toggleReplaceBtn");
const replaceBtn = document.getElementById("replaceBtn");
const replaceAllBtn = document.getElementById("replaceAllBtn");

let isSearchPanelVisible = false;

function toggleSearchPanel(showReplace = false) {
    if (!searchPanel) return;
    
    // If not visible, show it
    if (searchPanel.classList.contains("hidden")) {
        searchPanel.classList.remove("hidden");
        isSearchPanelVisible = true;
    }
    
    // Toggle replace row if specified
    if (showReplace) {
        replaceRowContainer?.classList.add("show");
        toggleReplaceBtn?.classList.add("expanded");
        replaceInput?.focus();
    } else {
        searchInput?.focus();
    }
    
    // Trigger search immediately if there's text
    if (searchInput?.value) {
        performSearch();
    }
}

function closeSearchPanel() {
    if (!searchPanel) return;
    searchPanel.classList.add("hidden");
    isSearchPanelVisible = false;
    // Clear search in editor
    editor.commands.setSearchTerm("");
}

function performSearch() {
    const term = searchInput?.value || "";
    if (term) {
        editor.commands.setSearchTerm(term);
        updateSearchCount();
    } else {
        editor.commands.setSearchTerm("");
        if (searchResultCount) searchResultCount.textContent = "0/0";
    }
}

function updateSearchCount() {
    // Note: The sereneinserenade extension provides state via React natively, but via vanilla TS we can check its storage.
    // If the storage metadata exists we can read results, else we just skip the count.
    const searchState = (editor.storage as any).searchAndReplace;
    if (searchState && searchResultCount) {
        const total = searchState.results?.length || 0;
        const current = total === 0 ? 0 : searchState.resultIndex + 1;
        searchResultCount.textContent = `${current}/${total}`;
    }
}

// Bind search panel events
searchInput?.addEventListener("input", performSearch);
searchInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        if (e.shiftKey) {
            editor.commands.previousSearchResult();
        } else {
            editor.commands.nextSearchResult();
        }
        updateSearchCount();
    } else if (e.key === "Escape") {
        closeSearchPanel();
        editor.commands.focus();
    }
});

replaceInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        editor.commands.replace();
        updateSearchCount();
    } else if (e.key === "Escape") {
        closeSearchPanel();
        editor.commands.focus();
    }
});

searchCloseBtn?.addEventListener("click", closeSearchPanel);

searchNextBtn?.addEventListener("click", () => {
    editor.commands.nextSearchResult();
    updateSearchCount();
});

searchPrevBtn?.addEventListener("click", () => {
    editor.commands.previousSearchResult();
    updateSearchCount();
});

toggleReplaceBtn?.addEventListener("click", () => {
    const isExpanded = toggleReplaceBtn.classList.contains("expanded");
    if (isExpanded) {
        toggleReplaceBtn.classList.remove("expanded");
        replaceRowContainer?.classList.remove("show");
    } else {
        toggleReplaceBtn.classList.add("expanded");
        replaceRowContainer?.classList.add("show");
        replaceInput?.focus();
    }
});

replaceBtn?.addEventListener("click", () => {
    editor.commands.replace();
    updateSearchCount();
});

replaceAllBtn?.addEventListener("click", () => {
    editor.commands.replaceAll();
    updateSearchCount();
});

// Update keyboard shortcuts for Search(Ctrl+F) and Replace(Ctrl+H)
document.addEventListener("keydown", (e) => {
    // Ctrl+F: Search
    if (e.ctrlKey && e.key === "f") {
        e.preventDefault();
        toggleSearchPanel(false);
    }
    
    // Ctrl+H: Replace
    if (e.ctrlKey && e.key === "h") {
        e.preventDefault();
        toggleSearchPanel(true);
    }
    
    // Existing Ctrl+S, Ctrl+O, Ctrl+N, Ctrl+B...
    if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        if (currentFilePath) saveFile(currentFilePath);
    }

    if (e.ctrlKey && e.key === "o") {
        e.preventDefault();
        openFolder();
    }

    if (e.ctrlKey && e.key === "n") {
        e.preventDefault();
        createNewFile();
    }

    if (e.ctrlKey && e.key === "b") {
        e.preventDefault();
        const sidebar = document.getElementById("sidebar");
        if (sidebar) {
            sidebar.style.display =
                sidebar.style.display === "none" ? "flex" : "none";
        }
    }
});

// ========================================
// Help Menu & License Modal Logic
// ========================================

const helpMenuBtn = document.getElementById('helpMenuBtn');
const helpDropdown = document.getElementById('helpDropdown');
const showLicenseBtn = document.getElementById('showLicenseBtn');
const licenseModal = document.getElementById('licenseModal');
const closeLicenseModalBtn = document.getElementById('closeLicenseModalBtn');
const licenseListContainer = document.getElementById('licenseList');

// Toggle dropdown
helpMenuBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isExpanded = helpMenuBtn.getAttribute('aria-expanded') === 'true';
    
    if (isExpanded) {
        helpMenuBtn.setAttribute('aria-expanded', 'false');
        helpDropdown?.classList.add('hidden');
    } else {
        helpMenuBtn.setAttribute('aria-expanded', 'true');
        helpDropdown?.classList.remove('hidden');
    }
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (helpDropdown && !helpDropdown.classList.contains('hidden')) {
        const target = e.target as HTMLElement;
        if (!target.closest('.dropdown')) {
            helpMenuBtn?.setAttribute('aria-expanded', 'false');
            helpDropdown.classList.add('hidden');
        }
    }
});

// License Data
const OSS_LICENSES = [
    {
        name: "ElectroBun",
        license: "MIT",
        copyright: "Copyright (c) 2024 Blackboard",
        fullText: `MIT License

Copyright (c) 2024 Blackboard Technologies inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.`
    },
    {
        name: "DOMPurify",
        license: "Apache 2.0 / MPL 2.0",
        copyright: "Copyright 2025 Dr.-Ing. Mario Heiderich, Cure53",
        fullText: `DOMPurify
Copyright 2025 Dr.-Ing. Mario Heiderich, Cure53

DOMPurify is free software; you can redistribute it and/or modify it under the
terms of either:

a) the Apache License Version 2.0, or
b) the Mozilla Public License Version 2.0

-----------------------------------------------------------------------------

                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
(except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any`
    },
    {
        name: "KaTeX",
        license: "MIT",
        copyright: "Copyright (c) 2014-2021 Khan Academy and other contributors",
        fullText: `The MIT License (MIT)

Copyright (c) 2013-2020 Khan Academy and other contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`
    },
    {
        name: "Markdown-It",
        license: "MIT",
        copyright: "Copyright (c) 2014 Vitaly Puzrin, Alex Kocharin",
        fullText: `Copyright (c) 2014 Vitaly Puzrin, Alex Kocharin.

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.`
    },
    {
        name: "Mermaid",
        license: "MIT",
        copyright: "Copyright (c) 2014-2022 Knut Sveidqvist",
        fullText: `The MIT License (MIT)

Copyright (c) 2014 - 2022 Knut Sveidqvist

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`
    },
    {
        name: "Turndown",
        license: "MIT",
        copyright: "Copyright (c) 2017 Dom Christie",
        fullText: `MIT License

Copyright (c) 2017 Dom Christie

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`
    },
    {
        name: "Bun",
        license: "MIT",
        copyright: "Copyright (c) 2023 oven.sh",
        fullText: `Bun itself is MIT-licensed.

## JavaScriptCore
Bun statically links JavaScriptCore (and WebKit) which is LGPL-2 licensed. WebCore files from WebKit are also licensed under LGPL2. Per LGPL2:

> (1) If you statically link against an LGPL’d library, you must also provide your application in an object (not necessarily source) format, so that a user has the opportunity to modify the library and relink the application.

You can find the patched version of WebKit used by Bun here: https://github.com/oven-sh/webkit. If you would like to relink Bun with changes:

- \`git submodule update --init --recursive\`
- \`make jsc\`
- \`zig build\`

This compiles JavaScriptCore, compiles Bun’s \`.cpp\` bindings for JavaScriptCore (which are the object files using JavaScriptCore) and outputs a new \`bun\` binary with your changes.

## Linked libraries
Bun statically links these libraries:

| Library | License |
|---------|---------|
| \`boringssl\` | several licenses |
| \`brotli\` | MIT |
| \`libarchive\` | several licenses |
| \`lol-html\` | BSD 3-Clause |
| \`mimalloc\` | MIT |
| \`picohttp\` | dual-licensed under the Perl License or the MIT License |
| \`zstd\` | dual-licensed under the BSD License or GPLv2 license |
| \`simdutf\` | Apache 2.0 |
| \`tinycc\` | LGPL v2.1 |
| \`uSockets\` | Apache 2.0 |
| \`zlib-cloudflare\` | zlib |
| \`c-ares\` | MIT licensed |
| \`libicu\` 72 | license here |
| \`libbase64\` | BSD 2-Clause |
| \`libuv\` (on Windows) | MIT |
| \`libdeflate\` | MIT |
| \`uucode\` | MIT |
| A fork of \`uWebsockets\` | Apache 2.0 licensed |
| Parts of Tigerbeetle's IO code | Apache 2.0 licensed |

## Polyfills
For compatibility reasons, the following packages are embedded into Bun's binary and injected if imported.

| Package | License |
|---------|---------|
| \`assert\` | MIT |
| \`browserify-zlib\` | MIT |
| \`buffer\` | MIT |
| \`constants-browserify\` | MIT |
| \`crypto-browserify\` | MIT |
| \`domain-browser\` | MIT |
| \`events\` | MIT |
| \`https-browserify\` | MIT |
| \`os-browserify\` | MIT |
| \`path-browserify\` | MIT |
| \`process\` | MIT |
| \`punycode\` | MIT |
| \`querystring-es3\` | MIT |
| \`stream-browserify\` | MIT |
| \`stream-http\` | MIT |
| \`string_decoder\` | MIT |
| \`timers-browserify\` | MIT |
| \`tty-browserify\` | MIT |
| \`url\` | MIT |
| \`util\` | MIT |
| \`vm-browserify\` | MIT |

## Additional credits
- Bun's JS transpiler, CSS lexer, and Node.js module resolver source code is a Zig port of @evanw’s esbuild project.
- Credit to @kipply for the name "Bun"!`
    }
];

// Show License Modal
showLicenseBtn?.addEventListener('click', () => {
    // Close dropdown
    helpMenuBtn?.setAttribute('aria-expanded', 'false');
    helpDropdown?.classList.add('hidden');
    
    // Render licenses if not already rendered
    if (licenseListContainer && licenseListContainer.childElementCount === 0) {
        licenseListContainer.innerHTML = OSS_LICENSES.map(pkg => `
            <div class="license-item">
                <div class="license-header">
                    <span class="license-name">${pkg.name}</span>
                    <span class="license-type">${pkg.license}</span>
                </div>
                <div class="license-copyright">${pkg.copyright}</div>
                <pre class="license-text">${pkg.fullText}</pre>
            </div>
        `).join('');
    }
    
    // Show modal
    licenseModal?.classList.remove('hidden');
});

// Close License Modal
closeLicenseModalBtn?.addEventListener('click', () => {
    licenseModal?.classList.add('hidden');
});

// Close modal when clicking overlay bg
licenseModal?.addEventListener('click', (e) => {
    if (e.target === licenseModal) {
        licenseModal.classList.add('hidden');
    }
});

// ========================================
// Table Insert Grid Picker Logic
// ========================================
const tableInsertBtn = document.getElementById("tableInsertBtn");
const tableGridPicker = document.getElementById("tableGridPicker");
const tableGridInfo = document.getElementById("tableGridInfo");
const tableGridContainer = document.getElementById("tableGridContainer");

let currentGridHover = { row: 3, col: 3 };

function closeTableGridPicker() {
    tableInsertBtn?.setAttribute("aria-expanded", "false");
    tableGridPicker?.classList.add("hidden");
}

function highlightGrid(rows: number, cols: number) {
    currentGridHover = { row: rows, col: cols };
    if (tableGridInfo) {
        tableGridInfo.textContent = `${rows} x ${cols}`;
    }
    
    if (tableGridContainer) {
        const cells = tableGridContainer.querySelectorAll('.table-grid-cell');
        cells.forEach(cell => {
            const r = parseInt((cell as HTMLElement).dataset.row || "1", 10);
            const c = parseInt((cell as HTMLElement).dataset.col || "1", 10);
            if (r <= rows && c <= cols) {
                cell.classList.add('selected');
            } else {
                cell.classList.remove('selected');
            }
        });
    }
}

// Setup 10x10 Grid
if (tableGridContainer) {
    for (let row = 1; row <= 10; row++) {
        for (let col = 1; col <= 10; col++) {
            const cell = document.createElement("div");
            cell.className = "table-grid-cell";
            cell.dataset.row = row.toString();
            cell.dataset.col = col.toString();
            
            cell.addEventListener("mouseenter", () => {
                highlightGrid(row, col);
            });
            
            cell.addEventListener("click", () => {
                editor.chain().focus().insertTable({ rows: row, cols: col, withHeaderRow: true }).run();
                closeTableGridPicker();
            });
            
            tableGridContainer.appendChild(cell);
        }
    }
}

tableInsertBtn?.addEventListener("click", (e) => {
    e.stopPropagation(); // prevent document click from closing it immediately
    const isExpanded = tableInsertBtn.getAttribute("aria-expanded") === "true";
    
    if (isExpanded) {
        closeTableGridPicker();
    } else {
        tableInsertBtn.setAttribute("aria-expanded", "true");
        tableGridPicker?.classList.remove("hidden");
        highlightGrid(3, 3); // default highlight
    }
});

// Bubble Menu Bindings
document.getElementById("tb-addRowBefore")?.addEventListener("click", () => editor.chain().focus().addRowBefore().run());
document.getElementById("tb-addRowAfter")?.addEventListener("click", () => editor.chain().focus().addRowAfter().run());
document.getElementById("tb-deleteRow")?.addEventListener("click", () => editor.chain().focus().deleteRow().run());
document.getElementById("tb-addColumnBefore")?.addEventListener("click", () => editor.chain().focus().addColumnBefore().run());
document.getElementById("tb-addColumnAfter")?.addEventListener("click", () => editor.chain().focus().addColumnAfter().run());
document.getElementById("tb-deleteColumn")?.addEventListener("click", () => editor.chain().focus().deleteColumn().run());
document.getElementById("tb-mergeCells")?.addEventListener("click", () => editor.chain().focus().mergeCells().run());
document.getElementById("tb-deleteTable")?.addEventListener("click", () => editor.chain().focus().deleteTable().run());
document.getElementById("tb-alignLeft")?.addEventListener("click", () => editor.chain().focus().setTextAlign("left").run());
document.getElementById("tb-alignCenter")?.addEventListener("click", () => editor.chain().focus().setTextAlign("center").run());
document.getElementById("tb-alignRight")?.addEventListener("click", () => editor.chain().focus().setTextAlign("right").run());

// Append to document click listener (added logic to close picker)
const existingDocClick = document.addEventListener;
document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (tableGridPicker && !tableGridPicker.classList.contains("hidden")) {
        if (!target.closest(".toolbar-dropdown")) {
            closeTableGridPicker();
        }
    }
});

