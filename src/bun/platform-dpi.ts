import { dlopen, FFIType } from "bun:ffi";

/**
 * ElectroBun アプリケーションの DPI 認識設定を初期化します。
 * この関数はウィンドウや WebView が作成される前に呼び出す必要があります。
 * 
 * Windows: Win32 API を呼び出して Per-Monitor V2 DPI Awareness を有効にします。
 * Linux: GTK および WebKitGTK 向けにスケーリング環境変数を設定します。
 */
export function initializeDpiAwareness(): void {
  const platform = process.platform;

  if (platform === "win32") {
    setupWindowsDpi();
  } else if (platform === "linux") {
    setupLinuxDpi();
  }
  // macOS は OS レベルで良好にサポートされているため特別な処理は不要
}

let user32: any = null;
let shell32: any = null;

/**
 * Windows のタスクバーにおけるアプリの識別子 (AppUserModelID) を設定します。
 * これにより、タスクバーの右クリックメニューの名前やアイコンのグループ化が正しく行われます。
 */
export function setAppUserModelId(id: string): void {
  if (process.platform !== "win32") return;

  try {
    if (!shell32) {
      shell32 = dlopen("shell32.dll", {
        SetCurrentProcessExplicitAppUserModelID: {
          args: [FFIType.ptr],
          returns: FFIType.i32,
        },
      });
    }

    if (shell32.symbols.SetCurrentProcessExplicitAppUserModelID) {
      const idBuffer = Buffer.from(id + "\0", "utf16le");
      const hr = shell32.symbols.SetCurrentProcessExplicitAppUserModelID(idBuffer);
      if (hr === 0) {
        console.log(`[AUMID] Successfully set AppUserModelID to: ${id}`);
      } else {
        console.warn(`[AUMID] SetCurrentProcessExplicitAppUserModelID returned HRESULT: 0x${(hr >>> 0).toString(16)}`);
      }
    }
  } catch (e) {
    console.error("[AUMID] Failed to set AppUserModelID:", e);
  }
}

function setupWindowsDpi() {
  try {
    // 1. 最優先: SetProcessDpiAwarenessContext (Windows 10 Anniversary Update 以降)
    user32 = dlopen("user32.dll", {
      SetProcessDpiAwarenessContext: {
        args: [FFIType.i32],
        returns: FFIType.bool,
      },
      SetThreadDpiAwarenessContext: {
        args: [FFIType.i32],
        returns: FFIType.i32, // Returns the previous context
      },
      GetThreadDpiAwarenessContext: {
        args: [],
        returns: FFIType.i32,
      },
      SetProcessDPIAware: { // フォールバック 2 (Windows Vista 以降)
        args: [],
        returns: FFIType.bool,
      },
      FindWindowW: {
        args: [FFIType.ptr, FFIType.ptr],
        returns: FFIType.ptr,
      },
      SendMessageW: {
        args: [FFIType.ptr, FFIType.u32, FFIType.u64, FFIType.u64],
        returns: FFIType.ptr,
      },
      LoadImageW: {
        args: [FFIType.ptr, FFIType.ptr, FFIType.u32, FFIType.i32, FFIType.i32, FFIType.u32],
        returns: FFIType.ptr,
      }
    });

    const result = user32.symbols.SetProcessDpiAwarenessContext(-4);
    if (result) {
      console.log("[DPI] Windows: Per-Monitor V2 DPI Awareness enabled via user32.dll");
      return;
    } else {
      console.warn("[DPI] Windows: SetProcessDpiAwarenessContext(-4) returned false. It might have been set already.");
      // 現在のコンテキストを確認
      const current = user32.symbols.GetThreadDpiAwarenessContext();
      console.log(`[DPI] Current Thread DPI context: ${current}`);
    }

    // 2. フォールバック 1: SetProcessDpiAwareness (Windows 8.1 以降)
    // PROCESS_PER_MONITOR_DPI_AWARE = 2
    try {
      const shcore = dlopen("shcore.dll", {
        SetProcessDpiAwareness: {
          args: [FFIType.i32],
          returns: FFIType.i32,
        },
      });
      
      const S_OK = 0;
      const shResult = shcore.symbols.SetProcessDpiAwareness(2);
      if (shResult === S_OK) {
        console.log("[DPI] Windows: Per-Monitor DPI Awareness enabled via shcore.dll");
        return;
      } else {
        console.warn(`[DPI] Windows: SetProcessDpiAwareness(2) returned ${shResult}`);
      }
    } catch (e) {
      // shcore.dll が存在しないか、呼び出しに失敗した場合は無視して次のフォールバックへ
    }

    // 3. フォールバック 2: SetProcessDPIAware (Windows Vista 以降)
    if (user32.symbols.SetProcessDPIAware()) {
      console.log("[DPI] Windows: System DPI Awareness enabled (Fallback)");
    } else {
      console.error("[DPI] Windows: SetProcessDPIAware() failed.");
    }
  } catch (error) {
    console.error("[DPI] Failed to initialize Windows DPI awareness:", error);
  }
}

/**
 * 特定の処理（ダイアログ表示など）を実行する間だけ、現在のスレッドの DPI 認識を
 * Per-Monitor V2 (-4) に設定します。非同期処理 (Promise) にも対応しています。
 */
