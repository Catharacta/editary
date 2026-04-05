import { dlopen, FFIType, type Pointer } from "bun:ffi";
import { APP_CONSTANTS } from "../shared/constants";

// Type definitions for Win32 handles and types
type HWND = number | bigint | Pointer;
type HANDLE = number | bigint | Pointer;
type PCWSTR = Pointer | null;

/**
 * Common Win32 constants.
 */
const WIN32_CONSTANTS = {
    CP_UTF8: 65001,
    MB_PRECOMPOSED: 0x00000001,
    IMAGE_ICON: 1,
    LR_LOADFROMFILE: 0x00000010,
    WM_SETICON: 0x00000080,
    ICON_SMALL: 0,
    ICON_BIG: 1,
} as const;

/**
 * Low-level interface for User32.dll function calls.
 */
const user32 = dlopen("user32.dll", {
    SetProcessDpiAwarenessContext: {
        args: ["isize"] as any,
        returns: "i32" as any,
    },
    SetProcessDPIAware: {
        args: [],
        returns: "i32" as any,
    },
    FindWindowW: {
        args: ["pointer", "pointer"] as any,
        returns: "isize" as any,
    },
    SendMessageW: {
        args: ["isize", "u32", "isize", "isize"] as any,
        returns: "isize" as any,
    },
    LoadImageW: {
        args: ["isize", "pointer", "u32", "i32", "i32", "u32"] as any,
        returns: "isize" as any,
    },
    SetThreadDpiAwarenessContext: {
        args: ["isize"] as any,
        returns: "isize" as any,
    },
    GetThreadDpiAwarenessContext: {
        args: [],
        returns: "isize" as any,
    },
} as any);

/**
 * Low-level interface for Shell32.dll function calls.
 */
const shell32 = dlopen("shell32.dll", {
    SetCurrentProcessExplicitAppUserModelID: {
        args: ["pointer"] as any,
        returns: "i32" as any,
    },
} as any);

/**
 * Helper to convert a JS string to a null-terminated UTF-16 pointer.
 */
function toWString(str: string): Uint8Array {
    return Buffer.from(str + "\0", "utf16le");
}

/**
 * Executes a callback with a specific DPI context.
 * Useful for native dialogs like NFD (Native File Dialog) which may otherwise 
 * appear blurry on high-DPI displays.
 */
export async function withDpiContext<T>(callback: () => Promise<T>): Promise<T> {
    if (process.platform !== "win32") return callback();

    // DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 is -4
    const DPI_V2 = -4n;
    let originalContext: any = null;

    try {
        if (user32.symbols.GetThreadDpiAwarenessContext && user32.symbols.SetThreadDpiAwarenessContext) {
            originalContext = user32.symbols.GetThreadDpiAwarenessContext();
            user32.symbols.SetThreadDpiAwarenessContext(DPI_V2 as any);
        }
    } catch (e) {
        console.error(`[FFI] Failed to set thread DPI context:`, e);
    }

    try {
        return await callback();
    } finally {
        try {
            if (originalContext && user32.symbols.SetThreadDpiAwarenessContext) {
                user32.symbols.SetThreadDpiAwarenessContext(originalContext);
            }
        } catch (e) {
            console.error(`[FFI] Failed to restore thread DPI context:`, e);
        }
    }
}

/**
 * Set the App User Model ID for the current process to support taskbar grouping.
 */
export function setAppUserModelId(aumid: string = APP_CONSTANTS.AUMID): void {
    if (process.platform !== "win32") return;

    try {
        const wAumid = toWString(aumid);
        const result = shell32.symbols.SetCurrentProcessExplicitAppUserModelID(wAumid);
        if (result !== 0) {
            console.error(`[FFI] Failed to set AUMID (${aumid}): ${result}`);
        }
    } catch (e) {
        console.error(`[FFI] Error calling SetCurrentProcessExplicitAppUserModelID:`, e);
    }
}

/**
 * Initialize DPI awareness for the process to prevent blurry UI on Windows.
 */
export function initializeDpiAwareness(): void {
    if (process.platform !== "win32") return;

    try {
        // DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 is -4
        // Passing -4 as isize instead of pointer avoids Bun FFI errors
        if (user32.symbols.SetProcessDpiAwarenessContext) {
            user32.symbols.SetProcessDpiAwarenessContext(-4);
        } else {
            user32.symbols.SetProcessDPIAware();
        }
    } catch (e) {
        console.error(`[FFI] DPI initialization failed:`, e);
    }
}

/**
 * Find the window handle (HWND) for a specific window title.
 */
export function getWindowHandle(title: string = APP_CONSTANTS.APP_NAME): bigint | null {
    if (process.platform !== "win32") return null;

    try {
        const wTitle = toWString(title);
        const hwnd = user32.symbols.FindWindowW(null, wTitle);
        
        if (hwnd) {
            return BigInt(hwnd as any);
        }
    } catch (e) {
        console.error(`[FFI] Error finding window handle:`, e);
    }
    return null;
}

/**
 * Set the window icon using a local .ico file.
 */
export function setWindowIcon(hwnd: bigint | number | Pointer, iconPath: string): void {
    if (process.platform !== "win32") return;

    try {
        const wPath = toWString(iconPath);
        
        // Load the icon
        const hIcon = user32.symbols.LoadImageW(
            null,
            wPath,
            WIN32_CONSTANTS.IMAGE_ICON,
            0, 0,
            WIN32_CONSTANTS.LR_LOADFROMFILE
        );

        if (hIcon) {
            // Set both big and small icons
            // Using isize for HWND and WPARAM/LPARAM avoids pointer conversion errors
            user32.symbols.SendMessageW(Number(hwnd), WIN32_CONSTANTS.WM_SETICON, WIN32_CONSTANTS.ICON_BIG, hIcon);
            user32.symbols.SendMessageW(Number(hwnd), WIN32_CONSTANTS.WM_SETICON, WIN32_CONSTANTS.ICON_SMALL, hIcon);
        }
    } catch (e) {
        console.error(`[FFI] Error setting window icon:`, e);
    }
}
