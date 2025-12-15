// Tauriコマンド定義モジュール
// フロントエンドから呼び出し可能なRust関数を定義

use crate::auth::SecureStorage;
use crate::csv::{CsvProcessor, ObjectMapping};
use crate::hubspot::{build_record_url, HubSpotService};
use anyhow::Result;
use serde::Serialize;
use std::collections::HashMap;

use tauri::{command, Emitter};

/// ファイルマッピング処理のレスポンスデータ
#[derive(Debug, Serialize)]
pub struct FileMappingResponse {
  /// 結果CSVファイルパス（一時ファイル）
  pub result_csv_path: String,
  /// オブジェクトごとのサマリー
  pub summaries: Vec<ObjectSummary>,
}

/// オブジェクトごとの処理サマリー
#[derive(Debug, Serialize)]
pub struct ObjectSummary {
  /// Salesforceオブジェクトプレフィックス
  pub prefix: String,
  /// HubSpotオブジェクト名
  pub hubspot_object: String,
  /// 処理成功数
  pub success_count: usize,
  /// スキップ数
  pub skipped_count: usize,
  /// エラー数
  pub error_count: usize,
  /// アップロードされたファイル数
  pub uploaded_files: usize,
}

/// オブジェクト分析結果
#[derive(Debug, Serialize)]
pub struct AnalyzeResponse {
  pub object_groups: HashMap<String, usize>,
}

/// HubSpotオブジェクト情報
#[derive(Debug, Serialize)]
pub struct HubSpotObject {
  pub object_type_id: String,
  pub name: String,
  pub label: String,
}

/// 進捗情報
#[derive(Debug, Serialize, Clone)]
pub struct ProgressInfo {
  /// 現在のステップ
  pub step: String,
  /// 進捗率（0-100）
  pub progress: u8,
  /// 詳細メッセージ
  pub message: String,
}

