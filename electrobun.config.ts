import type { ElectrobunConfig } from "electrobun";

const config = {
  name: "Editary",
  author: "Catharacta",
  version: "0.1.35",
  app: {
    name: "Editary",
    identifier: "dev.catharacta.editary.v2",
    version: "0.1.35",
  },
  runtime: {
    exitOnLastWindowClosed: true,
  },
  build: {
    bun: {
      entrypoint: "src/bun/index.ts",
    },
    views: {
      mainview: {
        entrypoint: "src/mainview/index.ts",
      },
    },
    copy: {
      "src/mainview/index.html": "views/mainview/index.html",
      "src/mainview/index.css": "views/mainview/index.css",
      "src/mainview/assets": "views/mainview/assets",
      "src/mainview/locales": "views/mainview/locales",
      // nativefiledialog-for-bun のバイナリを同梱 (FFIバックエンド用)
      "node_modules/nativefiledialog-for-bun/bin/win32/x64/nfd.dll": "bin/win32/x64/nfd.dll",
    },
    // 軽量版 Bun (bunnyBun) を使用してパッケージ容量を削減
    bunnyBun: "bunny-bun-5258fb9",
    win: {
      icon: "icons/icon.ico",
      productId: "dev.catharacta.editary",
      installDir: "Editary",
      // Electrobun canary ビルドの ASAR バグ回避 (launcher.exe が app を見つけられない)
      useAsar: false,
    },
  },
} as any;

export default config;
