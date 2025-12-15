# 自動更新セットアップ手順

## 完了した作業

1. ✅ 鍵ペア生成
2. ✅ `tauri.conf.json`に更新設定追加
3. ✅ フロントエンドに更新チェック実装
4. ✅ GitHub Actionsワークフロー更新

### 2. GitHub Secretsに追加

1. GitHubリポジトリページを開く
2. **Settings** → **Secrets and variables** → **Actions**
3. **New repository secret** をクリック
4. 以下を入力：
   - Name: `TAURI_SIGNING_PRIVATE_KEY`
   - Secret: 上記の秘密鍵を貼り付け
5. **Add secret** をクリック

### 3. エンドポイント設定

✅ 完了: `https://github.com/startlink-labs/file-trans-app/releases/latest/download/latest.json`

### 4. リリース方法

```bash
# バージョンタグを作成してプッシュ
git tag v1.0.0
git push origin v1.0.0
```

GitHub Actionsが自動的に：
- 全プラットフォーム向けビルド
- 署名付きバイナリ生成
- `latest.json`生成
- GitHub Releasesにアップロード

### 5. 動作確認

1. リリース後、アプリを起動
2. 新しいバージョンがあれば自動的に通知
3. ダウンロード・インストール・再起動が自動実行

## 注意事項

⚠️ **秘密鍵は絶対に公開しないでください**
- `~/.tauri/sf-hs-file-trans.key`は安全に保管
- Gitにコミットしない（`.gitignore`に追加済み）
- 紛失すると更新が配信できなくなります

## トラブルシューティング

### 更新が検出されない
- `tauri.conf.json`のエンドポイントURLが正しいか確認
- GitHub Releasesに`latest.json`が存在するか確認

### 署名エラー
- GitHub Secretsに正しい秘密鍵が設定されているか確認
- 秘密鍵が改行なしで1行になっているか確認
