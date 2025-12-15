# StartConnect

SalesforceからHubSpotへファイルを簡単に移行できるデスクトップアプリケーション

## 概要

StartConnectは、SalesforceのファイルをHubSpotへ効率的に移行するためのツールです。CSVファイルを読み込むだけで、自動的にファイルをアップロードし、適切なレコードに関連付けます。

## 主な機能

✅ **簡単なファイル移行**  
SalesforceのContentVersionとContentDocumentLinkのCSVを読み込むだけで自動処理

✅ **安全な認証**  
HubSpot OAuth 2.0による安全な接続（トークンは自動更新）

✅ **クロスプラットフォーム対応**  
macOS、Windows、Linuxで動作

✅ **自動アップデート**  
新しいバージョンが利用可能になると自動で通知

## インストール

### ダウンロード

[Releases](https://github.com/startlink-labs/start-connect/releases/latest)から、お使いのOSに対応したインストーラーをダウンロードしてください。

- **macOS**: `.dmg` ファイル（Apple Silicon / Intel両対応）
- **Windows**: `.msi` または `.exe` ファイル
- **Linux**: `.AppImage` または `.deb` ファイル

### インストール手順

#### macOS
1. `.dmg`ファイルをダウンロード
2. ファイルを開き、StartConnectをアプリケーションフォルダにドラッグ
3. 初回起動時に「開発元を確認できません」と表示された場合：
   - **方法1**: アプリを右クリック→「開く」を選択
   - **方法2**: システム設定→プライバシーとセキュリティ→「このまま開く」をクリック

#### Windows
1. `.msi`または`.exe`ファイルをダウンロード
2. インストーラーを実行し、画面の指示に従う
3. 「WindowsによってPCが保護されました」と表示された場合：
   - 「詳細情報」→「実行」をクリック

#### Linux
1. `.AppImage`ファイルをダウンロード
2. 実行権限を付与: `chmod +x StartConnect_*.AppImage`
3. ファイルをダブルクリックして起動

**注意**: 一部のディストリビューションでは、FUSE（Filesystem in Userspace）のインストールが必要な場合があります：
```bash
# Ubuntu/Debian
sudo apt install fuse libfuse2

# Fedora
sudo dnf install fuse fuse-libs
```

## 使い方

### 1. HubSpotに接続

1. アプリを起動
2. 「HubSpotに接続」ボタンをクリック
3. ブラウザでHubSpotにログイン
4. アクセスを許可

### 2. CSVファイルを準備

Salesforceから以下の2つのCSVファイルをエクスポート：

- **ContentVersion.csv**: ファイル本体の情報
- **ContentDocumentLink.csv**: ファイルとレコードの関連付け情報

### 3. ファイルを移行

1. 「ファイルを選択」から2つのCSVファイルを読み込み
2. 「移行を開始」ボタンをクリック
3. 進捗状況を確認しながら完了を待つ

## サポート

問題が発生した場合は、[Issues](https://github.com/startlink-labs/start-connect/issues)からお問い合わせください。

## 開発者向け情報

開発に参加したい方は、[DEVELOPMENT.md](./DEVELOPMENT.md)を参照してください。

## ライセンス

Private - StartLink Inc.
