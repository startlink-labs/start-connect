# 開発ガイド

## 初回セットアップ

### 1. 環境変数の設定

#### Tauri（デスクトップアプリ）

```bash
cd src-tauri/.cargo
cp config.toml.example config.toml
```

`config.toml`を編集：

```toml
[env]
HUBSPOT_CLIENT_ID = "your_actual_client_id"
OAUTH_WORKER_URL = "https://hubspot-oauth-proxy.stlb-file-trans.workers.dev"
```

#### Cloudflare Workers

```bash
cd cloudflare-workers

# Client IDを設定
mise exec -- pnpm wrangler secret put HUBSPOT_CLIENT_ID

# Client Secretを設定
mise exec -- pnpm wrangler secret put HUBSPOT_CLIENT_SECRET
```

### 2. HubSpot公開アプリ設定

1. HubSpot Developer Accountで公開アプリを作成
2. **Redirect URI**: `https://hubspot-oauth-proxy.stlb-file-trans.workers.dev/oauth/callback`
3. **必要なScopes**: `oauth`, `crm.objects.*`, `crm.schemas.*`, `files`, `tickets`
4. Client IDとClient Secretを取得

## 開発

### 開発サーバー起動

```bash
mise exec -- pnpm dev
```

**注意**: 開発モードではDeep Linkが動作しないため、OAuth認証をテストできません。

### OAuth認証のテスト

OAuth認証をテストするには**デバッグビルド**を使用：

```bash
# デバッグビルド&実行
mise exec -- pnpm build:debug
```

これでRust側のログが表示され、Deep Linkも動作します。

## ビルド

### デバッグビルド（開発用）

```bash
mise exec -- pnpm build:debug
```

### 本番ビルド

```bash
mise exec -- pnpm build
```

ビルド成果物：
- **macOS**: `src-tauri/target/release/bundle/dmg/*.dmg`
- **Windows**: `src-tauri/target/release/bundle/msi/*.msi`
- **Linux**: `src-tauri/target/release/bundle/appimage/*.AppImage`

## テスト

### 型チェック

```bash
mise exec -- pnpm exec tsc --noEmit
```

### リント・フォーマット

```bash
# フロントエンド
mise exec -- pnpm lint
mise exec -- pnpm format

# Rust
mise exec -- pnpm lint:rust
mise exec -- pnpm format:rust

# 全て
mise exec -- pnpm format:all
```

### ユニットテスト

```bash
mise exec -- pnpm test
```

## トラブルシューティング

### 環境変数が読み込まれない

```bash
cd src-tauri
cargo clean
mise exec -- cargo build
```

### OAuth認証が失敗する

1. Cloudflare Workerが動作しているか確認：
```bash
curl https://hubspot-oauth-proxy.stlb-file-trans.workers.dev/health
```

2. デバッグビルドでログを確認：
```bash
mise exec -- pnpm build:debug
mise exec -- pnpm run:debug
```

3. HubSpotアプリのRedirect URIが正しいか確認

### Deep Linkが動作しない（macOS）

```bash
# Deep Link登録を確認
/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister -dump | grep sfhsfiletrans

# 再ビルド
rm -rf src-tauri/target/release/bundle
mise exec -- pnpm build:debug
```

## 配布

### 配布前チェックリスト

- [ ] HubSpot公開アプリが作成済み
- [ ] Cloudflare Workersがデプロイ済み
- [ ] 環境変数が正しく設定されている
- [ ] 本番ビルドが成功する
- [ ] OAuth認証が動作する
- [ ] 各OSでの動作確認

### セキュリティ

- **Client ID**: バイナリに埋め込まれる（公開情報）
- **Client Secret**: Cloudflare Workersの環境変数として保護
- **アクセストークン**: OSのキーチェーンに安全に保存

### エンドユーザーの使用フロー

1. アプリをインストール
2. 「HubSpotでログイン」をクリック
3. ブラウザでHubSpot認証
4. 自動的にアプリに戻る
5. トークンは自動的にリフレッシュされる
