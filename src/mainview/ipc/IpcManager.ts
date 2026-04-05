import { rpc } from "./index";
import type { FileEntry, LicenseEntry } from "../../shared/types";

/**
 * Manager for Inter-Process Communication (IPC) from the View side.
 * Provides a clean, typed interface to call main process functions.
 */
export class IpcManager {
    /**
     * Shows a native open folder dialog.
     */
    static async openFolder(): Promise<string | null> {
        try {
            return await rpc.request.openFolder({});
        } catch (error) {
            console.error("[IpcManager] openFolder failed:", error);
            return null;
        }
    }

    /**
     * Reads the contents of a directory.
     */
    static async readDirectory(dirPath: string): Promise<FileEntry[]> {
        try {
            return await rpc.request.readDirectory({ dirPath });
        } catch (error) {
            console.error(`[IpcManager] readDirectory failed: ${dirPath}`, error);
            return [];
        }
    }

    /**
     * Reads a file.
     */
    static async readFile(filePath: string): Promise<string> {
        try {
            return await rpc.request.readFile({ filePath });
        } catch (error) {
            console.error(`[IpcManager] readFile failed: ${filePath}`, error);
            throw error;
        }
    }

    /**
     * Writes to a file.
     */
    static async writeFile(filePath: string, content: string): Promise<boolean> {
        try {
            return await rpc.request.writeFile({ filePath, content });
        } catch (error) {
            console.error(`[IpcManager] writeFile failed: ${filePath}`, error);
            return false;
        }
    }

    /**
     * Creates a new file.
     */
    static async createFile(dirPath: string, fileName: string): Promise<string> {
        try {
            return await rpc.request.createFile({ dirPath, fileName });
        } catch (error) {
            console.error(`[IpcManager] createFile failed: ${dirPath}/${fileName}`, error);
            throw error;
        }
    }

    /**
     * Creates a new directory.
     */
    static async createDirectory(dirPath: string, dirName: string): Promise<string> {
        try {
            return await rpc.request.createDirectory({ dirPath, dirName });
        } catch (error) {
            console.error(`[IpcManager] createDirectory failed: ${dirPath}/${dirName}`, error);
            throw error;
        }
    }

    /**
     * Retrieves application licenses.
     */
    static async getLicenses(): Promise<LicenseEntry[]> {
        try {
            return await rpc.request.getLicenses({});
        } catch (error) {
            console.error("[IpcManager] getLicenses failed:", error);
            return [];
        }
    }

    /**
     * Renames an entry.
     */
    static async renameEntry(oldPath: string, newName: string) {
        try {
            return await rpc.request.renameEntry({ oldPath, newName });
        } catch (error) {
            console.error(`[IpcManager] renameEntry failed: ${oldPath}`, error);
            return { success: false, newPath: "", error: String(error) };
        }
    }

    /**
     * Deletes an entry.
     */
    static async deleteEntry(path: string) {
        try {
            return await rpc.request.deleteEntry({ path });
        } catch (error) {
            console.error(`[IpcManager] deleteEntry failed: ${path}`, error);
            return { success: false, error: String(error) };
        }
    }

    /**
     * Moves an entry.
     */
    static async moveEntry(oldPath: string, newParentDir: string) {
        try {
            return await rpc.request.moveEntry({ oldPath, newParentDir });
        } catch (error) {
            console.error(`[IpcManager] moveEntry failed: ${oldPath}`, error);
            return { success: false, newPath: "", error: String(error) };
        }
    }

    /**
     * Saves an image.
     */
    static async saveImage(targetDir: string, fileName: string, base64Data: string) {
        try {
            return await rpc.request.saveImage({ targetDir, fileName, base64Data });
        } catch (error) {
            console.error("[IpcManager] saveImage failed:", error);
            return { success: false, relativePath: "", error: String(error) };
        }
    }

    /**
     * Copies an image.
     */
    static async copyImage(targetDir: string, sourcePath: string) {
        try {
            return await rpc.request.copyImage({ targetDir, sourcePath });
        } catch (error) {
            console.error("[IpcManager] copyImage failed:", error);
            return { success: false, relativePath: "", error: String(error) };
        }
    }

    /**
     * Reads image as Data URL.
     */
    static async readImageAsDataUrl(filePath: string) {
        try {
            return await rpc.request.readImageAsDataUrl({ filePath });
        } catch (error) {
            console.error("[IpcManager] readImageAsDataUrl failed:", error);
            return { dataUrl: null };
        }
    }

    /**
     * Shows save file dialog.
     */
    static async showSaveFileDialog(defaultPath?: string, title?: string, filter?: string) {
        try {
            return await rpc.request.showSaveFileDialog({ defaultPath, title, filter });
        } catch (error) {
            console.error("[IpcManager] showSaveFileDialog failed:", error);
            return null;
        }
    }

    /**
     * Shows folder browser dialog.
     */
    static async showFolderBrowserDialog(defaultPath?: string, title?: string) {
        try {
            return await rpc.request.showFolderBrowserDialog({ defaultPath, title });
        } catch (error) {
            console.error("[IpcManager] showFolderBrowserDialog failed:", error);
            return null;
        }
    }

    /**
     * Window control: Close
     */
    static closeWindow() {
        rpc.send.closeWindow({});
    }

    /**
     * Window control: Minimize
     */
    static minimizeWindow() {
        rpc.send.minimizeWindow({});
    }

    /**
     * Window control: Maximize toggle
     */
    static maximizeWindow() {
        rpc.send.maximizeWindow({});
    }

    /**
     * Gets the application version.
     */
    static async getVersion(): Promise<string> {
        try {
            return await rpc.request.getVersion({});
        } catch (error) {
            console.error("[IpcManager] getVersion failed:", error);
            return "0.0.0";
        }
    }
}
