// CSV処理関連の機能を提供するモジュール
use anyhow::{anyhow, Result};
use csv::ReaderBuilder;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::Path;

/// ContentDocumentLinkのCSVレコード
#[derive(Debug, Deserialize)]
pub struct ContentDocumentLinkRecord {
  /// リンクされたエンティティのID（SalesforceレコードID）
  #[serde(rename = "LinkedEntityId")]
  pub linked_entity_id: String,
  /// コンテンツドキュメントのID
  #[serde(rename = "ContentDocumentId")]
  pub content_document_id: String,
}

/// ContentVersionのCSVレコード
#[derive(Debug, Deserialize)]
pub struct ContentVersionRecord {
  /// バージョンID
  #[serde(rename = "Id")]
  pub id: String,
  /// コンテンツドキュメントID
  #[serde(rename = "ContentDocumentId")]
  pub content_document_id: String,
  /// クライアント上のパス
  #[serde(rename = "PathOnClient")]
  pub path_on_client: String,
  /// バージョンデータ（base64）
  #[serde(rename = "VersionData")]
  pub version_data: Option<String>,
}

/// ファイル情報
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
  /// バージョンID
  pub version_id: String,
  /// クライアント上のパス
  pub path_on_client: String,
  /// バージョンデータ（base64）
  pub version_data: Option<String>,
}

/// 処理可能なレコード情報
#[derive(Debug, Serialize, Deserialize)]
pub struct ProcessableRecord {
  /// SalesforceレコードID
  pub salesforce_id: String,
  /// 関連するコンテンツドキュメントIDのリスト
  pub content_document_ids: Vec<String>,
}

/// オブジェクトマッピング設定
#[derive(Debug, Serialize, Deserialize)]
pub struct ObjectMapping {
  /// HubSpotオブジェクトタイプ
  pub hubspot_object: String,
  /// Salesforceプロパティ名
  pub salesforce_property: String,
}

/// ChatterFeedItemのCSVレコード
#[derive(Debug, Deserialize, Clone)]
pub struct ChatterFeedItemRecord {
  #[serde(rename = "Id")]
  pub id: String,
  #[serde(rename = "ParentId")]
  pub parent_id: String,
  #[serde(rename = "Body")]
  pub body: String,
  #[serde(rename = "CreatedById")]
  pub created_by_id: String,
  #[serde(rename = "CreatedDate")]
  pub created_date: String,
}

/// ChatterFeedCommentのCSVレコード
#[derive(Debug, Deserialize, Clone)]
pub struct ChatterCommentRecord {
  #[serde(rename = "Id")]
  #[allow(dead_code)]
  pub id: String,
  #[serde(rename = "FeedItemId")]
  pub feed_item_id: String,
  #[serde(rename = "CommentBody")]
  pub comment_body: String,
  #[serde(rename = "CreatedById")]
  pub created_by_id: String,
  #[serde(rename = "CreatedDate")]
  pub created_date: String,
}

/// FeedItemとコメントをまとめた構造
#[derive(Debug, Clone)]
pub struct FeedItemWithComments {
  pub feed_item: ChatterFeedItemRecord,
  pub comments: Vec<ChatterCommentRecord>,
}

/// 処理可能なChatterレコード
#[derive(Debug)]
pub struct ProcessableChatterRecord {
  pub salesforce_id: String,
  pub feed_items: Vec<FeedItemWithComments>,
}

/// CSV処理を行う構造体
pub struct CsvProcessor;

impl CsvProcessor {
  /// ContentDocumentLink.csvからマッピング対象レコードを抽出
  ///
  /// # 引数
  /// * `csv_path` - CSVファイルのパス
  /// * `object_mappings` - オブジェクトマッピング設定
  ///
  /// # 戻り値
  /// プレフィックス別にグループ化されたレコード情報
  pub fn extract_target_records(
    csv_path: &str,
    object_mappings: &HashMap<String, ObjectMapping>,
  ) -> Result<HashMap<String, Vec<(String, String)>>> {
    let mut records_by_type = HashMap::new();
    let mut row_count = 0;

    // CSVファイルを開いて読み込み
    let mut reader = ReaderBuilder::new().has_headers(true).from_path(csv_path)?;

    // 各行を処理
    for result in reader.deserialize() {
      row_count += 1;
      let record: ContentDocumentLinkRecord = result?;

      // LinkedEntityIdが3文字以上の場合のみ処理
      if record.linked_entity_id.len() >= 3 && !record.content_document_id.is_empty() {
        let prefix = &record.linked_entity_id[..3];

        // オブジェクトマッピングに存在するプレフィックスのみ処理
        if object_mappings.contains_key(prefix) {
          records_by_type
            .entry(prefix.to_string())
            .or_insert_with(Vec::new)
            .push((record.linked_entity_id, record.content_document_id));
        }
      }
    }

    log::info!("ContentDocumentLink.csv処理完了: {}行", row_count);
    Ok(records_by_type)
  }

