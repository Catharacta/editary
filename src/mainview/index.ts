import { Electroview } from "electrobun/view";
import { type EditaryRPCType, type FileEntry } from "../shared/types";
import { createEditor, setEditorContent, getEditorHTML } from "./editor";
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
if (!editorElement) {
    throw new Error("Editor element not found");
}

const editor = createEditor(editorElement);
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
});

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
            updateTitleBar();
            renderOpenTabs();
            highlightActiveFile("");
        }
    } else {
        renderOpenTabs();
    }
}

async function switchToTab(filePath: string) {
    if (currentFilePath === filePath) return;

    // Save current editor state
    if (currentFilePath) {
        const curTab = openTabs.get(currentFilePath);
        if (curTab?.isDirty) {
            const fileName = curTab.isUntitled ? curTab.filePath : currentFilePath;
            const ans = confirm(`ファイル ${fileName} に変更があります。保存してから切り替えますか？`);
            if (ans) {
                await saveFile(currentFilePath);
            } else {
                curTab.isDirty = false;
            }
        }
    }

    try {
        const targetTab = openTabs.get(filePath);
        if (targetTab?.isUntitled) {
            // For untitled files, we just empty the editor (or load from a local cache if we had one)
            // Currently, switching away from an untitled file drops its content if not saved,
            // because our MVP doesn't cache unsaved content per tab. 
            // The user is prompted to save above, so if they arrive here, it's either saved or discarded.
            setEditorContent(editor, "");
        } else {
            // Load from disk
            const content = await electroview.rpc?.request.readFile({ filePath });
            const html = markdownToHtml(content ?? "");
            setEditorContent(editor, html);
        }

        editor.setEditable(true);
        currentFilePath = filePath;

        if (targetTab) targetTab.isDirty = false;

        updateTitleBar();
        renderOpenTabs();
        highlightActiveFile(filePath);
        editor.commands.focus("start");
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

        console.log("[saveFile] Dialog returned:", JSON.stringify(manualPath));
        if (!manualPath) return; // cancelled

        targetPath = manualPath;
        if (!targetPath.toLowerCase().endsWith('.md')) {
            targetPath += '.md';
        }
    }

    try {
        const html = getEditorHTML(editor);
        const markdown = htmlToMarkdown(html);
        console.log(`[saveFile] Writing to: "${targetPath}" (content length: ${markdown.length})`);

        // Write the file to disk
        const success = await electroview.rpc?.request.writeFile({
            filePath: targetPath,
            content: markdown,
        });

        console.log(`[saveFile] writeFile result: ${success}`);

        if (success) {
            if (tab.isUntitled && targetPath !== filePath) {
                // If it was untitled, replace the old key with new saved file key
                openTabs.delete(filePath);
                openTabs.set(targetPath, { filePath: targetPath, isDirty: false, isUntitled: false });
                currentFilePath = targetPath;
                // Optional: refresh folder tree if it falls in the current folder
                if (currentFolderPath && targetPath.startsWith(currentFolderPath)) {
                    await loadFileTree(currentFolderPath);
                }
            } else {
                tab.isDirty = false;
            }
            updateTitleBar();
            renderOpenTabs();
        } else {
            console.error("[saveFile] writeFile returned false — file was NOT saved.");
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
// Keyboard Shortcuts
// ========================================
document.addEventListener("keydown", (e) => {
    // Ctrl+S: Save
    if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        if (currentFilePath) saveFile(currentFilePath);
    }

    // Ctrl+O: Open Folder
    if (e.ctrlKey && e.key === "o") {
        e.preventDefault();
        openFolder();
    }

    // Ctrl+N: New File
    if (e.ctrlKey && e.key === "n") {
        e.preventDefault();
        createNewFile();
    }

    // Ctrl+B: Toggle Sidebar
    if (e.ctrlKey && e.key === "b") {
        e.preventDefault();
        const sidebar = document.getElementById("sidebar");
        if (sidebar) {
            sidebar.style.display =
                sidebar.style.display === "none" ? "flex" : "none";
        }
    }
});

// Initialize UI
updateSidebarVisibility();
