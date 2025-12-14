// Tauriコマンド定義モジュール
// フロントエンドから呼び出し可能なRust関数を定義

use crate::csv_processor::{CsvProcessor, ObjectMapping};
use crate::hubspot::HubSpotService;
use crate::secure_storage::{SecureStorage, StoredCredentials};
use anyhow::Result;
use serde::Serialize;
use std::collections::HashMap;

use tauri::{command, Emitter};

/// ファイルマッピング処理のレスポンスデータ
#[derive(Debug, Serialize)]
pub struct FileMappingResponse {
  /// 処理成功フラグ
  pub success: bool,
  /// メッセージ
  pub message: String,
  /// 処理されたレコード数
  pub processed_records: usize,
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

/// フロントエンド用のポータル情報（tokenなし）
#[derive(Debug, Serialize)]
pub struct PortalInfo {
  pub portal_id: Option<u32>,
  pub ui_domain: Option<String>,
}

/// フロントエンド用のポータル情報を取得（tokenなし）
#[command]
pub async fn get_portal_info() -> Result<Option<PortalInfo>, String> {
  match SecureStorage::get_credentials() {
    Ok(credentials) => Ok(Some(PortalInfo {
      portal_id: credentials.portal_id,
      ui_domain: credentials.ui_domain,
    })),
    Err(_) => Ok(None),
  }
}

/// 認証情報を保存してトークンを検証
#[command]
pub async fn login_and_store(token: String) -> Result<PortalInfo, String> {
  log::info!("ログイン処理開始: token_len={}", token.len());

  let service = HubSpotService::new(token.clone());

  // トークン検証
  let account_details = match service.verify_token().await {
    Ok(details) => {
      log::debug!(
        "トークン検証成功: portal_id={}, ui_domain={}",
        details.portal_id,
        details.ui_domain
      );
      details
    }
    Err(e) => {
      log::error!("トークン検証失敗: {}", e);
      return Err(format!("トークン検証に失敗しました: {}", e));
    }
  };

  let credentials = StoredCredentials {
    token: token.clone(),
    portal_id: Some(account_details.portal_id as u32),
    ui_domain: Some(account_details.ui_domain),
  };

  // セキュアストレージに保存
  log::debug!("セキュアストレージに保存開始");
  if let Err(e) = SecureStorage::store_credentials(&credentials) {
    log::error!("認証情報保存失敗: {}", e);
    return Err(format!("認証情報の保存に失敗しました: {}", e));
  }

  log::info!("ログイン成功: portal_id = {}", account_details.portal_id);
  Ok(PortalInfo {
    portal_id: credentials.portal_id,
    ui_domain: credentials.ui_domain,
  })
}

/// 保存された認証情報をクリア
#[command]
pub async fn logout_and_clear() -> Result<(), String> {
  log::info!("ログアウト処理開始");

  if let Err(e) = SecureStorage::clear_credentials() {
    log::error!("認証情報クリア失敗: {}", e);
    return Err(format!("認証情報のクリアに失敗しました: {}", e));
  }

  log::info!("ログアウト完了");
  Ok(())
}

/// HubSpotトークン検証コマンド（後方互換性のため残す）
#[command]
pub async fn verify_hubspot_token(token: String) -> Result<u64, String> {
  log::info!("HubSpotトークン検証開始");

  let service = HubSpotService::new(token);

  match service.verify_token().await {
    Ok(account_details) => {
      log::info!(
        "トークン検証成功: portal_id = {}",
        account_details.portal_id
      );
      Ok(account_details.portal_id)
    }
    Err(e) => {
      log::error!("トークン検証失敗: {}", e);
      Err(format!("トークン検証に失敗しました: {}", e))
    }
  }
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

  // 2. 保存されたトークンを取得してHubSpotサービス初期化
  let credentials = SecureStorage::get_credentials()
    .map_err(|_| "認証情報が見つかりません。再ログインしてください。")?;

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
  let (file_info, filtered_target_records) =
    match CsvProcessor::get_file_info_and_filter_records(&content_version_path, &target_records) {
      Ok(result) => result,
      Err(e) => return Err(format!("ファイル情報取得エラー: {}", e)),
    };

  log::info!("ファイル情報: {}件", file_info.len());

  emit_progress("hubspot_search", 50, "HubSpotレコードを検索中...");

  // 5. HubSpotでレコード存在確認とグループ化
  let mut all_processable_records = HashMap::new();
  let mut hubspot_record_cache = HashMap::new();

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
          continue;
        }
      }
    }
  }

  let total_processable: usize = all_processable_records.values().map(|v| v.len()).sum();
  log::info!("処理可能レコード: {}件", total_processable);

  emit_progress("file_processing", 70, "ファイル処理とアップロード中...");

  // 6. ファイル処理とノート作成
  let mut processed_records = 0;
  let mut uploaded_files = 0;
  let mut error_count = 0;

  for (prefix, records) in &all_processable_records {
    if let Some(mapping) = object_mappings.get(prefix) {
      log::info!("{}: {}件の処理可能レコードを処理", prefix, records.len());

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
            uploaded_files += files_uploaded;
            if note_created {
              processed_records += 1;
            }
            log::info!(
              "処理完了: {} - {}件のファイル",
              record.salesforce_id,
              record.content_document_ids.len()
            );
          }
          Err(e) => {
            error_count += 1;
            log::error!("レコード処理エラー {}: {}", record.salesforce_id, e);
          }
        }
      }
    }
  }

  emit_progress("complete", 100, "処理完了");

  let response = FileMappingResponse {
    success: true,
    message: format!(
      "{}件のレコードを処理し、{}個のファイルをアップロードしました（エラー: {}件）",
      processed_records, uploaded_files, error_count
    ),
    processed_records,
    uploaded_files,
  };

  log::info!("ファイルマッピング処理完了: {:?}", response);
  Ok(response)
}

/// 単一レコードの処理
/// ファイルアップロードとノート作成を行う
async fn process_single_record(
  hubspot_service: &HubSpotService,
  record: &crate::csv_processor::ProcessableRecord,
  file_info: &HashMap<String, crate::csv_processor::FileInfo>,
  _content_folder_path: &str,
  hubspot_object: &str,
  hubspot_record_cache: &HashMap<String, String>,
) -> Result<(usize, bool)> {
  let mut uploaded_files = 0;
  let mut file_ids = Vec::new();

  // 各ファイルを処理
  for content_doc_id in &record.content_document_ids {
    if let Some(file_data) = file_info.get(content_doc_id) {
      let safe_filename = format!("{}_{}", file_data.version_id, file_data.path_on_client);

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

  // 保存されたトークンを取得
  let credentials = SecureStorage::get_credentials()
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
