# 技術スタック・開発ルール

## プロジェクト概要
- **アプリケーション**: Tauri デスクトップアプリ
- **フロントエンド**: React 19 + TypeScript + Vite
- **バックエンド**: Rust (Tauri)

## 技術スタック

### フロントエンド
- **React**: 19.2.0
- **TypeScript**: 5.9.3
- **ビルドツール**: Vite 7.2.4
- **ルーティング**: TanStack Router (ファイルベースルーティング)
- **状態管理**: Zustand
- **データフェッチング**: TanStack Query
- **スタイリング**: Tailwind CSS 4.1.18
- **UIコンポーネント**: Radix UI
- **アイコン**: Lucide React
- **テーマ**: next-themes

### 開発ツール
- **パッケージマネージャー**: pnpm (必須)
- **リンター/フォーマッター**: Biome (ESLintやPrettierは使用しない)
- **テスト**: Vitest + Testing Library + happy-dom
- **ランタイム管理**: mise (Node 25, pnpm 10, Rust 1.92)

### バックエンド
- **Tauri**: 2.9.6
- **Rust**: 1.92
- **フォーマッター**: rustfmt (公式)
- **リンター**: clippy (公式)

## CLIコマンド

### パッケージ管理
```bash
pnpm install          # 依存関係のインストール
pnpm add <package>    # パッケージ追加
pnpm remove <package> # パッケージ削除
```

### 開発・ビルド
```bash
pnpm dev              # Tauriアプリ起動（推奨）
pnpm tauri dev        # 同上
pnpm build            # 本番ビルド
pnpm tauri build      # 同上
pnpm vite             # Viteのみ起動（フロントエンドのみ）
pnpm vite:build       # Viteのみビルド
```

### コード品質
```bash
pnpm lint             # Biomeでリント（フロントエンド）
pnpm lint:rust        # Clippyでリント（Rust）
pnpm format           # Biomeでフォーマット（フロントエンド）
pnpm format:rust      # rustfmtでフォーマット（Rust）
pnpm format:all       # 全ファイルフォーマット
pnpm test             # テスト実行
pnpm test:ui          # Vitestのui起動
```

### miseタスク
```bash
mise run install      # 依存関係インストール
mise run dev          # 開発サーバー起動
mise run build        # ビルド
mise run test         # テスト
mise run lint         # リント
mise run format       # フォーマット
mise run clean        # クリーンアップ
```

## コーディング規約

### Biome設定（フロントエンド）
- **インデント**: 2スペース（TypeScript標準）
- **クォート**: ダブルクォート
- **インポート**: 自動整理有効
- **Tailwind**: ディレクティブサポート有効

### Rust設定（バックエンド）
- **インデント**: 2スペース
- **最大行幅**: 100文字
- **インポート整理**: Crate単位でグループ化
- **保存時フォーマット**: 自動実行（VSCode）

### ファイル構成
- **エイリアス**: `@/` = `./src/`
- **ルート**: `src/routes/` にファイルベースルーティング
- **コンポーネント**: `src/components/`
- **フック**: `src/hooks/`
- **ストア**: `src/stores/` (Zustand)
- **ライブラリ**: `src/lib/`

## 重要な注意事項
- **npm/yarnは使用禁止**: 必ずpnpmを使用
- **ESLint/Prettierは使用禁止**: Biomeを使用
- **Tauriコマンド**: フロントエンドとバックエンドを同時に起動するため `pnpm dev` を使用
- **AIのコマンド実行**: pnpm、node、npm、cargo、rustc等のコマンドを実行する際は、必ず `mise exec -- <command>` を使用すること（例: `mise exec -- pnpm install`、`mise exec -- pnpm dev`）