/// ファイルマッピング処理のメインコマンド
/// Salesforce CSVファイルを処理してHubSpotにファイルをアップロード・ノート作成
#[command]
pub async fn process_file_mapping(
  content_version_path: String,
  content_document_link_path: String,
  content_version_folder_path: String,
  object_mappings: HashMap<String, ObjectMapping>,
  window: tauri::Window,
) -> Result<FileMappingResponse, String> {
  log::info!("ファイルマッピング処理開始");

  // 進捗通知用のヘルパー関数
  let emit_progress = |step: &str, progress: u8, message: &str| {
    let progress_info = ProgressInfo {
      step: step.to_string(),
      progress,
      message: message.to_string(),
    };
    let _ = window.emit("file-mapping-progress", &progress_info);
  };

  emit_progress("validation", 5, "入力データを検証中...");

  // 1. CSVファイルの存在確認
  if let Err(e) =
    CsvProcessor::validate_csv_files(&content_version_path, &content_document_link_path)
  {
    return Err(e.to_string());
  }

  emit_progress("hubspot_init", 10, "HubSpot接続を初期化中...");

  // 2. 保存されたトークンを取得してHubSpotサービス初期化（期限切れの場合は自動リフレッシュ）
  let credentials = SecureStorage::get_credentials_with_refresh()
    .await
    .map_err(|_| "認証情報が見つかりません。再ログインしてください。")?;

  let portal_id = credentials.portal_id.unwrap_or(0).to_string();
  let ui_domain = credentials
    .ui_domain
    .unwrap_or_else(|| "app.hubspot.com".to_string());
  let hubspot_service = HubSpotService::new(credentials.token);

  emit_progress("extract_records", 20, "対象レコードを抽出中...");

  // 3. マッピング対象レコードを抽出
  let target_records =
    match CsvProcessor::extract_target_records(&content_document_link_path, &object_mappings) {
      Ok(records) => records,
      Err(e) => return Err(format!("レコード抽出エラー: {}", e)),
    };

  let total_records: usize = target_records.values().map(|v| v.len()).sum();
  log::info!("マッピング対象レコード: {}件", total_records);

  emit_progress("file_info", 35, "ファイル情報を取得中...");

  // 4. ファイル情報を取得してレコードをフィルタリング
  let content_folder = if content_version_folder_path.is_empty() {
    None
  } else {
    Some(content_version_folder_path.as_str())
  };

  let (file_info, filtered_target_records) = match CsvProcessor::get_file_info_and_filter_records(
    &content_version_path,
    &target_records,
    content_folder,
  ) {
    Ok(result) => result,
    Err(e) => return Err(format!("ファイル情報取得エラー: {}", e)),
  };

  log::info!("ファイル情報: {}件", file_info.len());

  emit_progress("hubspot_search", 50, "HubSpotレコードを検索中...");

  // 5. 結果CSVファイルを一時ディレクトリに作成
  let temp_dir = std::env::temp_dir();
  let result_csv_path = temp_dir.join(format!(
    "hubspot_upload_result_{}.csv",
    chrono::Utc::now().timestamp()
  ));
  let mut csv_writer = csv::Writer::from_path(&result_csv_path)
    .map_err(|e| format!("CSVファイル作成エラー: {}", e))?;

  // CSVヘッダー書き込み
  csv_writer
    .write_record([
      "Salesforce ID",
      "HubSpot Object",
      "HubSpot Record ID",
      "HubSpot Record URL",
      "Files Count",
      "Files Uploaded",
      "Note Created",
      "Status",
      "Reason",
    ])
    .map_err(|e| format!("CSVヘッダー書き込みエラー: {}", e))?;

  // 6. HubSpotでレコード存在確認とグループ化
  let mut all_processable_records = HashMap::new();
  let mut hubspot_record_cache = HashMap::new();
  let mut summaries: HashMap<String, ObjectSummary> = HashMap::new();

  for (prefix, records) in &filtered_target_records {
    if let Some(mapping) = object_mappings.get(prefix) {
      // ユニークなSalesforce IDを収集
      let unique_salesforce_ids: Vec<String> = records
        .iter()
        .map(|(sf_id, _)| sf_id.clone())
        .collect::<std::collections::HashSet<_>>()
        .into_iter()
        .collect();

      log::info!(
        "{}: {}件のファイルリンク中、{}件のユニークSalesforceレコードIDを検索",
        prefix,
        records.len(),
        unique_salesforce_ids.len()
      );

      // HubSpotでバッチ検索
      match hubspot_service
        .batch_find_records(
          &mapping.hubspot_object,
          &mapping.salesforce_property,
          &unique_salesforce_ids,
        )
        .await
      {
        Ok(found_records) => {
          log::info!(
            "{}: {}件中{}件がHubSpotに存在",
            prefix,
            unique_salesforce_ids.len(),
            found_records.len()
          );

          // 見つからなかったSalesforce IDをCSVに書き込み
          if found_records.len() < unique_salesforce_ids.len() {
            let missing_ids: Vec<&String> = unique_salesforce_ids
              .iter()
              .filter(|id| !found_records.contains_key(*id))
              .collect();
            log::warn!(
              "{}: HubSpotに見つからなかったSalesforce ID: {:?}",
              prefix,
              missing_ids
            );

            let missing_count = missing_ids.len();

            // 見つからなかったレコードをCSVに書き込み
            for missing_id in missing_ids {
              let _ = csv_writer.write_record([
                missing_id,
                &mapping.hubspot_object,
                "",
                "",
                "0",
                "0",
                "false",
                "skipped",
                "HubSpotにレコードが存在しません",
              ]);
            }

            // サマリー更新
            summaries
              .entry(prefix.clone())
              .or_insert_with(|| ObjectSummary {
                prefix: prefix.clone(),
                hubspot_object: mapping.hubspot_object.clone(),
                success_count: 0,
                skipped_count: 0,
                error_count: 0,
                uploaded_files: 0,
              })
              .skipped_count += missing_count;
          }

          // キャッシュに追加
          hubspot_record_cache.extend(found_records.clone());

          // レコードをグループ化
          let processable_records =
            CsvProcessor::group_records_by_salesforce_id(records, &found_records);

          if !processable_records.is_empty() {
            all_processable_records.insert(prefix.clone(), processable_records);
          }
        }
        Err(e) => {
          log::error!("HubSpot検索エラー {}: {}", prefix, e);
          log::warn!(
            "{}: 検索対象だったSalesforce ID: {:?}",
            prefix,
            unique_salesforce_ids
          );
          continue;
        }
      }
    }
  }

  let total_processable: usize = all_processable_records.values().map(|v| v.len()).sum();
  log::info!("処理可能レコード: {}件", total_processable);

  emit_progress("file_processing", 70, "ファイル処理とアップロード中...");

  // 7. ファイル処理とノート作成

  for (prefix, records) in &all_processable_records {
    if let Some(mapping) = object_mappings.get(prefix) {
      log::info!("{}: {}件の処理可能レコードを処理", prefix, records.len());

      // オブジェクトサマリーを初期化（まだ存在しない場合のみ）
      summaries
        .entry(prefix.clone())
        .or_insert_with(|| ObjectSummary {
          prefix: prefix.clone(),
          hubspot_object: mapping.hubspot_object.clone(),
          success_count: 0,
          skipped_count: 0,
          error_count: 0,
          uploaded_files: 0,
        });

      for (i, record) in records.iter().enumerate() {
        // 進捗更新
        let progress = 70 + (20 * (i + 1) / records.len()) as u8;
        emit_progress(
          "file_processing",
          progress,
          &format!(
            "処理中 ({}/{}): {}",
            i + 1,
            records.len(),
            record.salesforce_id
          ),
        );

        let hubspot_record_id = hubspot_record_cache
          .get(&record.salesforce_id)
          .cloned()
          .unwrap_or_default();
        let files_count = record.content_document_ids.len();

        // HubSpotレコードURLを構築
        let record_url = if !hubspot_record_id.is_empty() {
          build_record_url(
            &ui_domain,
            &portal_id,
            &mapping.hubspot_object,
            &hubspot_record_id,
          )
        } else {
          String::new()
        };

        match process_single_record(
          &hubspot_service,
          record,
          &file_info,
          &content_version_folder_path,
          &mapping.hubspot_object,
          &hubspot_record_cache,
        )
        .await
        {
          Ok((files_uploaded, note_created)) => {
            // サマリー更新
            if let Some(summary) = summaries.get_mut(prefix) {
              summary.success_count += 1;
              summary.uploaded_files += files_uploaded;
            }

            // CSVに結果書き込み
            let _ = csv_writer.write_record([
              &record.salesforce_id,
              &mapping.hubspot_object,
              &hubspot_record_id,
              &record_url,
              &files_count.to_string(),
              &files_uploaded.to_string(),
              &note_created.to_string(),
              "success",
              "",
            ]);

            log::info!(
              "処理完了: {} - {}件のファイル",
              record.salesforce_id,
              files_count
            );
          }
          Err(e) => {
            // サマリー更新
            if let Some(summary) = summaries.get_mut(prefix) {
              summary.error_count += 1;
            }

            // CSVにエラー書き込み
            let _ = csv_writer.write_record([
              &record.salesforce_id,
              &mapping.hubspot_object,
              &hubspot_record_id,
              &record_url,
              &files_count.to_string(),
              "0",
              "false",
              "error",
              &e.to_string(),
            ]);

            log::error!("レコード処理エラー {}: {}", record.salesforce_id, e);
          }
        }
      }
    }
  }

  // CSVファイルをフラッシュ
  csv_writer
    .flush()
    .map_err(|e| format!("CSVフラッシュエラー: {}", e))?;

  emit_progress("complete", 100, "処理完了");

  let response = FileMappingResponse {
    result_csv_path: result_csv_path.to_string_lossy().to_string(),
    summaries: summaries.into_values().collect(),
  };

  log::info!("ファイルマッピング処理完了: {:?}", response);
  Ok(response)
}

