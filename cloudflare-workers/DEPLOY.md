# Cloudflare Workers デプロイ手順

## 前提条件
- Cloudflareアカウント
- HubSpot公開アプリのClient IDとClient Secret

## 1. Cloudflareにログイン

```bash
cd cloudflare-workers
mise exec -- pnpm wrangler login
```

ブラウザが開くので、Cloudflareアカウントでログインして認証します。

## 2. 環境変数を設定

```bash
# HubSpot Client IDを設定
mise exec -- pnpm wrangler secret put HUBSPOT_CLIENT_ID

# HubSpot Client Secretを設定
mise exec -- pnpm wrangler secret put HUBSPOT_CLIENT_SECRET
```

プロンプトが表示されたら、それぞれの値を入力してEnterを押します。

## 3. デプロイ

```bash
mise exec -- pnpm deploy
```

デプロイが完了すると、URLが表示されます：
```
https://hubspot-oauth-proxy.YOUR_SUBDOMAIN.workers.dev
```

## 4. デプロイ後の設定

### HubSpotアプリ設定を更新

`hsapp/src/app/app-hsmeta.json`の`redirectUrls`を更新：

```json
{
  "redirectUrls": ["https://hubspot-oauth-proxy.YOUR_SUBDOMAIN.workers.dev/oauth/callback"]
}
```

### Tauriアプリの環境変数を設定

デプロイしたWorkerのURLを環境変数に設定：

```bash
export OAUTH_WORKER_URL="https://hubspot-oauth-proxy.YOUR_SUBDOMAIN.workers.dev"
export HUBSPOT_CLIENT_ID="your_client_id"
```

## 5. 動作確認

```bash
# ヘルスチェック
curl https://hubspot-oauth-proxy.YOUR_SUBDOMAIN.workers.dev/health
```

レスポンス：
```json
{"status":"ok"}
```

## ローカル開発

```bash
# .dev.varsファイルを作成
cp .dev.vars.example .dev.vars

# .dev.varsを編集して環境変数を設定
# HUBSPOT_CLIENT_ID=your_client_id
# HUBSPOT_CLIENT_SECRET=your_client_secret

# ローカルサーバー起動
mise exec -- pnpm dev
```

ローカルURL: `http://localhost:8787`

## トラブルシューティング

### デプロイエラー
```bash
# Wranglerのバージョン確認
mise exec -- pnpm wrangler --version

# ログを確認
mise exec -- pnpm wrangler tail
```

### 環境変数の確認
```bash
# 設定済みの環境変数を確認（値は表示されない）
mise exec -- pnpm wrangler secret list
```

### 環境変数の削除
```bash
mise exec -- pnpm wrangler secret delete HUBSPOT_CLIENT_ID
```
