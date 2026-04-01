import { execSync } from "child_process";
import { existsSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, appendFileSync, unlinkSync, renameSync, readdirSync, lstatSync } from "fs";
import { join, dirname, resolve } from "path";

const projectRoot = process.cwd();
const buildDir = join(projectRoot, "build", "stable-win-x64", "Editary");
const binDir = join(buildDir, "bin");
const resourcesDir = join(buildDir, "Resources");
const appDir = join(resourcesDir, "app");

function copyRecursiveSync(src: string, dest: string) {
    if (lstatSync(src).isDirectory()) {
        if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
        readdirSync(src).forEach(child => {
            copyRecursiveSync(join(src, child), join(dest, child));
        });
    } else {
        copyFileSync(src, dest);
    }
}

async function fixBuild() {
    console.log("Starting Fixed Build (Bypassing Electrobun CLI)...");

    // 1. ディレクトリの作成
    [binDir, appDir, join(appDir, "bun"), join(appDir, "views", "mainview")].forEach(dir => {
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    });

    // 2. JS のバンドル (Bun)
    console.log("Bundling Bun code...");
    execSync(`bun build src/bun/index.ts --target=bun --outdir=${join(appDir, "bun")} --minify`, { stdio: "inherit" });

    // 3. index.js の冒頭に環境設定コードを強制挿入 (Prepend - Safe Method)
    console.log("Prepending bootstrap code to index.js (Using safe temporary file method)...");
    const indexPath = join(appDir, "bun", "index.js");
    const tempPath = indexPath + ".tmp";
    
    const bootstrapCode = `
if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
        process.env.WEBVIEW2_USER_DATA_FOLDER = localAppData + '\\\\Editary\\\\WebView2';
    }
}
`;
    // 安全にファイルを再構築（メモリ汚染の回避）
    writeFileSync(tempPath, bootstrapCode, "utf-8");
    appendFileSync(tempPath, readFileSync(indexPath));
    
    // アトミックにファイルを置換
    unlinkSync(indexPath);
    renameSync(tempPath, indexPath);

    // 4. JS のバンドル (Browser / mainview)
    console.log("Bundling Browser code (mainview)...");
    execSync(`bun build src/mainview/index.ts --target=browser --outdir=${join(appDir, "views", "mainview")} --minify`, { stdio: "inherit" });

    // 5. アセットのコピー
    console.log("Copying assets...");
    copyFileSync("src/mainview/index.html", join(appDir, "views", "mainview", "index.html"));
    if (existsSync("src/mainview/assets")) copyRecursiveSync("src/mainview/assets", join(appDir, "views", "mainview", "assets"));
    if (existsSync("src/mainview/locales")) copyRecursiveSync("src/mainview/locales", join(appDir, "views", "mainview", "locales"));

    // 6. Electrobun ランタイムバイナリのコピー
    console.log("Copying Electrobun runtime binaries...");
    const electrobunDist = join(projectRoot, "node_modules", "electrobun", "dist-win-x64");
    const runtimeFiles = [
        "bun.exe", "libNativeWrapper.dll", "WebView2Loader.dll", 
        "launcher.exe", "bspatch.exe", "zig-zstd.exe", "d3dcompiler_47.dll",
        "webgpu_dawn.dll", "process_helper.exe"
    ];

    runtimeFiles.forEach(file => {
        const src = join(electrobunDist, file);
        if (existsSync(src)) {
            copyFileSync(src, join(binDir, file));
        } else {
            console.warn(`Warning: Runtime file not found: ${file}`);
        }
    });

    // nfd.dll のコピー
    const nfdSrc = join(projectRoot, "node_modules", "nativefiledialog-for-bun", "bin", "win32", "x64", "nfd.dll");
    const nfdDestDir = join(binDir, "win32", "x64");
    if (existsSync(nfdSrc)) {
        if (!existsSync(nfdDestDir)) mkdirSync(nfdDestDir, { recursive: true });
        copyFileSync(nfdSrc, join(nfdDestDir, "nfd.dll"));
    }

    // 7. メタデータの作成
    console.log("Generating metadata...");
    const buildJson = {
        name: "Editary",
        identifier: "dev.catharacta.editary",
        version: "0.1.32"
    };
    writeFileSync(join(resourcesDir, "build.json"), JSON.stringify(buildJson, null, 2));
    writeFileSync(join(resourcesDir, "version.json"), JSON.stringify(buildJson, null, 2));

    // 8. 不要なアーカイブファイルのクリーンアップ
    console.log("Cleaning up unnecessary archives from Resources...");
    readdirSync(resourcesDir).forEach(file => {
        if (file.endsWith(".tar.zst") || file.endsWith(".tar") || file.endsWith(".zip")) {
            console.log(`Removing: ${file}`);
            unlinkSync(join(resourcesDir, file));
        }
    });

    // 9. バンドルの整合性チェック
    console.log("\nVerifying bundle integrity...");
    execSync(`bun scripts/verify_bundle.ts`, { stdio: "inherit" });

    // 10. インストーラービルダーの呼び出し
    console.log("\nInvoking custom builder to create installer...");
    // カスタムビルダーは build/stable-win-x64/Editary が既にあるものとして動作する
    execSync(`bun run scripts/builder/src/index.ts build --target nsis`, { stdio: "inherit" });
    execSync(`bun run scripts/builder/src/index.ts build --target wix`, { stdio: "inherit" });

    console.log("\nFinished Fixed Build Successfully!");
}

fixBuild().catch(err => {
    console.error("Fixed Build FAILED:", err);
    process.exit(1);
});