/// 単一レコードの処理
/// ファイルアップロードとノート作成を行う
async fn process_single_record(
  hubspot_service: &HubSpotService,
  record: &crate::csv::processor::ProcessableRecord,
  file_info: &HashMap<String, crate::csv::processor::FileInfo>,
  _content_folder_path: &str,
  hubspot_object: &str,
  hubspot_record_cache: &HashMap<String, String>,
) -> Result<(usize, bool)> {
  let mut uploaded_files = 0;
  let mut file_ids = Vec::new();

  // 各ファイルを処理
  for content_doc_id in &record.content_document_ids {
    if let Some(file_data) = file_info.get(content_doc_id) {
      // ファイル名の拡張子を小文字に統一（HubSpot側の仕様に合わせる）
      let filename = file_data.path_on_client.clone();
      let safe_filename = if let Some(dot_pos) = filename.rfind('.') {
        let (name, ext) = filename.split_at(dot_pos);
        format!("{}_{}{}", file_data.version_id, name, ext.to_lowercase())
      } else {
        format!("{}_{}", file_data.version_id, filename)
      };

      // HubSpotでファイル存在確認
      match hubspot_service
        .get_file_by_path(&format!("salesforce/{}", safe_filename))
        .await?
      {
        Some(existing_file) => {
          // ファイルが既に存在する場合
          log::debug!("ファイルが既に存在: {}", safe_filename);
          file_ids.push(existing_file.id);
        }
        None => {
          // ファイルが存在しない場合はbase64データからアップロード
          if let Some(version_data) = &file_data.version_data {
            match hubspot_service
              .upload_file_from_base64(version_data, &safe_filename)
              .await
            {
              Ok(file_id) => {
                uploaded_files += 1;
                file_ids.push(file_id);
                log::debug!("アップロード成功: {}", safe_filename);
              }
              Err(e) => {
                log::warn!("アップロード失敗 {}: {}", safe_filename, e);
              }
            }
          } else {
            log::warn!("バージョンデータがありません: {}", safe_filename);
          }
        }
      }
    }
  }

  // ノート作成
  let note_created = if !file_ids.is_empty() {
    let hubspot_record_id = hubspot_record_cache
      .get(&record.salesforce_id)
      .ok_or_else(|| anyhow::anyhow!("HubSpotレコードIDが見つかりません"))?;

    match hubspot_service
      .create_note_for_record(
        hubspot_record_id,
        hubspot_object,
        "添付ファイル",
        Some(file_ids),
      )
      .await
    {
      Ok(_) => true,
      Err(e) => {
        log::error!("ノート作成失敗 {}: {}", record.salesforce_id, e);
        false
      }
    }
  } else {
    log::warn!("処理可能ファイルなし: {}", record.salesforce_id);
    false
  };

  Ok((uploaded_files, note_created))
}

