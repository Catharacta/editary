import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, extname, basename } from "node:path";
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
 * File operation handlers for RPC requests from the Webview.
 */
export const handleFileOperations = {
    openFolder: async () => {
        // ElectroBun does not have a built-in folder dialog yet.
        // For now, we return null and will integrate native dialog later.
        // TODO: Integrate native folder picker dialog when available
        return null;
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
            await writeFile(filePath, content, "utf-8");
            return true;
        } catch (error) {
            console.error(`Failed to write file: ${filePath}`, error);
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
};