export async function withDpiContext<T>(callback: () => Promise<T> | T): Promise<T> {
  if (process.platform !== "win32") {
    return await callback();
  }

  // initializeDpiAwareness が呼ばれていない場合に備えて DLL をロード
  if (!user32) {
    try {
      user32 = dlopen("user32.dll", {
        SetThreadDpiAwarenessContext: {
          args: [FFIType.i32],
          returns: FFIType.i32,
        }
      });
    } catch (e) {
      return await callback();
    }
  }

  if (!user32.symbols.SetThreadDpiAwarenessContext) {
    return await callback();
  }

  // DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 = -4
  const previousContext = user32.symbols.SetThreadDpiAwarenessContext(-4);
  try {
    return await callback();
  } finally {
    // 元のコンテキストに戻す
    user32.symbols.SetThreadDpiAwarenessContext(previousContext);
  }
}

/**
 * ウィンドウのタイトルから HWND (Windows Window Handle) を取得します。
 */
export function getWindowHandle(title: string): any {
  if (process.platform !== "win32") return null;
  
  if (!user32) {
    setupWindowsDpi();
  }

  if (!user32.symbols.FindWindowW) return null;

  // Bun.ffi で Wide String (Uint16Array) を渡す必要がある
  const tryFind = (t: string) => {
    const titleBuffer = Buffer.from(t + "\0", "utf16le");
    return user32.symbols.FindWindowW(null, titleBuffer);
  };

  // 1. そのままのタイトルで試行
  console.log(`[DPI] Attempting to find window with title: "${title}"`);
  let hwnd = tryFind(title);
  
  // 2. 見つからない場合は -dev を付けて試行 (ElectroBun の dev ビルド用)
  if ((!hwnd || hwnd === 0n) && !title.endsWith("-dev")) {
    console.log(`[DPI] Window "${title}" not found. Trying with "-dev" suffix...`);
    hwnd = tryFind(title + "-dev");
  }
  
  if (hwnd && hwnd !== 0n) {
    console.log(`[DPI] Found HWND for window "${title}": 0x${hwnd.toString(16)}`);
  } else {
    console.warn(`[DPI] Could not find HWND for window "${title}" after all attempts.`);
  }
  
  return hwnd;
}

/**
 * 指定したウィンドウハンドルにアイコンを設定します。
 */
export function setWindowIcon(hwnd: any, iconPath: string): void {
  if (process.platform !== "win32" || !hwnd || !user32) return;

  const WM_SETICON = 0x0080;
  const ICON_SMALL = 0;
  const ICON_BIG = 1;
  const IMAGE_ICON = 1;
  const LR_LOADFROMFILE = 0x00000010;
  const LR_DEFAULTSIZE = 0x00000040;

  try {
    const iconPathBuffer = Buffer.from(iconPath + "\0", "utf16le");
    
    // アイコンを読み込む (LoadImageW)
    console.log(`[Icon] Loading icon from path: "${iconPath}"`);
    const hIcon = user32.symbols.LoadImageW(
      null,
      iconPathBuffer,
      IMAGE_ICON,
      0, 0,
      LR_LOADFROMFILE | LR_DEFAULTSIZE
    );

    if (hIcon && hIcon !== 0n) {
      console.log(`[Icon] Icon loaded successfully. HICON: 0x${hIcon.toString(16)}`);
      // 大アイコンを設定 (タスクバー、タスク切替)
      user32.symbols.SendMessageW(hwnd, WM_SETICON, BigInt(ICON_BIG), hIcon);
      // 小アイコンを設定 (タイトルバー、プレビュー)
      user32.symbols.SendMessageW(hwnd, WM_SETICON, BigInt(ICON_SMALL), hIcon);
      
      console.log(`[Icon] WM_SETICON messages sent to HWND 0x${hwnd.toString(16)}`);
    } else {
      console.warn(`[Icon] Failed to load icon (LoadImageW returned 0). Path: "${iconPath}"`);
    }
  } catch (error) {
    console.error(`[Icon] Error setting window icon:`, error);
  }
}

function setupLinuxDpi() {
  // WebKitGTK および GTK+ アプリケーションにおける HiDPI スケーリングの設定
  // ElectroBun アプリがぼやけるのを防ぐための環境変数
  
  // ユーザーが手動で設定していない場合のみ自動設定する
  if (!process.env.GDK_SCALE) {
    // NOTE: Node.js/Bun 環境からは実際のモニタースケールを取得するのが難しいため、
    // まずは GTK 側での自動スケーリングを促すか、デフォルトの挙動を修正することを試みます。
    
    // GDK_BACKEND を wayland に優先的に設定することで、Wayland 環境での
    // ネイティブなスケーリングを有効にするアプローチもありますが、
    // ElectroBun (CEF等) の互換性を考慮し、ここでは設定しません。
    
    // GDK_SCALE などの強制は副作用があるため、現状はログを残すのみとし、
    // 将来的に Linux 特有の実装が必要になった場合の拡張ポイントとしておきます。
    console.log("[DPI] Linux: DPI initialization point reached. Relying on OS window manager.");
  }
}