/// CSVファイルを分析してオブジェクトグループを取得
#[command]
pub async fn analyze_csv_files(
  content_version_path: String,
  content_document_link_path: String,
) -> Result<AnalyzeResponse, String> {
  log::info!("ファイル分析開始");

  // CSVファイルの存在確認
  if let Err(e) =
    CsvProcessor::validate_csv_files(&content_version_path, &content_document_link_path)
  {
    return Err(e.to_string());
  }

  // オブジェクトグループを分析
  match CsvProcessor::analyze_object_groups(&content_document_link_path) {
    Ok(object_groups) => {
      log::info!("分析完了: {}種類のオブジェクト", object_groups.len());
      Ok(AnalyzeResponse { object_groups })
    }
    Err(e) => Err(format!("{}", e)),
  }
}

/// HubSpotオブジェクト一覧を取得
#[command]
pub async fn get_hubspot_objects() -> Result<Vec<HubSpotObject>, String> {
  log::info!("HubSpotオブジェクト一覧取得開始");

  // 保存されたトークンを取得（期限切れの場合は自動リフレッシュ）
  let credentials = SecureStorage::get_credentials_with_refresh()
    .await
    .map_err(|_| "認証情報が見つかりません。再ログインしてください。")?;

  let service = HubSpotService::new(credentials.token);

  match service.get_all_objects().await {
    Ok(objects) => {
      log::info!("オブジェクト一覧取得完了: {}件", objects.len());
      Ok(objects)
    }
    Err(e) => Err(format!("オブジェクト取得エラー: {}", e)),
  }
}

