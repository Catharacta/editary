import { readdir, readFile, writeFile, mkdir, stat, copyFile, rename, rm } from "node:fs/promises";
import { join, extname, basename, dirname } from "node:path";
import type { FileEntry, LicenseEntry, SearchOptions } from "../shared/types";

/**
 * Read a directory and return file entries.
 * Can be recursive (reads entire tree) or shallow (reads only direct children).
 */
async function getDirectoryEntries(dirPath: string, recursive: boolean = true): Promise<FileEntry[]> {
    const entries: FileEntry[] = [];

    try {
        const items = await readdir(dirPath, { withFileTypes: true });

        for (const item of items) {
            // Skip hidden files and directories
            if (item.name.startsWith(".")) continue;

            const fullPath = join(dirPath, item.name);

            if (item.isDirectory()) {
                if (recursive) {
                    const children = await getDirectoryEntries(fullPath, true);
                    // Only include directories that contain .md files (directly or nested)
                    if (children.length > 0) {
                        entries.push({
                            name: item.name,
                            path: fullPath,
                            isDirectory: true,
                            children,
                        });
                    }
                } else {
                    // In shallow mode, include all directories
                    entries.push({
                        name: item.name,
                        path: fullPath,
                        isDirectory: true,
                    });
                }
            } else if (extname(item.name).toLowerCase() === ".md") {
                entries.push({
                    name: item.name,
                    path: fullPath,
                    isDirectory: false,
                });
            }
        }
    } catch (error) {
        console.error(`Failed to read directory: ${dirPath}`, error);
    }

    // Sort: directories first, then files, alphabetically
    entries.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
    });

    return entries;
}

/**
 * Safely ensures a directory exists.
 * Helps avoid 'EEXIST' errors on some Windows environments where recursive mkdir might fail on existing components.
 */
async function ensureDir(dirPath: string) {
    try {
        await mkdir(dirPath, { recursive: true });
    } catch (error: any) {
        if (error.code === 'EEXIST') {
            // Check if it's actually a directory
            try {
                const s = await stat(dirPath);
                if (s.isDirectory()) return;
            } catch (ignore) {}
        }
        throw error;
    }
}

// @ts-ignore
import * as nfd from "nativefiledialog-for-bun";
import { BrowserWindow, Utils } from "electrobun/bun";
import { withDpiContext, getWindowHandle } from "./platform-dpi";

// バンドル環境での DLL 探索パスを設定（ユーザーによる 0.3.2 での追加機能）
if (process.platform === 'win32') {
    // 実行ファイル (Resources/app/bun/index.js) から見た相対パス
    // electrobun.config.ts で DLL を bin/win32/x64/nfd.dll にコピーしているため、
    // そのフォルダを指定する。 import.meta.dir は Resources/app/bun を指す。
    const libPath = join(import.meta.dir, '..', 'bin', 'win32', 'x64');
    // @ts-ignore
    nfd.setLibraryPath(libPath);
    console.log(`[nfd] Library path set to: ${libPath} (Mode: ${nfd.getBackendName()})`);
}

import { type EditaryRPCType } from "../shared/types";

let mainWindow: BrowserWindow | null = null;
let mainWindowHwnd: any = null;

function getHwnd(): any {
    if (mainWindowHwnd) return mainWindowHwnd;
    if (mainWindow) {
        mainWindowHwnd = getWindowHandle(mainWindow.title);
    }
    return mainWindowHwnd;
}

/**
 * メインウィンドウの参照を設定します。
 * ダイアログを表示する際の親ウィンドウ（HWND）として使用されます。
 */
export function setMainWindow(win: BrowserWindow) {
    mainWindow = win;
}

/**
 * File operation handlers for RPC requests from the Webview.
 */
