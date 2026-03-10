import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
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

import { Utils } from "electrobun/bun";

/**
 * File operation handlers for RPC requests from the Webview.
 */
export const handleFileOperations = {
    openFolder: async () => {
        console.log("[openFolder] Starting native folder dialog...");
        try {
            console.log("[openFolder] Calling Utils.openFileDialog...");
            const paths = await Utils.openFileDialog({
                canChooseFiles: false,
                canChooseDirectory: true,
                allowsMultipleSelection: false,
            });
            console.log("[openFolder] Result:", JSON.stringify(paths));
            // openFileDialog returns an array of paths, sometimes an empty array if cancelled
            if (paths && paths.length > 0 && paths[0] !== "") {
                console.log("[openFolder] Selected folder:", paths[0]);
                return paths[0];
            }
            console.log("[openFolder] No folder selected (cancelled or empty)");
            return null;
        } catch (error) {
            console.error("[openFolder] Error:", error);
            return null;
        }
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
            console.log(`[writeFile] Path: "${filePath}" (length: ${filePath.length}, charCodes: ${[...filePath].slice(0, 5).map(c => c.charCodeAt(0).toString(16)).join(',')})`);
            // Ensure parent directory exists
            const dir = dirname(filePath);
            await mkdir(dir, { recursive: true });
            await writeFile(filePath, content, "utf-8");
            console.log(`[writeFile] Success: ${filePath}`);
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
            await mkdir(dirPath, { recursive: true });
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
            await mkdir(newDirPath, { recursive: true });
            return newDirPath;
        } catch (error) {
            console.error(`Failed to create directory: ${newDirPath}`, error);
            throw new Error(`Cannot create directory: ${newDirPath}`);
        }
    },

    showSaveFileDialog: async (params: { defaultPath?: string; title?: string; filter?: string }) => {
        const { spawn } = await import("bun");
        const { dirname, basename } = await import("node:path");
        const defaultPath = params.defaultPath || "";
        const title = params.title || "ファイルを保存";
        const filter = params.filter || "Markdown Files (*.md)|*.md|All Files (*.*)|*.*";

        let dirPath = "";
        let fileName = "";
        if (defaultPath) {
            dirPath = dirname(defaultPath);
            fileName = basename(defaultPath);
        }

        // Escape single quotes for PowerShell string
        const safeDirPath = dirPath.replace(/'/g, "''");
        const safeFileName = fileName.replace(/'/g, "''");
        const safeFilter = filter.replace(/'/g, "''");
        const safeTitle = title.replace(/'/g, "''");

        const script = `
            [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
            Add-Type -AssemblyName System.Windows.Forms
            $dialog = New-Object System.Windows.Forms.SaveFileDialog
            $dialog.Filter = '${safeFilter}'
            $dialog.Title = '${safeTitle}'
            if ('${safeDirPath}') {
                $dialog.InitialDirectory = '${safeDirPath}'
            }
            if ('${safeFileName}') {
                $dialog.FileName = '${safeFileName}'
            }
            $result = $dialog.ShowDialog()
            if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
                Write-Output $dialog.FileName
            }
        `;

        try {
            console.log("[showSaveFileDialog] Spawning PowerShell...");
            const ps = spawn(["powershell.exe", "-NoProfile", "-Sta", "-Command", script]);
            const output = await new Response(ps.stdout).text();
            // Remove BOM (U+FEFF) and stray whitespace/newlines
            const resultPath = output.replace(/^\uFEFF/, '').replace(/[\r\n]+/g, '').trim();
            console.log(`[showSaveFileDialog] Raw output length: ${output.length}, cleaned path: "${resultPath}" (length: ${resultPath.length})`);
            if (resultPath) {
                return resultPath;
            }
            return null;
        } catch (err) {
            console.error("[showSaveFileDialog] PowerShell Error:", err);
            return null;
        }
    },

    showFolderBrowserDialog: async (params: { defaultPath?: string; title?: string }) => {
        const { spawn } = await import("bun");
        const defaultPath = params.defaultPath || "C:\\Users";
        const title = params.title || "フォルダを選択";

        // Escape single quotes
        const safePath = defaultPath.replace(/'/g, "''");
        const safeTitle = title.replace(/'/g, "''");

        const script = `
            [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
            Add-Type -AssemblyName System.Windows.Forms
            $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
            $dialog.Description = '${safeTitle}'
            if ('${safePath}') {
                $dialog.SelectedPath = '${safePath}'
            }
            $result = $dialog.ShowDialog()
            if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
                Write-Output $dialog.SelectedPath
            }
        `;

        try {
            console.log("[showFolderBrowserDialog] Spawning PowerShell...");
            const ps = spawn(["powershell.exe", "-NoProfile", "-Sta", "-Command", script]);
            const output = await new Response(ps.stdout).text();
            // Remove BOM (U+FEFF) and stray whitespace/newlines
            const resultPath = output.replace(/^\uFEFF/, '').replace(/[\r\n]+/g, '').trim();
            console.log(`[showFolderBrowserDialog] Raw output length: ${output.length}, cleaned path: "${resultPath}" (length: ${resultPath.length})`);
            if (resultPath) {
                return resultPath;
            }
            return null;
        } catch (err) {
            console.error("[showFolderBrowserDialog] PowerShell Error:", err);
            return null;
        }
    },
};