/// 結果CSVを指定パスに保存
#[command]
pub async fn save_result_csv(temp_path: String, save_path: String) -> Result<(), String> {
  std::fs::copy(&temp_path, &save_path).map_err(|e| format!("ファイル保存エラー: {}", e))?;

  // 一時ファイルを削除
  std::fs::remove_file(&temp_path)
    .map_err(|e| log::warn!("一時ファイル削除失敗: {}", e))
    .ok();

  log::info!("結果CSVを保存: {}", save_path);
  Ok(())
}

/// 一時ファイルを削除（保存せずに終了する場合）
#[command]
pub async fn cleanup_temp_csv(temp_path: String) -> Result<(), String> {
  std::fs::remove_file(&temp_path).map_err(|e| format!("一時ファイル削除エラー: {}", e))?;
  log::info!("一時ファイルを削除: {}", temp_path);
  Ok(())
}

/// Chatter CSVファイルを分析してオブジェクトグループを取得
#[command]
pub async fn analyze_chatter_files(
  feed_item_path: String,
  feed_comment_path: String,
) -> Result<AnalyzeResponse, String> {
  log::info!("Chatterファイル分析開始");

  // CSVファイルの存在確認
  if !std::path::Path::new(&feed_item_path).exists() {
    return Err("FeedItem.csvが見つかりません".to_string());
  }
  if !std::path::Path::new(&feed_comment_path).exists() {
    return Err("FeedComment.csvが見つかりません".to_string());
  }

  // FeedItemのParentIdでオブジェクトをグルーピング
  match CsvProcessor::analyze_chatter_object_groups(&feed_item_path) {
    Ok(object_groups) => {
      log::info!("Chatter分析完了: {}種類のオブジェクト", object_groups.len());
      Ok(AnalyzeResponse { object_groups })
    }
    Err(e) => Err(format!("{}", e)),
  }
}

