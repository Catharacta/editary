# Phase 18: Mermaid & KaTeXサポートの強化 (Split-View アーキテクチャ)

本ドキュメントは、Editaryのマークダウンエディタ機能強化フェーズ18（Mermaid図解およびKaTeX数式サポート）における実装詳細をまとめたものです。

## 概要
ユーザーからのフィードバックに基づき、KaTeX数式とMermaidグラフの作成時に入力欄（テキストエディタ）とレンダリング結果（プレビュー）を同時に表示する **Split-View (分割ビュー)** アーキテクチャを実装しました。これにより、標準のマークダウンの操作感を損なわずに、堅牢なリアルタイムプレビューを提供します。

---

## 1. 数式 (KaTeX) サポート

### 1.1 MathBlock (ブロック数式)
- **ファイル:** `src/mainview/extensions/math-block.ts`
- **特徴:** `$$` によって生成されるブロックレベルの数式ノード。
- **アーキテクチャ:** 
  - 上部に生のLaTeXコードを入力するエディタ部分（ProseMirrorの `contentDOM` によりネイティブ管理）を配置。
  - 下部にKaTeXのレンダリング結果を表示するプレビュー部分を配置。
- **利点:** 入力中に強制的にフォーカスが外れることや、テキストエリアを用いた強引なハックを排除し、Undo/Redo等の標準エディタ機能を維持しています。

### 1.2 MathInline (インライン数式)
- **ファイル:** `src/mainview/extensions/math-inline.ts`
- **特徴:** `$...$` によって生成されるインラインレベルの数式ノード（Atomノード）。
- **アーキテクチャ:** 
  - KaTeXでレンダリングされた数式のみを表示する表示専用ノード。
  - **編集UX:** ノードを選択した状態で「Backspace」を押すか、「ダブルクリック」することで、元のLaTeXソース（`$ ... $`）のテキストにシームレスに変換（Undo）され、再編集が可能です。

---

## 2. Mermaid サポート

### 2.1 EditaryCodeBlock (MermaidBlock)
- **ファイル:** `src/mainview/extensions/mermaid-block.ts`
- **特徴:** StarterKitの標準 `CodeBlock` (`@tiptap/extension-code-block`) を `.extend()` して上書きしたカスタム拡張。
- **アーキテクチャ (動的レンダリング):**
  - **Mermaidブロックの場合:** 言語が `mermaid` （`` ```mermaid ``）に設定された場合、MathBlockと同様の **Split-View** （上部コード入力 ＋ 下部Mermaidプレビュー）を自動的に構築します。
  - **その他のコードブロック:** 言語が `javascript` や `python` などの通常コードの場合、標準のコードブロック（`<pre><code class="...">`）としてフォールバックし、通常通りに動作します。
- **パフォーマンス最適化:** Mermaid SVGの再レンダリングは400msのデバウンス処理を挟んでおり、入力時のラグ（フリーズ）を防いでいます。

---

## 3. Markdown パーサーの統合

- **ファイル:** `src/mainview/markdown-parser.ts`
- **markdown-itの拡張:** `markdown-it-katex` を用いて、マークダウンロード時にインライン数式とブロック数式をパース。
  - KaTeXのカスタムレンダラーを定義し、MathInlineとMathBlockのための専用HTML（`data-type`）を生成。
- **Turndownの対応:** HTMLからマークダウンへの保存時（エクスポート）には、`data-type="math-block"` や `data-type="math-inline"` (及び `data-latex` 属性) を逆変換するカスタムルールを追加。
- **Mermaidのクリーンアップ:** `EditaryCodeBlock` が標準のコードブロックの仕様を引継いでいるため、カスタムMermaidパースルールは不要になり、マークダウンエンジンの標準処理（Fenced Code Block）としてクリーンに解決されました。

---

## 主な変更ファイル一覧
| パス | 種別 | 役割 |
|---|---|---|
| `src/mainview/extensions/math-block.ts` | 新規 | ブロック数式 (Split-View) のTiptap拡張 |
| `src/mainview/extensions/math-inline.ts` | 新規 | インライン数式 (Atomic) のTiptap拡張 |
| `src/mainview/extensions/mermaid-block.ts` | 更新 | `CodeBlock.extend()` を用いたMermaid/通常コード共存拡張 |
| `src/mainview/editor.ts` | 更新 | カスタム拡張の登録、StarterKit標準CodeBlockの無効化 |
| `src/mainview/markdown-parser.ts` | 更新 | HTML⇔Markdown 相互変換ロジックの KaTeX/Mermaid 対応 |
| `src/mainview/index.css` | 更新 | Split-View レイアウト、Mermaid/KaTeXプレビューのスタイル定義 |

以上の機能強固により、技術文書や研究ノートの執筆に適した堅牢で美しいマークダウン入力環境が完成しました。