  /// ContentVersion.csvからファイル情報を取得し、対象レコードをフィルタリング
  ///
  /// # 引数
  /// * `csv_path` - ContentVersion.csvのパス
  /// * `target_records` - 対象レコード情報
  ///
  /// # 戻り値
  /// (ファイル情報マップ, フィルタリング後のレコード情報)
  #[allow(clippy::type_complexity)]
  pub fn get_file_info_and_filter_records(
    csv_path: &str,
    target_records: &HashMap<String, Vec<(String, String)>>,
  ) -> Result<(
    HashMap<String, FileInfo>,
    HashMap<String, Vec<(String, String)>>,
  )> {
    // 対象のContentDocumentIdを収集
    let mut target_content_ids = HashSet::new();
    for records in target_records.values() {
      for (_, content_document_id) in records {
        target_content_ids.insert(content_document_id.clone());
      }
    }

    log::info!("対象ContentDocumentId: {}件", target_content_ids.len());

    // CSVファイルを読み込み
    let mut reader = ReaderBuilder::new().has_headers(true).from_path(csv_path)?;

    let mut file_info = HashMap::new();
    let mut found_content_ids = HashSet::new();
    let mut row_count = 0;

    // 各行を処理してファイル情報を取得
    for result in reader.deserialize() {
      row_count += 1;
      let record: ContentVersionRecord = result?;

      // 対象のContentDocumentIdの場合のみ処理
      if target_content_ids.contains(&record.content_document_id) {
        file_info.insert(
          record.content_document_id.clone(),
          FileInfo {
            version_id: record.id,
            path_on_client: record.path_on_client,
            version_data: record.version_data,
          },
        );
        found_content_ids.insert(record.content_document_id);
      }
    }

    log::info!("ContentVersion.csv読み込み完了: {}行", row_count);
    log::info!("フィルタリング結果: {}件", file_info.len());

    // ファイル情報があるレコードのみを絞り込み
    let mut filtered_target_records = HashMap::new();
    for (prefix, records) in target_records {
      let filtered_records: Vec<(String, String)> = records
        .iter()
        .filter(|(_, content_document_id)| found_content_ids.contains(content_document_id))
        .cloned()
        .collect();

      if !filtered_records.is_empty() {
        filtered_target_records.insert(prefix.clone(), filtered_records);
      }
    }

    Ok((file_info, filtered_target_records))
  }

  /// レコードをSalesforce ID別にグループ化
  ///
  /// # 引数
  /// * `records` - レコードリスト
  /// * `found_hubspot_records` - HubSpotで見つかったレコードのマップ
  ///
  /// # 戻り値
  /// 処理可能なレコードのリスト
  pub fn group_records_by_salesforce_id(
    records: &[(String, String)],
    found_hubspot_records: &HashMap<String, String>,
  ) -> Vec<ProcessableRecord> {
    let mut grouped_records: HashMap<String, Vec<String>> = HashMap::new();

    // HubSpotに存在するレコードのみをグループ化
    for (salesforce_id, content_document_id) in records {
      if found_hubspot_records.contains_key(salesforce_id) {
        grouped_records
          .entry(salesforce_id.clone())
          .or_default()
          .push(content_document_id.clone());
      }
    }

    // ProcessableRecord構造体に変換
    grouped_records
      .into_iter()
      .map(|(salesforce_id, content_document_ids)| ProcessableRecord {
        salesforce_id,
        content_document_ids,
      })
      .collect()
  }

  /// CSVファイルが存在するかチェック
  pub fn validate_csv_files(
    content_version_path: &str,
    content_document_link_path: &str,
  ) -> Result<()> {
    if !Path::new(content_version_path).exists() {
      return Err(anyhow!(
        "ContentVersion.csvが見つかりません: {}",
        content_version_path
      ));
    }

    if !Path::new(content_document_link_path).exists() {
      return Err(anyhow!(
        "ContentDocumentLink.csvが見つかりません: {}",
        content_document_link_path
      ));
    }

    Ok(())
  }

  /// オブジェクトグループを分析
  pub fn analyze_object_groups(content_document_link_path: &str) -> Result<HashMap<String, usize>> {
    let mut reader = ReaderBuilder::new()
      .has_headers(true)
      .from_path(content_document_link_path)?;

    let mut object_groups: HashMap<String, usize> = HashMap::new();
    let mut total_records = 0;

    // ヘッダーを取得してLinkedEntityIdのインデックスを特定
    let headers = reader.headers()?.clone();
    let linked_entity_id_index = headers
      .iter()
      .position(|h| h == "LinkedEntityId")
      .ok_or_else(|| anyhow!("LinkedEntityIdカラムが見つかりません"))?;

    for result in reader.records() {
      let record = result?;
      total_records += 1;

      if let Some(linked_entity_id) = record.get(linked_entity_id_index) {
        // 空文字や空白をチェック
        let linked_entity_id = linked_entity_id.trim();
        if !linked_entity_id.is_empty() && linked_entity_id.len() >= 3 {
          let prefix = &linked_entity_id[0..3];
          *object_groups.entry(prefix.to_string()).or_insert(0) += 1;
        }
      }
    }

    log::info!(
      "ContentDocumentLink.csv分析完了: {}行、{}種類のオブジェクトを検出",
      total_records,
      object_groups.len()
    );

    Ok(object_groups)
  }

