import { initializeDpiAwareness } from "./platform-dpi";
// 初期化: アプリケーションとダイアログの解像度（DPI）を決定します
initializeDpiAwareness();

import { BrowserWindow, BrowserView } from "electrobun/bun";
import { type EditaryRPCType } from "../shared/types";
import { handleFileOperations } from "./file-operations";

// Define RPC handlers for the main process
const rpc = BrowserView.defineRPC<EditaryRPCType>({
    maxRequestTime: 300000, // 5 minutes (to allow time for native dialogs like SaveFileDialog)
    handlers: {
        requests: {
            openFolder: handleFileOperations.openFolder,
            readDirectory: handleFileOperations.readDirectory,
            readFile: handleFileOperations.readFile,
            writeFile: handleFileOperations.writeFile,
            createFile: handleFileOperations.createFile,
            createDirectory: handleFileOperations.createDirectory,
            showSaveFileDialog: handleFileOperations.showSaveFileDialog,
            showFolderBrowserDialog: handleFileOperations.showFolderBrowserDialog,
            getLicenses: handleFileOperations.getLicenses,
        },
        messages: {
            closeWindow: () => win.close(),
            minimizeWindow: () => win.minimize(),
            maximizeWindow: () => {
                if (win.isMaximized()) {
                    win.unmaximize();
                } else {
                    win.maximize();
                }
            },
        },
    },
});

// Create the main application window
const win = new BrowserWindow({
    title: "Editary",
    url: "views://mainview/index.html",
    frame: {
        width: 1200,
        height: 800,
        x: 100,
        y: 100,
    },
    titleBarStyle: "hidden",
    rpc,
});

// Windows のダイアログぼやけ防止のため、ハンドルを登録
handleFileOperations.setMainWindow(win);
