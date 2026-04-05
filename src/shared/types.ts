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
 * Metadata for a software library's license.
 */
export type LicenseEntry = {
    name: string;
    type: string;
    copyright: string;
    text: string;
};

export type SearchMatch = {
    line: number;
    text: string;
};

export type SearchResult = {
    filePath: string;
    fileName: string;
    matches: SearchMatch[];
};

/**
 * RPC schema for communication between the Bun main process and the Webview.
 * All file system operations run in Bun; UI interactions run in the Webview.
 */
export type EditaryRPCType = {
    bun: RPCSchema<{
        requests: {
            /** Search for a query string in all .md files within a directory */
            searchInFiles: {
                params: { query: string; dirPath: string };
                response: SearchResult[];
            };
            /** Open a native folder dialog and return the selected folder path */
            openFolder: {
                params: {};
                response: string | null;
            };
            /** List files in the given directory (optionally recursive) */
            readDirectory: {
                params: { dirPath: string; recursive?: boolean };
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
                response: LicenseEntry[];
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
            /** Rename a file or directory */
            renameEntry: {
                params: { oldPath: string; newName: string };
                response: { success: boolean; newPath: string; error?: string };
            };
            /** Delete a file or directory */
            deleteEntry: {
                params: { path: string };
                response: { success: boolean; error?: string };
            };
            /** Move a file or directory */
            moveEntry: {
                params: { oldPath: string; newParentDir: string };
                response: { success: boolean; newPath: string; error?: string };
            };
            /** Get application version from package.json */
            getVersion: {
                params: {};
                response: string;
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