  /// Chatter FeedItem.csvを分析してParentIdでオブジェクトグループを取得
  pub fn analyze_chatter_object_groups(feed_item_path: &str) -> Result<HashMap<String, usize>> {
    let mut reader = ReaderBuilder::new()
      .has_headers(true)
      .from_path(feed_item_path)?;

    let mut object_groups: HashMap<String, usize> = HashMap::new();
    let mut total_records = 0;

    // ヘッダーを取得してParentIdのインデックスを特定
    let headers = reader.headers()?.clone();
    let parent_id_index = headers
      .iter()
      .position(|h| h == "ParentId")
      .ok_or_else(|| anyhow!("ParentIdカラムが見つかりません"))?;

    for result in reader.records() {
      let record = result?;
      total_records += 1;

      if let Some(parent_id) = record.get(parent_id_index) {
        let parent_id = parent_id.trim();
        if !parent_id.is_empty() && parent_id.len() >= 3 {
          let prefix = &parent_id[0..3];
          *object_groups.entry(prefix.to_string()).or_insert(0) += 1;
        }
      }
    }

    log::info!(
      "FeedItem.csv分析完了: {}行、{}種類のオブジェクトを検出",
      total_records,
      object_groups.len()
    );

    Ok(object_groups)
  }

  /// Chatter FeedItemとFeedCommentを読み込んでマッピング対象レコードを抽出
  pub fn extract_chatter_records(
    feed_item_path: &str,
    _feed_comment_path: &str,
    object_mappings: &HashMap<String, ObjectMapping>,
  ) -> Result<HashMap<String, Vec<ChatterFeedItemRecord>>> {
    let mut feed_items_by_prefix: HashMap<String, Vec<ChatterFeedItemRecord>> = HashMap::new();

    // FeedItem.csvを読み込み
    let mut reader = ReaderBuilder::new()
      .has_headers(true)
      .from_path(feed_item_path)?;

    for result in reader.deserialize() {
      let record: ChatterFeedItemRecord = result?;

      if record.parent_id.len() >= 3 {
        let prefix = &record.parent_id[..3];

        if object_mappings.contains_key(prefix) {
          feed_items_by_prefix
            .entry(prefix.to_string())
            .or_default()
            .push(record);
        }
      }
    }

    log::info!(
      "FeedItem読み込み完了: {}種類のオブジェクト",
      feed_items_by_prefix.len()
    );
    Ok(feed_items_by_prefix)
  }

  /// FeedCommentを読み込んでFeedItemIdでグループ化
  pub fn load_feed_comments(
    feed_comment_path: &str,
    target_feed_item_ids: &HashSet<String>,
  ) -> Result<HashMap<String, Vec<ChatterCommentRecord>>> {
    let mut comments_by_feed_item: HashMap<String, Vec<ChatterCommentRecord>> = HashMap::new();

    let mut reader = ReaderBuilder::new()
      .has_headers(true)
      .from_path(feed_comment_path)?;

    for result in reader.deserialize() {
      let record: ChatterCommentRecord = result?;

      if target_feed_item_ids.contains(&record.feed_item_id) {
        comments_by_feed_item
          .entry(record.feed_item_id.clone())
          .or_default()
          .push(record);
      }
    }

    log::info!(
      "FeedComment読み込み完了: {}件のFeedItemにコメント",
      comments_by_feed_item.len()
    );
    Ok(comments_by_feed_item)
  }

  /// FeedItemとCommentを結合してProcessableChatterRecordを生成
  pub fn group_chatter_records(
    feed_items_by_prefix: HashMap<String, Vec<ChatterFeedItemRecord>>,
    comments_by_feed_item: HashMap<String, Vec<ChatterCommentRecord>>,
    found_hubspot_records: &HashMap<String, String>,
  ) -> Vec<ProcessableChatterRecord> {
    let mut processable_records = Vec::new();

    // ParentIdごとにグループ化
    let mut records_by_parent: HashMap<String, Vec<FeedItemWithComments>> = HashMap::new();

    for feed_items in feed_items_by_prefix.values() {
      for feed_item in feed_items {
        // HubSpotに存在するレコードのみ処理
        if found_hubspot_records.contains_key(&feed_item.parent_id) {
          let mut comments = comments_by_feed_item
            .get(&feed_item.id)
            .cloned()
            .unwrap_or_default();

          // コメントを日付でソート（古い順）
          comments.sort_by(|a, b| a.created_date.cmp(&b.created_date));

          records_by_parent
            .entry(feed_item.parent_id.clone())
            .or_default()
            .push(FeedItemWithComments {
              feed_item: feed_item.clone(),
              comments,
            });
        }
      }
    }

    // ProcessableChatterRecordに変換
    for (salesforce_id, mut feed_items) in records_by_parent {
      // FeedItemを日付でソート（古い順）
      feed_items.sort_by(|a, b| a.feed_item.created_date.cmp(&b.feed_item.created_date));

      processable_records.push(ProcessableChatterRecord {
        salesforce_id,
        feed_items,
      });
    }

    log::info!("処理可能レコード: {}件", processable_records.len());
    processable_records
  }
}