/// Chatter移行処理のメインコマンド
#[command]
pub async fn process_chatter_migration(
  feed_item_path: String,
  feed_comment_path: String,
  object_mappings: HashMap<String, ObjectMapping>,
  window: tauri::Window,
) -> Result<FileMappingResponse, String> {
  log::info!("Chatter移行処理開始");

  let emit_progress = |step: &str, progress: u8, message: &str| {
    let progress_info = ProgressInfo {
      step: step.to_string(),
      progress,
      message: message.to_string(),
    };
    let _ = window.emit("chatter-migration-progress", &progress_info);
  };

  emit_progress("validation", 5, "入力データを検証中...");

  // CSVファイルの存在確認
  if !std::path::Path::new(&feed_item_path).exists() {
    return Err("FeedItem.csvが見つかりません".to_string());
  }
  if !std::path::Path::new(&feed_comment_path).exists() {
    return Err("FeedComment.csvが見つかりません".to_string());
  }

  emit_progress("hubspot_init", 10, "HubSpot接続を初期化中...");

  let credentials = SecureStorage::get_credentials_with_refresh()
    .await
    .map_err(|_| "認証情報が見つかりません。再ログインしてください。")?;

  let portal_id = credentials.portal_id.unwrap_or(0).to_string();
  let ui_domain = credentials
    .ui_domain
    .unwrap_or_else(|| "app.hubspot.com".to_string());
  let hubspot_service = HubSpotService::new(credentials.token);

  emit_progress("extract_records", 20, "Chatterレコードを抽出中...");

  // FeedItemを読み込み
  let feed_items_by_prefix =
    CsvProcessor::extract_chatter_records(&feed_item_path, &feed_comment_path, &object_mappings)
      .map_err(|e| format!("FeedItem抽出エラー: {}", e))?;

  // 対象FeedItemIdを収集
  let target_feed_item_ids: std::collections::HashSet<String> = feed_items_by_prefix
    .values()
    .flat_map(|items| items.iter().map(|item| item.id.clone()))
    .collect();

  emit_progress("load_comments", 30, "コメントを読み込み中...");

  // FeedCommentを読み込み
  let comments_by_feed_item =
    CsvProcessor::load_feed_comments(&feed_comment_path, &target_feed_item_ids)
      .map_err(|e| format!("FeedComment読み込みエラー: {}", e))?;

  emit_progress("hubspot_search", 40, "HubSpotレコードを検索中...");

  // 結果CSVファイルを作成
  let temp_dir = std::env::temp_dir();
  let result_csv_path = temp_dir.join(format!(
    "chatter_migration_result_{}.csv",
    chrono::Utc::now().timestamp()
  ));
  let mut csv_writer = csv::Writer::from_path(&result_csv_path)
    .map_err(|e| format!("CSVファイル作成エラー: {}", e))?;

  csv_writer
    .write_record([
      "Salesforce Record ID",
      "HubSpot Object",
      "HubSpot Record ID",
      "HubSpot Record URL",
      "Feed Items Count",
      "Notes Created",
      "Status",
      "Reason",
    ])
    .map_err(|e| format!("CSVヘッダー書き込みエラー: {}", e))?;

  let mut hubspot_record_cache = HashMap::new();
  let mut summaries: HashMap<String, ObjectSummary> = HashMap::new();

  // HubSpotレコード検索
  for (prefix, feed_items) in &feed_items_by_prefix {
    if let Some(mapping) = object_mappings.get(prefix) {
      let unique_parent_ids: Vec<String> = feed_items
        .iter()
        .map(|item| item.parent_id.clone())
        .collect::<std::collections::HashSet<_>>()
        .into_iter()
        .collect();

      log::info!(
        "{}: {}件のユニークParentIDを検索",
        prefix,
        unique_parent_ids.len()
      );

      match hubspot_service
        .batch_find_records(
          &mapping.hubspot_object,
          &mapping.salesforce_property,
          &unique_parent_ids,
        )
        .await
      {
        Ok(found_records) => {
          log::info!(
            "{}: {}件中{}件がHubSpotに存在",
            prefix,
            unique_parent_ids.len(),
            found_records.len()
          );

          // 見つからなかったIDをCSVに記録
          if found_records.len() < unique_parent_ids.len() {
            let missing_ids: Vec<&String> = unique_parent_ids
              .iter()
              .filter(|id| !found_records.contains_key(*id))
              .collect();

            let missing_count = missing_ids.len();

            for missing_id in missing_ids {
              let _ = csv_writer.write_record([
                missing_id,
                &mapping.hubspot_object,
                "",
                "",
                "0",
                "0",
                "skipped",
                "HubSpotにレコードが存在しません",
              ]);
            }

            summaries
              .entry(prefix.clone())
              .or_insert_with(|| ObjectSummary {
                prefix: prefix.clone(),
                hubspot_object: mapping.hubspot_object.clone(),
                success_count: 0,
                skipped_count: 0,
                error_count: 0,
                uploaded_files: 0,
              })
              .skipped_count += missing_count;
          }

          hubspot_record_cache.extend(found_records);
        }
        Err(e) => {
          log::error!("HubSpot検索エラー {}: {}", prefix, e);
          continue;
        }
      }
    }
  }

  emit_progress("create_notes", 60, "ノートを作成中...");

  // 処理可能レコードをグループ化
  let processable_records = CsvProcessor::group_chatter_records(
    feed_items_by_prefix,
    comments_by_feed_item,
    &hubspot_record_cache,
  );

  // ノート作成処理
  for (i, record) in processable_records.iter().enumerate() {
    let progress = 60 + (30 * (i + 1) / processable_records.len()) as u8;
    emit_progress(
      "create_notes",
      progress,
      &format!("処理中 ({}/{})", i + 1, processable_records.len()),
    );

    if let Some(mapping) = object_mappings
      .iter()
      .find(|(prefix, _)| record.salesforce_id.starts_with(prefix.as_str()))
      .map(|(_, m)| m)
    {
      let hubspot_record_id = hubspot_record_cache
        .get(&record.salesforce_id)
        .cloned()
        .unwrap_or_default();

      let record_url = if !hubspot_record_id.is_empty() {
        build_record_url(
          &ui_domain,
          &portal_id,
          &mapping.hubspot_object,
          &hubspot_record_id,
        )
      } else {
        String::new()
      };

      summaries
        .entry(record.salesforce_id[..3].to_string())
        .or_insert_with(|| ObjectSummary {
          prefix: record.salesforce_id[..3].to_string(),
          hubspot_object: mapping.hubspot_object.clone(),
          success_count: 0,
          skipped_count: 0,
          error_count: 0,
          uploaded_files: 0,
        });

      let mut notes_created = 0;

      for feed_item_with_comments in &record.feed_items {
        let note_html = generate_chatter_note_html(feed_item_with_comments);

        match hubspot_service
          .create_note_for_record(
            &hubspot_record_id,
            &mapping.hubspot_object,
            &note_html,
            None,
          )
          .await
        {
          Ok(_) => {
            notes_created += 1;
          }
          Err(e) => {
            log::error!(
              "ノート作成失敗 {} (FeedItem: {}): {}",
              record.salesforce_id,
              feed_item_with_comments.feed_item.id,
              e
            );
          }
        }
      }

      let status = if notes_created == record.feed_items.len() {
        if let Some(summary) = summaries.get_mut(&record.salesforce_id[..3]) {
          summary.success_count += 1;
          summary.uploaded_files += notes_created;
        }
        "success"
      } else if notes_created > 0 {
        if let Some(summary) = summaries.get_mut(&record.salesforce_id[..3]) {
          summary.success_count += 1;
          summary.uploaded_files += notes_created;
        }
        "partial"
      } else {
        if let Some(summary) = summaries.get_mut(&record.salesforce_id[..3]) {
          summary.error_count += 1;
        }
        "error"
      };

      let _ = csv_writer.write_record([
        &record.salesforce_id,
        &mapping.hubspot_object,
        &hubspot_record_id,
        &record_url,
        &record.feed_items.len().to_string(),
        &notes_created.to_string(),
        status,
        "",
      ]);
    }
  }

  csv_writer
    .flush()
    .map_err(|e| format!("CSVフラッシュエラー: {}", e))?;
  emit_progress("complete", 100, "処理完了");

  log::info!("Chatter移行処理完了");

  Ok(FileMappingResponse {
    result_csv_path: result_csv_path.to_string_lossy().to_string(),
    summaries: summaries.into_values().collect(),
  })
}

