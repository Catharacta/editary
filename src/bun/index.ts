import { BrowserWindow, BrowserView } from "electrobun/bun";
import { type EditaryRPCType } from "../shared/types";
import { handleFileOperations } from "./file-operations";

// Define RPC handlers for the main process
const rpc = BrowserView.defineRPC<EditaryRPCType>({
    maxRequestTime: 10000,
    handlers: {
        requests: {
            openFolder: handleFileOperations.openFolder,
            readDirectory: handleFileOperations.readDirectory,
            readFile: handleFileOperations.readFile,
            writeFile: handleFileOperations.writeFile,
            createFile: handleFileOperations.createFile,
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
