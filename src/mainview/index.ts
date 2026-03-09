import { Electroview } from "electrobun/view";
import { type EditaryRPCType } from "../shared/types";

// Initialize Electroview with RPC
const rpc = Electroview.defineRPC<EditaryRPCType>({
    handlers: {
        requests: {},
        messages: {
            fileSaved: ({ filePath }) => {
                console.log(`File saved: ${filePath}`);
            },
        },
    },
});

const electroview = new Electroview({ rpc });

// ========================================
// Window Controls
// ========================================
document.getElementById("closeBtn")?.addEventListener("click", () => {
    electroview.rpc.send.closeWindow({});
});

document.getElementById("minimizeBtn")?.addEventListener("click", () => {
    electroview.rpc.send.minimizeWindow({});
});

document.getElementById("maximizeBtn")?.addEventListener("click", () => {
    electroview.rpc.send.maximizeWindow({});
});

// ========================================
// Editor Placeholder (Tiptap will replace this in Phase 2)
// ========================================
const editorEl = document.getElementById("editor");
if (editorEl) {
    editorEl.innerHTML = `
    <div style="padding: 20px; text-align: center; color: var(--neo-text-muted);">
      <h2 style="font-weight: 900; margin-bottom: 12px;">🚀 Editary</h2>
      <p style="font-weight: 600;">ネオブルータリズム Markdownエディター</p>
      <p style="margin-top: 8px;">フェーズ2でTiptapエディターを統合予定</p>
    </div>
  `;
}

// ========================================
// Open Folder Button
// ========================================
document.getElementById("openFolderBtn")?.addEventListener("click", async () => {
    try {
        const folderPath = await electroview.rpc.request.openFolder({});
        if (folderPath) {
            console.log("Selected folder:", folderPath);
            // Phase 3: Load file tree into sidebar
        }
    } catch (error) {
        console.error("Failed to open folder:", error);
    }
});

// ========================================
// Keyboard Shortcuts
// ========================================
document.addEventListener("keydown", (e) => {
    // Ctrl+S: Save current file
    if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        console.log("Save shortcut triggered (Phase 3)");
    }

    // Ctrl+O: Open folder
    if (e.ctrlKey && e.key === "o") {
        e.preventDefault();
        document.getElementById("openFolderBtn")?.click();
    }

    // Ctrl+B: Toggle sidebar
    if (e.ctrlKey && e.key === "b") {
        e.preventDefault();
        const sidebar = document.getElementById("sidebar");
        if (sidebar) {
            sidebar.style.display =
                sidebar.style.display === "none" ? "flex" : "none";
        }
    }
});
