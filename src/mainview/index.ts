import { Electroview } from "electrobun/view";
import { type EditaryRPCType, type FileEntry } from "../shared/types";
import { createEditor, setEditorContent, getEditorHTML } from "./editor";
import { markdownToHtml, htmlToMarkdown } from "./markdown-parser";

// ========================================
// State
// ========================================
let currentFilePath: string | null = null;
let currentFolderPath: string | null = null;
let isDirty = false;

// ========================================
// Electroview + RPC
// ========================================
const rpc = Electroview.defineRPC<EditaryRPCType>({
    handlers: {
        requests: {},
        messages: {
            fileSaved: ({ filePath }) => {
                console.log(`File saved: ${filePath}`);
                updateTitleBar(false);
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

// Track changes for dirty state
editor.on("update", () => {
    if (currentFilePath && !isDirty) {
        isDirty = true;
        updateTitleBar(true);
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
// Sidebar: Open Folder
// ========================================
document.getElementById("openFolderBtn")?.addEventListener("click", openFolder);
document.getElementById("newFileBtn")?.addEventListener("click", createNewFile);

async function openFolder() {
    try {
        const folderPath = await electroview.rpc?.request.openFolder({});
        if (folderPath) {
            currentFolderPath = folderPath;
            await loadFileTree(folderPath);
        }
    } catch (error) {
        console.error("Failed to open folder:", error);
    }
}

// ========================================
// Sidebar: File Tree
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

function renderEntries(
    parent: HTMLElement,
    entries: FileEntry[],
    depth: number
) {
    for (const entry of entries) {
        const item = document.createElement("div");
        item.className = entry.isDirectory
            ? "file-tree-item file-tree-item--directory"
            : "file-tree-item";
        item.style.paddingLeft = `${16 + depth * 16}px`;

        if (entry.isDirectory) {
            item.textContent = `📁 ${entry.name}`;
            parent.appendChild(item);
            if (entry.children) {
                renderEntries(parent, entry.children, depth + 1);
            }
        } else {
            item.textContent = `📄 ${entry.name}`;
            item.dataset.path = entry.path;
            item.addEventListener("click", () => openFile(entry.path));
            parent.appendChild(item);
        }
    }
}

// ========================================
// File Operations
// ========================================
async function openFile(filePath: string) {
    // Check for unsaved changes
    if (isDirty && currentFilePath) {
        const confirmed = confirm("現在のファイルに未保存の変更があります。保存しますか？");
        if (confirmed) {
            await saveCurrentFile();
        }
    }

    try {
        const content = await electroview.rpc?.request.readFile({ filePath });
        const html = markdownToHtml(content ?? "");
        setEditorContent(editor, html);
        currentFilePath = filePath;
        isDirty = false;
        updateTitleBar(false);
        highlightActiveFile(filePath);
        editor.commands.focus("start");
    } catch (error) {
        console.error("Failed to open file:", error);
    }
}

async function saveCurrentFile() {
    if (!currentFilePath) return;

    try {
        const html = getEditorHTML(editor);
        const markdown = htmlToMarkdown(html);
        const success = await electroview.rpc?.request.writeFile({
            filePath: currentFilePath,
            content: markdown,
        });
        if (success) {
            isDirty = false;
            updateTitleBar(false);
        }
    } catch (error) {
        console.error("Failed to save file:", error);
    }
}

async function createNewFile() {
    if (!currentFolderPath) {
        alert("フォルダを先に開いてください");
        return;
    }

    const fileName = prompt("新しいファイル名を入力してください:", "untitled.md");
    if (!fileName) return;

    try {
        const filePath = await electroview.rpc?.request.createFile({
            dirPath: currentFolderPath,
            fileName,
        });
        await loadFileTree(currentFolderPath);
        if (filePath) {
            await openFile(filePath);
        }
    } catch (error) {
        console.error("Failed to create file:", error);
    }
}

// ========================================
// UI Helpers
// ========================================
function updateTitleBar(dirty: boolean) {
    const titleEl = document.querySelector(".titlebar-title");
    if (!titleEl) return;

    const fileName = currentFilePath
        ? currentFilePath.split(/[/\\]/).pop()
        : null;
    const prefix = dirty ? "● " : "";
    titleEl.textContent = fileName ? `${prefix}${fileName} — Editary` : "Editary";
}

function highlightActiveFile(filePath: string) {
    document.querySelectorAll(".file-tree-item").forEach((el) => {
        el.classList.remove("file-tree-item--active");
    });
    document
        .querySelector(`.file-tree-item[data-path="${CSS.escape(filePath)}"]`)
        ?.classList.add("file-tree-item--active");
}

// ========================================
// Keyboard Shortcuts
// ========================================
document.addEventListener("keydown", (e) => {
    // Ctrl+S: Save
    if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        saveCurrentFile();
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
