import { state } from "../state/workspace";
import { electroview } from "../ipc";
import { setEditorContent, getEditorHTML, getEditorText } from "../editor";
import { markdownToHtml, htmlToMarkdown, resolveRelativeImages } from "../markdown-parser";
import { updateTitleBar, highlightActiveFile } from "../utils/dom";
import { updateStatusBar } from "../ui/status-bar";
import { loadFileTree } from "./file-tree";
import { showUnsavedChangesModal } from "../ui/modals";

export async function createNewFile() {
    state.untitledCount++;
    const virtualPath = `Untitled-${state.untitledCount}`;

    state.openTabs.set(virtualPath, {
        filePath: virtualPath,
        isDirty: false,
        isUntitled: true,
    });

    await switchToTab(virtualPath);
}

export async function createNewFolder() {
    if (!state.currentFolderPath) return;

    try {
        const selectedPath = await electroview.rpc?.request.showFolderBrowserDialog({
            defaultPath: state.currentFolderPath,
            title: "新しいフォルダを作成・選択"
        });

        if (selectedPath) {
            await loadFileTree(state.currentFolderPath);
        }
    } catch (error) {
        console.error("Failed to sequence folder creation:", error);
    }
}

export function renderOpenTabs() {
    const list = document.getElementById("openEditorsList");
    if (!list) return;

    list.innerHTML = "";

    for (const [path, tab] of state.openTabs.entries()) {
        const fileName = path.split(/[/\\]/).pop() || "";
        const dirName = path.substring(0, path.length - fileName.length - 1).split(/[/\\]/).pop() || "";

        const item = document.createElement("div");
        item.className = `open-editor-tab ${state.currentFilePath === path ? "open-editor-tab--active" : ""}`;
        item.dataset.path = path;

        item.innerHTML = `
            <span class="open-editor-tab-name">${fileName}</span>
            <span class="open-editor-tab-dir">${dirName}</span>
            <div class="open-editor-tab-status">
                ${tab.isDirty ? '<div class="open-editor-tab-dirty"></div>' : ''}
                <button class="open-editor-tab-close" data-tooltip="閉じる">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
        `;

        item.addEventListener("click", (e) => {
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

export async function closeTab(filePath: string) {
    const tab = state.openTabs.get(filePath);
    if (!tab) return;

    if (tab.isDirty) {
        // Switch to the tab to show what's being closed
        if (state.currentFilePath !== filePath) {
            await switchToTab(filePath);
        }

        const fileName = filePath.split(/[/\\]/).pop() || "untitled";
        const result = await showUnsavedChangesModal(fileName);

        if (result === 'save') {
            await saveFile(filePath);
            const updatedTab = state.openTabs.get(filePath);
            if (updatedTab?.isDirty) {
                // Save was cancelled or failed
                return;
            }
        } else if (result === 'discard') {
            // Proceed to close without saving
        } else {
            // Cancel
            return;
        }
    }

    state.openTabs.delete(filePath);

    if (state.currentFilePath === filePath) {
        const remaining = Array.from(state.openTabs.keys());
        if (remaining.length > 0) {
            switchToTab(remaining[remaining.length - 1]);
        } else {
            state.currentFilePath = null;
            setEditorContent(state.editor, "");
            state.editor.setEditable(false);
            document.getElementById("editorToolbar")?.classList.add("hidden");
            updateTitleBar();
            renderOpenTabs();
            highlightActiveFile("");
            updateStatusBar();
        }
    } else {
        renderOpenTabs();
    }
}

export async function switchToTab(filePath: string) {
    if (state.currentFilePath === filePath) return;

    if (state.currentFilePath) {
        const curTab = state.openTabs.get(state.currentFilePath);
        if (curTab) {
            curTab.cachedContent = getEditorHTML(state.editor);
        }
    }

    try {
        const targetTab = state.openTabs.get(filePath);

        if (targetTab?.cachedContent !== undefined) {
            setEditorContent(state.editor, targetTab.cachedContent);
        } else if (targetTab?.isUntitled) {
            setEditorContent(state.editor, "");
        } else {
            const content = await electroview.rpc?.request.readFile({ filePath });
            let html = markdownToHtml(content ?? "");
            const baseDir = filePath.replace(/[\\/][^\\/]*$/, "") || ".";
            html = await resolveRelativeImages(html, baseDir, electroview.rpc);
            setEditorContent(state.editor, html);
        }

        state.editor.setEditable(true);
        document.getElementById("editorToolbar")?.classList.remove("hidden");
        state.currentFilePath = filePath;

        updateTitleBar();
        renderOpenTabs();
        highlightActiveFile(filePath);
        state.editor.commands.focus("start");
        updateStatusBar();
    } catch (error) {
        console.error("Failed to load tab:", error);
    }
}

export async function openFile(filePath: string) {
    if (!state.openTabs.has(filePath)) {
        state.openTabs.set(filePath, { filePath, isDirty: false, isUntitled: false });
    }
    await switchToTab(filePath);
}

export async function saveFile(filePath: string) {
    const tab = state.openTabs.get(filePath);
    if (!tab) return;

    let targetPath = filePath;

    if (tab.isUntitled) {
        const defaultPath = state.currentFolderPath ? state.currentFolderPath + "\\\\untitled.md" : "C:\\\\Users\\\\untitled.md";
        let manualPath: string | null | undefined = null;
        try {
            manualPath = await electroview.rpc?.request.showSaveFileDialog({
                defaultPath,
                title: "未保存のファイルを保存"
            });
        } catch (error) {
            console.error("showSaveFileDialog RPC failed or timed out:", error);
            return;
        }

        if (!manualPath) return;

        targetPath = manualPath;
        if (!targetPath.toLowerCase().endsWith('.md')) {
            targetPath += '.md';
        }
    }

    try {
        let html = "";
        if (state.currentFilePath === filePath) {
            html = getEditorHTML(state.editor);
        } else if (tab.cachedContent !== undefined) {
            html = tab.cachedContent;
        } else {
            console.error("No content to save for:", filePath);
            return;
        }

        // Process images before saving to Markdown (convert Base64 to Local)
        const targetDir = targetPath.replace(/[\\/][^\\/]*$/, "") || ".";
        html = await processEditorImages(html, targetDir);

        const markdown = htmlToMarkdown(html);

        const success = await electroview.rpc?.request.writeFile({
            filePath: targetPath,
            content: markdown,
        });

        if (success) {
            if (tab.isUntitled && targetPath !== filePath) {
                state.openTabs.delete(filePath);
                state.openTabs.set(targetPath, { filePath: targetPath, isDirty: false, isUntitled: false });
                state.currentFilePath = targetPath;
            } else {
                tab.isDirty = false;
            }
            if (state.currentFolderPath) {
                await loadFileTree(state.currentFolderPath);
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

export async function saveAllFiles() {
    const promises = [];
    for (const [path, tab] of state.openTabs.entries()) {
        if (tab.isDirty) {
            promises.push(saveFile(path));
        }
    }
    await Promise.all(promises);
}

export async function closeAllTabs() {
    const paths = Array.from(state.openTabs.keys());
    for (const path of paths) {
        await closeTab(path);
    }
}

/**
 * Scan HTML for Base64 images and save them as local files in targetDir/assets/.
 */
async function processEditorImages(html: string, targetDir: string): Promise<string> {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const images = Array.from(doc.querySelectorAll("img"));
    let changed = false;

    for (const img of images) {
        const originalSrc = img.getAttribute("data-original-src");
        if (originalSrc) {
            // Restore original relative path and remove preview data URL
            img.setAttribute("src", originalSrc);
            img.removeAttribute("data-original-src");
            changed = true;
            continue;
        }

        const src = img.getAttribute("src");
        if (src && src.startsWith("data:image/")) {
            // This is a newly pasted or dropped image (not yet saved to assets)
            // Extract a possible filename or default to timestamped name
            const fileName = `image-${Date.now()}.png`;
            
            try {
                const response = await electroview.rpc?.request.saveImage({
                    targetDir,
                    fileName,
                    base64Data: src
                });

                if (response?.success) {
                    img.setAttribute("src", response.relativePath);
                    changed = true;
                }
            } catch (error) {
                console.error("[processEditorImages] RPC failed:", error);
            }
        }
    }

    if (changed) {
        const newHtml = doc.body.innerHTML;
        // Update editor content if it's the active tab
        if (state.editor && state.openTabs.has(state.currentFilePath || "")) {
            // We use setContent here, it will trigger an update event and mark as dirty again,
            // but since we're in the middle of saveFile, the caller will set isDirty = false after this.
            setEditorContent(state.editor, newHtml);
        }
        return newHtml;
    }

    return html;
}
