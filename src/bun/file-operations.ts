import { readdir, readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { join, extname, basename, dirname } from "node:path";
import type { FileEntry } from "../shared/types";

/**
 * Recursively read a directory and return file entries for .md files.
 */
async function getDirectoryEntries(dirPath: string): Promise<FileEntry[]> {
    const entries: FileEntry[] = [];

    try {
        const items = await readdir(dirPath, { withFileTypes: true });

        for (const item of items) {
            // Skip hidden files and directories
            if (item.name.startsWith(".")) continue;

            const fullPath = join(dirPath, item.name);

            if (item.isDirectory()) {
                const children = await getDirectoryEntries(fullPath);
                // Only include directories that contain .md files (directly or nested)
                if (children.length > 0) {
                    entries.push({
                        name: item.name,
                        path: fullPath,
                        isDirectory: true,
                        children,
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
export const handleFileOperations = {
    setMainWindow,

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

    readDirectory: async ({ dirPath }: { dirPath: string }) => {
        return getDirectoryEntries(dirPath);
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
};


