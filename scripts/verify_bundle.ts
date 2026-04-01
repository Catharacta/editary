import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * 最終生成された index.js が壊れていないか、期待される設定が含まれているかを検証します。
 */
const buildDir = join(process.cwd(), "build", "stable-win-x64", "Editary");
const indexPath = join(buildDir, "Resources", "app", "bun", "index.js");

function verify() {
    console.log(`[VERIFY] Checking bundle integrity: ${indexPath}`);

    if (!existsSync(indexPath)) {
        console.error("FAILED: index.js not found!");
        process.exit(1);
    }

    try {
        const content = readFileSync(indexPath, 'utf-8');
        const errors: string[] = [];

        // 1. ブートストラップの存在確認
        if (!content.includes('WEBVIEW2_USER_DATA_FOLDER')) {
            errors.push("Bootstrap code (WEBVIEW2_USER_DATA_FOLDER) missing from index.js.");
        }

        // 2. ESM 内での require 使用チェック（冒頭部分のみ）
        const firstLines = content.slice(0, 1000);
        if (firstLines.includes('require(')) {
            // コメント内の require ではないことを確認（簡易）
            if (!firstLines.includes('// require(')) {
                console.warn("[WARN] Presence of 'require' in ESM bootstrap detected. Ensure this is intentional.");
            }
        }

        // 3. 汚染チェック（ビルドスクリプトの混入）
        // 特に失敗時に混入していた特徴的な文字列を検索
        // "update.bat" は Electrobun 正規の Updater コードに含まれるため除外
        const contaminationMarkers = ['returte.bat'];
        contaminationMarkers.forEach(marker => {
            if (content.includes(marker)) {
                errors.push(`CORRUPTION DETECTED: Illegal code snippet found in index.js (Marker: "${marker}")`);
            }
        });

        if (errors.length > 0) {
            console.error("\n[VERIFICATION FAILED]");
            errors.forEach(err => console.error(`- ${err}`));
            process.exit(1);
        }

        console.log("[VERIFY] Bundle integrity PASSED!");
    } catch (e: any) {
        console.error("[VERIFY] Error during verification:", e.message);
        process.exit(1);
    }
}

verify();
