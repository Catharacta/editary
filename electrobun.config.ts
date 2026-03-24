import type { ElectrobunConfig } from "electrobun";

const config = {
  name: "Editary",
  version: "0.1.19",
  app: {
    name: "Editary",
    identifier: "dev.catharacta.editary",
    version: "0.1.19",
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
  },
  windows: {
    icon: "icons/icon.ico",
    productId: "dev.catharacta.editary",
    installDir: "Editary",
  },
} as any;

export default config;
