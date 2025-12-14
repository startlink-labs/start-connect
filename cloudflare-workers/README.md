# HubSpot OAuth Proxy - Cloudflare Workers

デスクトップアプリ用のHubSpot OAuth 2.0プロキシサーバー

## セットアップ

### 1. 依存関係のインストール

```bash
cd cloudflare-workers
pnpm install
```

### 2. 環境変数の設定

`.dev.vars` ファイルを作成（ローカル開発用）:

```
HUBSPOT_CLIENT_ID=your_client_id
HUBSPOT_CLIENT_SECRET=your_client_secret
```

### 3. ローカル開発

```bash
pnpm dev
```

### 4. デプロイ

```bash
# 本番環境の環境変数を設定
wrangler secret put HUBSPOT_CLIENT_ID
wrangler secret put HUBSPOT_CLIENT_SECRET

# デプロイ
pnpm deploy
```

## エンドポイント

### GET /health
ヘルスチェック

### GET /oauth/callback
HubSpotからのOAuthコールバック
- クエリパラメータ: `code`, `state`
- レスポンス: HTMLページ（Deep Linkでアプリにリダイレクト）

### POST /oauth/refresh
アクセストークンのリフレッシュ
- リクエストボディ: `{ "refresh_token": "..." }`
- レスポンス: `{ "access_token": "...", "refresh_token": "...", "expires_in": 1800 }`

## セキュリティ

- Client SecretはCloudflare環境変数で管理
- HTTPS強制（Cloudflare自動）
- CORS設定済み
- State parameterでCSRF対策

## Deep Link

アプリのカスタムURLスキーム: `sfhsfiletrans://oauth/callback`
