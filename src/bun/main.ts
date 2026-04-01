import { join } from "path";
import { existsSync, readFileSync } from "fs";
import { initializeDpiAwareness } from "./platform-dpi";
import { BrowserWindow, BrowserView } from "electrobun/bun";
import { type EditaryRPCType } from "../shared/types";
import { handleFileOperations } from "./file-operations";

// 初期化: アプリケーションとダイアログの解像度（DPI）を決定します
initializeDpiAwareness();

const isPackaged = import.meta.dir.includes("Resources");
const resourcesDir = isPackaged 
    ? join(import.meta.dir, "../..") // Resources/app/bun -> Resources
    : join(import.meta.dir, "../../Resources"); // src/bun -> Resources (dev時)

const versionJsonPath = join(resourcesDir, "version.json");

let version = "0.0.0";
try {
    if (existsSync(versionJsonPath)) {
        const versionInfo = JSON.parse(readFileSync(versionJsonPath, "utf8"));
        version = versionInfo.version;
    }
} catch (e) {
    console.warn(`Failed to read version.json at ${versionJsonPath}:`, e);
}

console.log(`Starting Editary v${version}...`);

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
            saveImage: handleFileOperations.saveImage,
            copyImage: handleFileOperations.copyImage,
            readImageAsDataUrl: handleFileOperations.readImageAsDataUrl,
            renameEntry: handleFileOperations.renameEntry,
            deleteEntry: handleFileOperations.deleteEntry,
            moveEntry: handleFileOperations.moveEntry,
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
