import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    name: "Editary",
    identifier: "dev.catharacta.editary",
    version: "0.1.0",
  },
  runtime: {
    exitOnLastWindowClosed: true,
  },
  build: {
    bun: {
      entrypoint: "src/bun/index.ts",
    },
  },
} satisfies ElectrobunConfig;
