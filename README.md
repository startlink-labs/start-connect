# SF-HS File Transfer App

Salesforce to HubSpot ファイル転送デスクトップアプリケーション

## 技術スタック

- **フロントエンド**: React 19 + TypeScript + Vite + TanStack Router/Query
- **バックエンド**: Rust (Tauri 2)
- **スタイリング**: Tailwind CSS 4 + shadcn/ui
- **認証**: OAuth 2.0 (Cloudflare Workers経由)

## クイックスタート

### 必要な環境

- Node.js 25
- pnpm 10
- Rust 1.92
- mise（ランタイム管理）

### インストール

```bash
# 依存関係のインストール
mise exec -- pnpm install
```

### 開発

```bash
# 開発サーバー起動
mise exec -- pnpm dev
```

**注意**: OAuth認証をテストするには[デバッグビルド](#oauth認証のテスト)を使用してください。

## ドキュメント

詳細は [DEVELOPMENT.md](./DEVELOPMENT.md) を参照してください。

## 主な機能

- HubSpot OAuth 2.0認証（自動トークンリフレッシュ）
- SalesforceのContentVersionとContentDocumentLinkのCSV処理
- HubSpotへのファイルアップロードとノート作成
- macOS/Windows/Linux対応

## コマンド

```bash
# 開発
mise exec -- pnpm dev

# デバッグビルド（OAuth認証テスト用）
mise exec -- pnpm build:debug
mise exec -- pnpm run:debug

# 本番ビルド
mise exec -- pnpm build

# テスト・リント
mise exec -- pnpm test
mise exec -- pnpm lint
mise exec -- pnpm format:all
```

## ライセンス

Private