/// ChatterノートのHTMLを生成
fn generate_chatter_note_html(
  feed_item_with_comments: &crate::csv::processor::FeedItemWithComments,
) -> String {
  let feed_item = &feed_item_with_comments.feed_item;
  let comments = &feed_item_with_comments.comments;

  // 日時を整形 (ISO 8601 -> 読みやすい形式)
  let format_date = |date_str: &str| -> String {
    date_str
      .replace('T', " ")
      .replace('Z', "")
      .split('.')
      .next()
      .unwrap_or(date_str)
      .to_string()
  };

  let mut html = String::new();

  // ヘッダー
  html.push_str("<h3>📝 Chatter投稿</h3>");
  html.push_str(&format!(
    "<p><strong>投稿日時:</strong> {}</p>",
    format_date(&feed_item.created_date)
  ));
  html.push_str(&format!(
    "<p><strong>投稿者ID:</strong> {}</p>",
    feed_item.created_by_id
  ));

  // 投稿本文
  html.push_str(
    "<div style=\"border-left: 3px solid #0091ae; padding-left: 12px; margin: 12px 0;\">",
  );
  html.push_str(&feed_item.body);
  html.push_str("</div>");

  // コメント
  if !comments.is_empty() {
    html.push_str(&format!("<h4>💬 コメント ({}件)</h4>", comments.len()));

    for comment in comments {
      html.push_str("<div style=\"margin-left: 20px; border-left: 2px solid #ccc; padding-left: 12px; margin-top: 8px;\">");
      html.push_str(&format!(
        "<p><strong>{}</strong> - 投稿者ID: {}</p>",
        format_date(&comment.created_date),
        comment.created_by_id
      ));
      html.push_str("<div>");
      html.push_str(&comment.comment_body);
      html.push_str("</div>");
      html.push_str("</div>");
    }
  }

  // フッター
  html.push_str("<hr style=\"margin: 16px 0; border: none; border-top: 1px solid #e0e0e0;\">");
  html.push_str(&format!(
    "<p style=\"font-size: 11px; color: #666;\">Salesforce FeedItem ID: {}</p>",
    feed_item.id
  ));

  html
}
