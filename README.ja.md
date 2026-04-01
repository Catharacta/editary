# <img src="docs/assets/icon.png" width="40" height="40" align="top" /> editary

[English version (README.md)](README.md)

**editary** は、Typora にインスパイアされた、大胆な **ネオ・ブルータリズム（Neo-brutalism）** デザインの Markdown エディタです。最先端の **Electrobun** (Bun ベースのデスクトップフレームワーク) を基盤に、高速なタイピング体験とモダンな UI を提供します。

![editary スクリーンショット](docs/assets/screenshot.png)

## ✨ 特徴

- **Typora ライクな執筆体験**: Tiptap をベースとしたリアルタイムプレビューにより、Markdown を直接シームレスに編集可能。
- **ネオ・ブルータリズム UI**: 太い境界線と鮮やかな色彩を用いた、大胆でハイコントラストなデザイン。
- **高度な Markdown サポート**:
  - 📊 **Mermaid**: ノート内に図解やチャートを直接作成。
  - 🧪 **KaTeX**: 公式や数式の高品質なタイポグラフィをサポート。
  - 📝 **タスクリスト**: インタラクティブなチェックボックスで TODO を管理。
  - 🧮 **テーブル**: シンプルなインターフェースでリッチなテーブル編集が可能。
- **モダンな技術スタック**: **Bun** の速度と **Electrobun** の柔軟性を最大限に活用。
- **検索と置換**: ドキュメント内のコンテンツを効率的に検索・修正。

## 🛠 技術スタック

- **フレームワーク**: [Electrobun](https://electrobun.dev/) (Native WebView + Bun Runtime)
- **ランタイム**: [Bun](https://bun.sh/)
- **エディタ**: [Tiptap](https://tiptap.dev/)
- **ビジュアル**: [Mermaid](https://mermaid.js.org/), [KaTeX](https://katex.org/)
- **ビルドツール**: [electrobun-builder](https://github.com/Catharacta/electrobun-builder) (NSIS/WiX インストーラー)

## 🚀 はじめに

### 前提条件

- [Bun](https://bun.sh/) がシステムにインストールされていること。

### ビルドと実行

1. リポジトリをクローン:
   ```bash
   git clone https://github.com/Catharacta/editary.git
   cd editary
   ```

2. 依存関係のインストール:
   ```bash
   bun install
   ```

3. 開発モードで実行:
   ```bash
   bun start
   ```

4. インストーラーのビルド (Windows):
   ```bash
   bun run build:installer
   ```

## 📦 ダウンロード

最新の Windows 用インストーラー (`.exe` および `.msi`) は、[Releases](https://github.com/Catharacta/editary/releases) ページから入手可能です。

## 📄 ライセンス

本プロジェクトは [MIT License](LICENSE) の下で公開されています。
