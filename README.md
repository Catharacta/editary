# Editary

**Editary** は、Tauri と React (CodeMirror 6) で構築された、高速でモダンなMarkdownエディタです。
Windowsネイティブ（Tauri）のパフォーマンスと、Web技術による柔軟なUIを組み合わせています。

## 特徴 (MVP)

*   **高速な起動と動作**: Rustバックエンドによる軽量・高速なファイル操作。
*   **垂直タブ (Vertical Tabs)**: サイドバーでのファイル管理。
*   **プロジェクトモード (NEW)**: フォルダを開くとツリービューとプロジェクト検索が有効になるハイブリッド設計。
*   **画面分割 (Split View)**: 左右並列での編集・プレビュー。
*   **モダンなUI**: ダークモード標準搭載（ライトモード切替可）、CodeMirrorによるリッチな編集体験。
*   **ファイル監視**: 外部エディタでの変更を即座に検知し、Reloadをサポート。
*   **Untitled連番**: 新規作成時のスマートなファイル名生成。
*   **信頼性**: 安全な保存フロー、競合検知。

## 技術スタック

*   **Frontend**: React, TypeScript, Vite, Tailwind (なし, Pure CSS), CodeMirror 6
*   **Backend**: Rust (Tauri v2)
*   **State Management**: Zustand
*   **Style**: Pure CSS (CSS Variables for theming)

## 開発環境のセットアップ

### 前提条件
*   Node.js (v18+)
*   Rust (Latest stable)
*   Visual Studio Build Tools (C++ Desktop Development)

### 起動方法

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動 (Frontend + Rust Backend)
npm run tauri dev
```

### テスト (E2E)

Playwright を使用した End-to-End テストを実行するには:

```bash
# E2Eテストの実行 (Headless Mode)
npm run test:e2e

# UIモードでの実行 (デバッグ用)
npx playwright test --ui
```

## ビルド

配布用インストーラー（.msi）を作成する場合：

```bash
npm run tauri build
```
ビルド成果物は `src-tauri/target/release/bundle/msi/` に生成されます。

## ライセンス
MIT