// @ts-ignore - Some handlers might need slight adjustments to match the exact electrobun RPC handler signature
export const handleFileOperations: any = {

    searchInFiles: async ({ query, dirPath, options }: { query: string; dirPath: string; options?: SearchOptions }) => {
        const results: any[] = [];
        if (!query) return results;

        const isCaseSensitive = options?.isCaseSensitive ?? false;
        const isWholeWord = options?.isWholeWord ?? false;
        const isRegex = options?.isRegex ?? false;

        let pattern = query;
        if (!isRegex) {
            // Escape special characters for literal search
            pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }

        if (isWholeWord) {
            pattern = `\\b${pattern}\\b`;
        }

        const regex = new RegExp(pattern, isCaseSensitive ? "" : "i");

        // Prepare filter regexes
        const globToRegex = (glob: string) => {
            const pattern = glob.trim()
                .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex chars except * and ?
                .replace(/\*/g, '.*')
                .replace(/\?/g, '.');
            return new RegExp(`^${pattern}$`, 'i');
        };

        const includeRegexes = options?.includePattern?.split(',').map(globToRegex).filter(r => !!r) || [];
        const excludeRegexes = options?.excludePattern?.split(',').map(globToRegex).filter(r => !!r) || [];

        const isIncluded = (name: string) => {
            if (includeRegexes.length === 0) return true;
            return includeRegexes.some(r => r.test(name));
        };

        const isExcluded = (name: string) => {
            return excludeRegexes.some(r => r.test(name));
        };

        async function walk(currentPath: string) {
            const items = await readdir(currentPath, { withFileTypes: true });
            for (const item of items) {
                if (item.name.startsWith(".") || isExcluded(item.name)) continue;
                const fullPath = join(currentPath, item.name);

                if (item.isDirectory()) {
                    await walk(fullPath);
                } else {
                    const isMd = extname(item.name).toLowerCase() === ".md";
                    if (isMd && isIncluded(item.name)) {
                        try {
                            const content = await readFile(fullPath, "utf-8");
                            const lines = content.split(/\r?\n/);
                            const matches: any[] = [];

                            lines.forEach((lineText, index) => {
                                if (regex.test(lineText)) {
                                    matches.push({
                                        line: index + 1,
                                        text: lineText.trim()
                                    });
                                }
                            });

                            if (matches.length > 0) {
                                results.push({
                                    filePath: fullPath,
                                    fileName: item.name,
                                    matches: matches
                                });
                            }
                        } catch (e) {
                            console.error(`Failed to search in file: ${fullPath}`, e);
                        }
                    }
                }
            }
        }

        await walk(dirPath);
        return results;
    },

    replaceAllInFiles: async ({ query, replace, filePaths, options }: { query: string; replace: string; filePaths: string[]; options?: SearchOptions }) => {
        let successCount = 0;
        let errorCount = 0;

        if (!query) return { successCount, errorCount };

        const isCaseSensitive = options?.isCaseSensitive ?? false;
        const isWholeWord = options?.isWholeWord ?? false;
        const isRegex = options?.isRegex ?? false;

        let pattern = query;
        if (!isRegex) {
            pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }

        if (isWholeWord) {
            pattern = `\\b${pattern}\\b`;
        }

        // Global replace flag 'g' is essential here
        const regex = new RegExp(pattern, (isCaseSensitive ? "" : "i") + "g");

        for (const filePath of filePaths) {
            try {
                const content = await readFile(filePath, "utf-8");
                const newContent = content.replace(regex, replace);
                
                if (content !== newContent) {
                    await writeFile(filePath, newContent, "utf-8");
                }
                successCount++;
            } catch (e) {
                console.error(`Failed to replace in file: ${filePath}`, e);
                errorCount++;
            }
        }

        return { successCount, errorCount };
    },

    openFolder: async () => {
        console.log("[openFolder] Starting native folder dialog...");
        return await withDpiContext(async () => {
            try {
                console.log("[openFolder] Calling nfd.pickFolder...");
                const folderPath = await nfd.pickFolder({
                    parentWindow: getHwnd()
                });
                console.log("[openFolder] Result:", folderPath);
                return folderPath;
            } catch (error) {
                console.error("[openFolder] Error:", error);
                return null;
            }
        });
    },

    readDirectory: async ({ dirPath, recursive }: { dirPath: string; recursive?: boolean }) => {
        return getDirectoryEntries(dirPath, recursive ?? true);
    },

    readFile: async ({ filePath }: { filePath: string }) => {
        try {
            const content = await readFile(filePath, "utf-8");
            return content;
        } catch (error) {
            console.error(`Failed to read file: ${filePath}`, error);
            throw new Error(`Cannot read file: ${filePath}`);
        }
    },

    writeFile: async ({
        filePath,
        content,
    }: {
        filePath: string;
        content: string;
    }) => {
        try {
            // Ensure parent directory exists
            const dir = dirname(filePath);
            await ensureDir(dir);
            await writeFile(filePath, content, "utf-8");
            return true;
        } catch (error) {
            console.error(`[writeFile] Failed: ${filePath}`, error);
            return false;
        }
    },

    createFile: async ({
        dirPath,
        fileName,
    }: {
        dirPath: string;
        fileName: string;
    }) => {
        const safeName = fileName.endsWith(".md") ? fileName : `${fileName}.md`;
        const filePath = join(dirPath, safeName);

        try {
            // Ensure directory exists
            await ensureDir(dirPath);
            // Create empty file
            await writeFile(filePath, "", "utf-8");
            return filePath;
        } catch (error) {
            console.error(`Failed to create file: ${filePath}`, error);
            throw new Error(`Cannot create file: ${filePath}`);
        }
    },

    createDirectory: async ({
        dirPath,
        dirName,
    }: {
        dirPath: string;
        dirName: string;
    }) => {
        const newDirPath = join(dirPath, dirName);
        try {
            await ensureDir(newDirPath);
            return newDirPath;
        } catch (error) {
            console.error(`Failed to create directory: ${newDirPath}`, error);
            throw new Error(`Cannot create directory: ${newDirPath}`);
        }
    },

    showSaveFileDialog: async (params: { defaultPath?: string; title?: string; filter?: string }) => {
        const fullDefaultPath = params.defaultPath || "";
        let defaultPath = "";
        let defaultName = "";

        if (fullDefaultPath) {
            // If it's a directory, use it as defaultPath. If it has a filename, split it.
            if (fullDefaultPath.endsWith("/") || fullDefaultPath.endsWith("\\")) {
                defaultPath = fullDefaultPath;
            } else {
                defaultPath = dirname(fullDefaultPath);
                defaultName = basename(fullDefaultPath);
            }
        }

        // Note: filters format is [{ name: 'Markdown', extensions: ['md'] }]
        const filters = params.filter ? 
            params.filter.split('|').filter((_, i) => i % 2 === 0).map(s => {
                const name = s.split('(')[0].trim();
                const ext = s.match(/\*\.([a-zA-Z0-9]+)/)?.[1] || "";
                return { name, extensions: [ext] };
            }).filter(f => f.extensions[0] !== "") :
            [{ name: "Markdown Files", extensions: ["md"] }];

        return await withDpiContext(async () => {
            try {
                console.log("[showSaveFileDialog] Calling nfd.saveFile...");
                const resultPath = await nfd.saveFile({
                    defaultPath,
                    defaultName,
                    filters,
                    parentWindow: getHwnd()
                });
                
                console.log("[showSaveFileDialog] Result:", resultPath);
                return resultPath;
            } catch (err) {
                console.error("[showSaveFileDialog] NFD Error:", err);
                return null;
            }
        });
    },

    showFolderBrowserDialog: async (params: { defaultPath?: string; title?: string }) => {
        const defaultPath = params.defaultPath || "";

        return await withDpiContext(async () => {
            try {
                console.log("[showFolderBrowserDialog] Calling nfd.pickFolder...");
                const resultPath = await nfd.pickFolder({
                    defaultPath,
                    parentWindow: getHwnd()
                });
                
                console.log("[showFolderBrowserDialog] Result:", resultPath);
                return resultPath;
            } catch (err) {
                console.error("[showFolderBrowserDialog] NFD Error:", err);
                return null;
            }
        });
    },

    saveImage: async ({ targetDir, fileName, base64Data }: { targetDir: string; fileName: string; base64Data: string }) => {
        try {
            const assetsDir = join(targetDir, "assets");
            await ensureDir(assetsDir);

            // Strip base64 prefix if exists (data:image/png;base64,...)
            const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, "");
            const buffer = Buffer.from(base64Content, 'base64');
            
            const uniqueFileName = `${Date.now()}-${fileName}`;
            const filePath = join(assetsDir, uniqueFileName);
            await writeFile(filePath, buffer);
            
            // Return URL-friendly relative path (always using / even on Windows)
            return { success: true, relativePath: "assets/" + uniqueFileName };
        } catch (error: any) {
            console.error("[saveImage] Failed:", error);
            return { success: false, relativePath: "", error: error.message };
        }
    },

    copyImage: async ({ targetDir, sourcePath }: { targetDir: string; sourcePath: string }) => {
        try {
            const assetsDir = join(targetDir, "assets");
            await ensureDir(assetsDir);

            const fileName = `${Date.now()}-${basename(sourcePath)}`;
            const destPath = join(assetsDir, fileName);
            
            await copyFile(sourcePath, destPath);
            
            // Return URL-friendly relative path (always using / even on Windows)
            return { success: true, relativePath: "assets/" + fileName };
        } catch (error: any) {
            console.error("[copyImage] Failed:", error);
            return { success: false, relativePath: "", error: error.message };
        }
    },

    readImageAsDataUrl: async ({ filePath }: { filePath: string }) => {
        try {
            const data = await readFile(filePath);
            const ext = filePath.split('.').pop()?.toLowerCase() || 'png';
            const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
            const base64 = Buffer.from(data).toString('base64');
            return { dataUrl: `data:${mimeType};base64,${base64}` };
        } catch (error) {
            console.error("Error reading image as data URL:", error);
            return { dataUrl: null };
        }
    },

        renameEntry: async ({ oldPath, newName }: { oldPath: string; newName: string }) => {
        try {
            const dir = dirname(oldPath);
            const newPath = join(dir, newName);
            await rename(oldPath, newPath);
            return { success: true, newPath };
        } catch (error: any) {
            console.error("[renameEntry] Failed:", error);
            return { success: false, newPath: "", error: error.message };
        }
    },

    deleteEntry: async ({ path }: { path: string }) => {
        try {
            await rm(path, { recursive: true, force: true });
            return { success: true };
        } catch (error: any) {
            console.error("[deleteEntry] Failed:", error);
            return { success: false, error: error.message };
        }
    },

    moveEntry: async ({ oldPath, newParentDir }: { oldPath: string; newParentDir: string }) => {
        try {
            const name = basename(oldPath);
            const newPath = join(newParentDir, name);
            await rename(oldPath, newPath);
            return { success: true, newPath };
        } catch (error: any) {
            console.error("[moveEntry] Failed:", error);
            return { success: false, newPath: "", error: error.message };
        }
    },

    getLicenses: async ({}: {}): Promise<LicenseEntry[]> => {
        try {
            const licensesPath = join(import.meta.dir, "resources", "licenses.json");
            const data = await readFile(licensesPath, "utf-8");
            return JSON.parse(data);
        } catch (error) {
            console.error("Failed to read licenses.json:", error);
            return [];
        }
    },
};
