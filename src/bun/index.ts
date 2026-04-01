import { join } from "path";

// Windowsの場合、WebView2のユーザーデータフォルダを書き込み可能な場所にリダイレクトします
// この処理は Electrobun のいかなるモジュールが読み込まれるよりも前に（インポートの巻き上げを防ぐために）
// 物理的なファイルレベルで分離して実行する必要があります
if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA || join(process.env.USERPROFILE || "", "AppData", "Local");
    process.env.WEBVIEW2_USER_DATA_FOLDER = join(localAppData, "Editary", "WebView2");
}

// 動的にメイン実行ファイルを読み込むことで、環境変数の設定が先に完了していることを保証します
// Bun のバンドラーはこの `import()` を動的インポートとして扱い、
// エントリポイント内の同期コードが先に実行されることを保証します
import("./main").catch(err => {
    console.error("Failed to start application main loop:", err);
    process.exit(1);
});
