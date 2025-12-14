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
  /// ファイルタイトル
  #[serde(rename = "Title")]
  pub title: String,
  /// ファイル拡張子
  #[serde(rename = "FileExtension")]
  pub file_extension: String,
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
  /// ファイルタイトル
  pub title: String,
  /// ファイル拡張子
  pub file_extension: String,
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
            title: record.title,
            file_extension: record.file_extension,
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
}
