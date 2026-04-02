import { state } from "../state/workspace";
import { electroview } from "../ipc";
import { setEditorContent, getEditorHTML, getEditorText } from "../editor";
import { markdownToHtml, htmlToMarkdown } from "../markdown-parser";
import { updateTitleBar, highlightActiveFile } from "../utils/dom";
import { updateStatusBar } from "../ui/status-bar";
import { loadFileTree } from "./file-tree";
import { showUnsavedChangesModal, updateEditorView } from "../ui/modals";
import { renderOutline } from "../ui/outline";
import { t } from "../utils/i18n";

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
            title: t("workspace.newFolder")
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
                <button class="open-editor-tab-close" data-i18n-tooltip="common.close">
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
            await setEditorContent(state.editor, "");
            state.editor.setEditable(false);
            document.getElementById("editorToolbar")?.classList.add("hidden");
            updateTitleBar();
            renderOpenTabs();
            highlightActiveFile("");
            updateStatusBar();
            updateEditorView();
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
            await setEditorContent(state.editor, targetTab.cachedContent);
        } else if (targetTab?.isUntitled) {
            await setEditorContent(state.editor, "");
        } else {
            const content = await electroview.rpc?.request.readFile({ filePath });
            // Use the Worker for Markdown-to-HTML conversion. 
            // Relative images will be handled lazily (implemented next).
            await setEditorContent(state.editor, content ?? "", true);
        }

        state.editor.setEditable(true);
        document.getElementById("editorToolbar")?.classList.remove("hidden");
        state.currentFilePath = filePath;

        updateTitleBar();
        renderOpenTabs();
        highlightActiveFile(filePath);
        state.editor.commands.focus("start");
        updateStatusBar();
        renderOutline(state.editor);
        updateEditorView();
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
                title: t("workspace.saveUnsaved")
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
            await setEditorContent(state.editor, newHtml);
        }
        return newHtml;
    }

    return html;
}
/**
 * Rename a file or directory and update the state/UI.
 */
export async function renameEntry(oldPath: string, newName: string) {
    try {
        const response = await electroview.rpc?.request.renameEntry({ oldPath, newName });
        
        if (response?.success) {
            const newPath = response.newPath;
            
            // Update open tabs if the renamed entry (or a child if it's a directory) is open
            for (const [path, tab] of Array.from(state.openTabs.entries())) {
                if (path === oldPath) {
                    // Exact match (file or directory itself)
                    state.openTabs.delete(path);
                    state.openTabs.set(newPath, { ...tab, filePath: newPath });
                    if (state.currentFilePath === path) {
                        state.currentFilePath = newPath;
                    }
                } else if (path.startsWith(oldPath + '/') || path.startsWith(oldPath + '\\')) {
                    // Child of the renamed directory
                    const relativePath = path.substring(oldPath.length);
                    const newChildPath = newPath + relativePath;
                    state.openTabs.delete(path);
                    state.openTabs.set(newChildPath, { ...tab, filePath: newChildPath });
                    if (state.currentFilePath === path) {
                        state.currentFilePath = newChildPath;
                    }
                }
            }
            
            if (state.currentFolderPath) {
                await loadFileTree(state.currentFolderPath);
            }
            updateTitleBar();
            renderOpenTabs();
            highlightActiveFile(state.currentFilePath || "");
            
            return { success: true, newPath };
        } else {
            console.error("[renameEntry] Failed:", response?.error);
            return { success: false, error: response?.error };
        }
    } catch (error) {
        console.error("Failed to rename entry:", error);
        return { success: false, error: String(error) };
    }
}

/**
 * Delete a file or directory and update the state/UI.
 */
export async function deleteEntry(path: string) {
    try {
        const response = await electroview.rpc?.request.deleteEntry({ path });
        
        if (response?.success) {
            // Close any tabs that were pointing to this path or inside it
            for (const openPath of Array.from(state.openTabs.keys())) {
                if (openPath === path || openPath.startsWith(path + '/') || openPath.startsWith(path + '\\')) {
                    // Force close without prompt as the file is gone
                    state.openTabs.delete(openPath);
                    if (state.currentFilePath === openPath) {
                        state.currentFilePath = null;
                        await setEditorContent(state.editor, "");
                        state.editor.setEditable(false);
                        document.getElementById("editorToolbar")?.classList.add("hidden");
                        updateEditorView();
                    }
                }
            }
            
            if (state.currentFolderPath) {
                await loadFileTree(state.currentFolderPath);
            }
            updateTitleBar();
            renderOpenTabs();
            highlightActiveFile(state.currentFilePath || "");
            updateStatusBar();
            
            return { success: true };
        } else {
            console.error("[deleteEntry] Failed:", response?.error);
            return { success: false, error: response?.error };
        }
    } catch (error) {
        console.error("Failed to delete entry:", error);
        return { success: false, error: String(error) };
    }
}

/**
 * Move a file or directory and update the state/UI.
 */
export async function moveEntry(oldPath: string, newParentDir: string) {
    try {
        const response = await electroview.rpc?.request.moveEntry({ oldPath, newParentDir });
        
        if (response?.success) {
            const newPath = response.newPath;
            
            // Similar to rename, update open tabs
            for (const [path, tab] of Array.from(state.openTabs.entries())) {
                if (path === oldPath) {
                    state.openTabs.delete(path);
                    state.openTabs.set(newPath, { ...tab, filePath: newPath });
                    if (state.currentFilePath === path) {
                        state.currentFilePath = newPath;
                    }
                } else if (path.startsWith(oldPath + '/') || path.startsWith(oldPath + '\\')) {
                    const relativePath = path.substring(oldPath.length);
                    const newChildPath = newPath + relativePath;
                    state.openTabs.delete(path);
                    state.openTabs.set(newChildPath, { ...tab, filePath: newChildPath });
                    if (state.currentFilePath === path) {
                        state.currentFilePath = newChildPath;
                    }
                }
            }
            
            if (state.currentFolderPath) {
                await loadFileTree(state.currentFolderPath);
            }
            updateTitleBar();
            renderOpenTabs();
            highlightActiveFile(state.currentFilePath || "");
            
            return { success: true, newPath };
        } else {
            console.error("[moveEntry] Failed:", response?.error);
            return { success: false, error: response?.error };
        }
    } catch (error) {
        console.error("Failed to move entry:", error);
        return { success: false, error: String(error) };
    }
}
