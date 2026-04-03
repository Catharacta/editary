import { join } from "path";
import { existsSync, readFileSync } from "fs";
import { initializeDpiAwareness, getWindowHandle, setWindowIcon } from "./platform-dpi";
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
    } else {
        // Fallback for development: read package.json directly
        const packageJsonPath = join(import.meta.dir, "../../package.json");
        if (existsSync(packageJsonPath)) {
            const packageInfo = JSON.parse(readFileSync(packageJsonPath, "utf8"));
            version = packageInfo.version;
        }
    }
} catch (e) {
    console.warn(`Failed to read version info:`, e);
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
            getVersion: () => version,
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

// ウィンドウアイコンの設定 (Windows 限定の FFI 経由)
if (process.platform === "win32") {
    let retries = 0;
    const maxRetries = 50; // 100ms * 50 = 5秒間
    const retryInterval = 100;

    const trySetIcon = () => {
        const hwnd = getWindowHandle("Editary");
        if (hwnd && hwnd !== 0n) {
            // パス候補のリスト
            // 1. Resources/icons/icon.ico (ビルド後の標準構造)
            // 2. Resources/app/views/mainview/assets/icon.ico (フォールバック)
            // 3. プロジェクトルートの icons/icon.ico (開発中プロセスcwd)
            const candidates = [
                join(resourcesDir, "icons/icon.ico"),
                join(resourcesDir, "app/views/mainview/assets/icon.ico"),
                join(process.cwd(), "icons/icon.ico")
            ];

            let foundPath: string | null = null;
            for (const p of candidates) {
                console.log(`[Icon] Checking icon candidate: ${p}`);
                if (existsSync(p)) {
                    foundPath = p;
                    break;
                }
            }
            
            if (foundPath) {
                console.log(`[Icon] Icon found! Applying: ${foundPath}`);
                setWindowIcon(hwnd, foundPath);
            } else {
                console.warn(`[Icon] Icon not found in any expected location.`);
                console.log(`[Icon] Search context - isPackaged: ${isPackaged}, resourcesDir: ${resourcesDir}, cwd: ${process.cwd()}, metaDir: ${import.meta.dir}`);
            }
        } else if (retries < maxRetries) {
            retries++;
            setTimeout(trySetIcon, retryInterval);
        } else {
            console.error(`[Icon] Giving up after ${maxRetries} retries. Window handle not found.`);
        }
    };

    trySetIcon();
}
