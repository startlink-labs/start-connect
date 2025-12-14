# Chatter移行設計

## 概要
SalesforceのChatterデータ（FeedItemとFeedComment）をHubSpotのノートとして移行する。

## データ構造

### FeedItem.csv
- **ParentId**: 投稿が紐づくSalesforceレコードID（例: 001xxx, 003xxx）
- **Id**: FeedItemのID（例: 0D5xxx）
- **Body**: 投稿本文（HTML形式）
- **CreatedById**: 投稿者のユーザーID
- **CreatedDate**: 投稿日時
- **CommentCount**: コメント数

### FeedComment.csv
- **FeedItemId**: 親となるFeedItemのID
- **Id**: FeedCommentのID（例: 0D7xxx）
- **CommentBody**: コメント本文（HTML形式）
- **CreatedById**: コメント投稿者のユーザーID
- **CreatedDate**: コメント投稿日時

## 処理フロー

### 1. データ抽出・グループ化
```
FeedItem.csv読み込み
  ↓
ParentIdでグループ化（オブジェクトプレフィックス別）
  ↓
マッピング対象のParentIdのみフィルタリング
  ↓
FeedComment.csv読み込み
  ↓
FeedItemIdでコメントをグループ化
```

### 2. HubSpotレコード検索
```
ユニークなParentId（SalesforceレコードID）を抽出
  ↓
HubSpotで指定プロパティを使ってバッチ検索
  ↓
見つかったレコードのみ処理対象
```

### 3. ノート作成
各FeedItemに対して：
```
1. FeedItem本文を整形
2. 関連するFeedCommentを取得・整形
3. 1つのノートとして結合
4. HubSpotレコードにノート作成
```

## ノートフォーマット

### 基本構造
```html
<h3>📝 Chatter投稿</h3>
<p><strong>投稿日時:</strong> 2025-11-27 13:56:10</p>
<p><strong>投稿者ID:</strong> 0050K00000B9z3cQAB</p>

<div style="border-left: 3px solid #0091ae; padding-left: 12px; margin: 12px 0;">
  [投稿本文のHTML]
</div>

<h4>💬 コメント (2件)</h4>

<div style="margin-left: 20px; border-left: 2px solid #ccc; padding-left: 12px; margin-top: 8px;">
  <p><strong>2025-11-15 10:48:36</strong> - 投稿者ID: 0055i000006UchnAAC</p>
  <div>[コメント本文のHTML]</div>
</div>

<hr style="margin: 16px 0; border: none; border-top: 1px solid #e0e0e0;">
<p style="font-size: 11px; color: #666;">Salesforce FeedItem ID: 0D5dc000016RJ9ACAW</p>
```

### HTML整形ルール
1. `<p>@ユーザー名</p>` → メンション表記として保持
2. 改行は `<br>` または `<p>` タグで保持
3. 空の `<p> </p>` は削除
4. HTMLエスケープ（`&lt;`, `&gt;`）はデコード

## データ構造（Rust）

### ChatterFeedItem
```rust
struct ChatterFeedItem {
    id: String,              // FeedItem ID
    parent_id: String,       // SalesforceレコードID
    body: String,            // 投稿本文（HTML）
    created_by_id: String,   // 投稿者ID
    created_date: String,    // 投稿日時
}
```

### ChatterComment
```rust
struct ChatterComment {
    id: String,              // Comment ID
    feed_item_id: String,    // 親FeedItem ID
    comment_body: String,    // コメント本文（HTML）
    created_by_id: String,   // 投稿者ID
    created_date: String,    // 投稿日時
}
```

### ProcessableChatterRecord
```rust
struct ProcessableChatterRecord {
    salesforce_id: String,           // ParentId（SalesforceレコードID）
    feed_items: Vec<FeedItemWithComments>,
}

struct FeedItemWithComments {
    feed_item: ChatterFeedItem,
    comments: Vec<ChatterComment>,  // CreatedDateで昇順ソート済み
}
```

## 処理ステップ詳細

### Step 1: CSV読み込みとフィルタリング
```rust
1. FeedItem.csvを読み込み
2. マッピング対象のプレフィックスのParentIdのみ抽出
3. FeedComment.csvを読み込み
4. 対象FeedItemに紐づくコメントのみ抽出
5. コメントをCreatedDateで昇順ソート（古い順）
```

### Step 2: HubSpotレコード検索
```rust
1. ユニークなParentId（SalesforceレコードID）を収集
2. HubSpotでバッチ検索（最大100件ずつ）
3. 見つかったレコードのみ処理対象としてグループ化
```

### Step 3: ノート作成
```rust
for each ProcessableChatterRecord {
    // FeedItemをCreatedDateで昇順ソート（古い順）
    sort feed_items by created_date ASC
    
    for each FeedItemWithComments {
        1. ノートHTML生成
        2. HubSpot APIでノート作成
        3. 結果をCSVに記録
    }
}
```

**重要**: 各レコードに対して、FeedItemを投稿日時の古い順にソートしてからノートを作成する。
これにより、HubSpot上でChatterの投稿履歴が時系列で正しく表示される。

## 結果CSV

### カラム
- Salesforce Record ID
- HubSpot Object
- HubSpot Record ID
- HubSpot Record URL
- Feed Items Count
- Notes Created
- Status
- Reason

### ステータス
- `success`: ノート作成成功
- `skipped`: HubSpotにレコードが存在しない
- `error`: エラー発生

## エラーハンドリング

1. **HubSpotレコード未存在**: スキップしてCSVに記録
2. **ノート作成失敗**: エラーとしてCSVに記録、次のレコードへ
3. **HTML整形エラー**: 元のHTMLをそのまま使用
4. **日時パースエラー**: 元の文字列をそのまま使用

## 制限事項

1. **メンション**: Salesforceユーザー名はIDのまま（HubSpotユーザーへのマッピングなし）
2. **添付ファイル**: FeedItemの添付ファイルは未対応（別途ファイルマッピング機能を使用）
3. **いいね**: いいね情報は移行しない
4. **スレッド構造**: コメントは時系列で並べる（ネストなし）
