import type { RPCSchema } from "electrobun/bun";

/**
 * File system entry representing a file or directory in the sidebar tree.
 */
export type FileEntry = {
    name: string;
    path: string;
    isDirectory: boolean;
    children?: FileEntry[];
};

/**
 * RPC schema for communication between the Bun main process and the Webview.
 * All file system operations run in Bun; UI interactions run in the Webview.
 */
export type EditaryRPCType = {
    bun: RPCSchema<{
        requests: {
            /** Open a native folder dialog and return the selected folder path */
            openFolder: {
                params: {};
                response: string | null;
            };
            /** List all .md files in the given directory */
            readDirectory: {
                params: { dirPath: string };
                response: FileEntry[];
            };
            /** Read the content of a file */
            readFile: {
                params: { filePath: string };
                response: string;
            };
            /** Write content to a file (create or overwrite) */
            writeFile: {
                params: { filePath: string; content: string };
                response: boolean;
            };
            /** Create a new .md file */
            createFile: {
                params: { dirPath: string; fileName: string };
                response: string;
            };
            /** Create a new directory */
            createDirectory: {
                params: { dirPath: string; dirName: string };
                response: string;
            };
            /** Show native save file dialog */
            showSaveFileDialog: {
                params: { defaultPath?: string; title?: string; filter?: string };
                response: string | null;
            };
            /** Show native folder browser dialog */
            showFolderBrowserDialog: {
                params: { defaultPath?: string; title?: string };
                response: string | null;
            };
            /** Retrieve the list of module licenses */
            getLicenses: {
                params: {};
                response: any[];
            };
            /** Save an image from a base64 string or buffer to a specific path */
            saveImage: {
                params: { 
                    targetDir: string; 
                    fileName: string; 
                    base64Data: string; 
                };
                response: { success: boolean; relativePath: string; error?: string };
            };
            /** Copy an existing image file to the assets directory */
            copyImage: {
                params: { 
                    targetDir: string; 
                    sourcePath: string; 
                };
                response: { success: boolean; relativePath: string; error?: string };
            };
            /** Read an image and return it as a data URL for preview */
            readImageAsDataUrl: {
                params: { filePath: string };
                response: { dataUrl: string | null };
            };
        };
        messages: {
            /** Window control: close */
            closeWindow: {};
            /** Window control: minimize */
            minimizeWindow: {};
            /** Window control: maximize/unmaximize toggle */
            maximizeWindow: {};
        };
    }>;
    webview: RPCSchema<{
        requests: {};
        messages: {
            /** Notify webview that a file was saved successfully */
            fileSaved: { filePath: string };
        };
    }>;
};
