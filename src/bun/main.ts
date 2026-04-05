import { join } from "path";
import { existsSync } from "fs";
import { initializeDpiAwareness, getWindowHandle, setWindowIcon } from "./platform-dpi";
import { BrowserWindow, BrowserView } from "electrobun/bun";
import { type EditaryRPCType } from "../shared/types";
import { handleFileOperations, setMainWindow } from "./file-operations";
import { APP_CONSTANTS } from "../shared/constants";
import { PathManager } from "./utils/paths";

// 初期化: アプリケーションとダイアログの解像度（DPI）を決定します
initializeDpiAwareness();

console.log(`Starting ${APP_CONSTANTS.APP_NAME} v${APP_CONSTANTS.VERSION}...`);

// Define RPC handlers for the main process
const handlers: any = {
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
        getVersion: async () => APP_CONSTANTS.VERSION,
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
};

const rpc = BrowserView.defineRPC<EditaryRPCType>({
    maxRequestTime: APP_CONSTANTS.RPC_MAX_REQUEST_TIME,
    handlers: handlers,
});

// Create the main application window
const win = new BrowserWindow({
    title: APP_CONSTANTS.APP_NAME,
    url: "views://mainview/index.html",
    frame: {
        width: APP_CONSTANTS.DEFAULT_WINDOW_WIDTH,
        height: APP_CONSTANTS.DEFAULT_WINDOW_HEIGHT,
        x: APP_CONSTANTS.DEFAULT_WINDOW_X,
        y: APP_CONSTANTS.DEFAULT_WINDOW_Y,
    },
    titleBarStyle: "hidden",
    rpc,
});

// Windows のダイアログぼやけ防止のため、ハンドルを登録
setMainWindow(win);

// ウィンドウアイコンの設定 (Windows 限定の FFI 経由)
if (process.platform === "win32") {
    let retries = 0;
    const maxRetries = 50; 
    const retryInterval = 100;

    const trySetIcon = () => {
        const hwnd = getWindowHandle(APP_CONSTANTS.APP_NAME);
        if (hwnd && hwnd !== 0n) {
            const candidates = PathManager.getIconCandidates(process.cwd());

            let foundPath: string | null = null;
            for (const p of candidates) {
                if (existsSync(p)) {
                    foundPath = p;
                    break;
                }
            }
            
            if (foundPath) {
                setWindowIcon(hwnd, foundPath);
            }
        } else if (retries < maxRetries) {
            retries++;
            setTimeout(trySetIcon, retryInterval);
        }
    };

    trySetIcon();
}
