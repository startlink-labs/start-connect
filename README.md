# SF HS File Transfer App

Flask + React プロジェクト

## 開発環境

- Node.js 24
- Python 3.14
- pnpm 10
- uv 0.9

## セットアップ

```bash
# 依存関係のインストール
mise run install

# 開発サーバー起動
mise run dev
```

## その他のコマンド

```bash
# テスト実行
mise run test

# リント実行
mise run lint

# フォーマット実行
mise run format

# クリーンアップ
mise run clean
```

## プロジェクト構造

```
├── backend/          # Flask API
├── frontend/         # React App
└── mise.toml         # mise設定
```