# 開発ガイド

## 技術スタック

- **フロントエンド**: React 19 + TypeScript + Vite + TanStack Router/Query
- **バックエンド**: Rust (Tauri 2)
- **スタイリング**: Tailwind CSS 4 + shadcn/ui
- **認証**: OAuth 2.0 (Cloudflare Workers)
- **ツール**: pnpm + mise + Biome

## 環境構築

### 必須ツール

```bash
# miseのインストール
# macOS (Homebrew)
brew install mise

# macOS/Linux (公式インストーラー)
curl https://mise.run | sh

# 依存関係のインストール
mise install
mise exec -- pnpm install
```

### 環境変数設定

#### 1. Tauri（デスクトップアプリ）

```bash
cd src-tauri/.cargo
cp config.toml.example config.toml
```

`config.toml`を編集：
```toml
[env]
HUBSPOT_CLIENT_ID = "your_client_id"
OAUTH_WORKER_URL = "https://your-worker.workers.dev"
TAURI_SIGNING_PRIVATE_KEY = "ask_project_owner"
TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "ask_project_owner"
```

**重要**: 署名鍵情報はプロジェクト責任者に確認してください。

#### 2. Cloudflare Workers（OAuth Proxy）

```bash
cd cloudflare-workers

# npmスクリプトを使用（推奨）
mise exec -- pnpm run set-env:client
mise exec -- pnpm run set-env:secret

# または直接実行
mise exec -- pnpm wrangler secret put HUBSPOT_CLIENT_ID
mise exec -- pnpm wrangler secret put HUBSPOT_CLIENT_SECRET
```

#### 3. HubSpot公開アプリ

1. [HubSpot Developer Account](https://developers.hubspot.com/)でアプリ作成
2. **Redirect URI**: `https://your-worker.workers.dev/oauth/callback`
3. **Scopes**: `oauth`, `crm.objects.*`, `crm.schemas.*`, `files`, `tickets`

## 開発コマンド

### 基本

```bash
# 開発サーバー起動（ホットリロード）
mise exec -- pnpm dev

# デバッグビルド（OAuth認証テスト用）
mise exec -- pnpm build:debug

# 本番ビルド
mise exec -- pnpm build
```

### コード品質

```bash
# 型チェック
mise exec -- pnpm exec tsc --noEmit

# リント
mise exec -- pnpm lint          # フロントエンド
mise exec -- pnpm lint:rust     # Rust

# フォーマット
mise exec -- pnpm format        # フロントエンド
mise exec -- pnpm format:rust   # Rust
mise exec -- pnpm format:all    # 全て

# テスト
mise exec -- pnpm test
mise exec -- pnpm test:ui       # UI付き
```

### Cloudflare Workers

```bash
cd cloudflare-workers

# ローカル開発
mise exec -- pnpm dev

# デプロイ
mise exec -- pnpm deploy
```

## プロジェクト構成

```
.
├── src/                    # フロントエンド（React）
│   ├── routes/            # TanStack Router（ファイルベース）
│   ├── components/        # UIコンポーネント
│   ├── hooks/             # カスタムフック
│   ├── stores/            # Zustand状態管理
│   └── lib/               # ユーティリティ
├── src-tauri/             # バックエンド（Rust）
│   ├── src/               # Rustソースコード
│   └── .cargo/config.toml # 環境変数（Git管理外）
├── cloudflare-workers/    # OAuth Proxy
├── hsapp/                 # HubSpot Project（オプション）
└── scripts/               # ビルドスクリプト
```

## 開発フロー

### OAuth認証のテスト

**重要**: 開発モード（`pnpm dev`）ではDeep Linkが動作しないため、OAuth認証をテストできません。

```bash
# デバッグビルドを使用
mise exec -- pnpm build:debug
```

これでRust側のログが表示され、Deep Linkも動作します。

### ビルド成果物

- **macOS**: `src-tauri/target/release/bundle/dmg/*.dmg`
- **Windows**: `src-tauri/target/release/bundle/msi/*.msi`
- **Linux**: `src-tauri/target/release/bundle/appimage/*.AppImage`

## トラブルシューティング

### 環境変数が反映されない

```bash
cd src-tauri
cargo clean
mise exec -- cargo build
```

### OAuth認証エラー

1. Workerの動作確認:
```bash
curl https://your-worker.workers.dev/health
```

2. デバッグログ確認:
```bash
mise exec -- pnpm build:debug
```

3. HubSpotアプリのRedirect URI確認

### Deep Link未登録（macOS）

```bash
# 登録確認
/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister -dump | grep sfhsfiletrans

# 再ビルド
rm -rf src-tauri/target/release/bundle
mise exec -- pnpm build:debug
```

### pnpm/cargo/nodeコマンドが見つからない

必ず`mise exec --`を使用:
```bash
mise exec -- pnpm install
mise exec -- cargo build
```

## リリース

### 手動リリース

```bash
# バージョン更新
./scripts/bump-version.sh 1.0.0
```

### 自動リリース（GitHub Actions）

1. GitHubの**Actions**タブ
2. **Release**ワークフロー選択
3. **Run workflow** → バージョン入力
4. 自動でビルド・リリース作成

### 必要なGitHub Secrets

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- `HUBSPOT_CLIENT_ID`
- `OAUTH_WORKER_URL`

## セキュリティ

- **Client ID**: バイナリに埋め込み（公開情報）
- **Client Secret**: Cloudflare Workersで保護
- **Access Token**: OSキーチェーンに暗号化保存
- **自動更新**: コード署名で検証

## 参考リンク

- [Tauri Documentation](https://tauri.app/)
- [TanStack Router](https://tanstack.com/router)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [HubSpot API](https://developers.hubspot.com/docs/api/overview)
