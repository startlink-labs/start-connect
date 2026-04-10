// HubSpot API関連の処理を行うモジュール
use anyhow::{anyhow, Result};
use base64::Engine;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

/// HubSpotサービス構造体
/// APIトークンとHTTPクライアントを管理
pub struct HubSpotService {
  /// HubSpot APIアクセストークン（長時間処理中にリフレッシュ可能）
  token: Mutex<String>,
  /// HTTP通信用クライアント
  client: Client,
  /// レート制限対応用の遅延時間（ミリ秒）
  rate_limit_delay: u64,
  /// トークン有効期限（Unixタイムスタンプ）
  expires_at: Mutex<Option<i64>>,
}

/// HubSpotレコード検索結果
#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
  /// 検索結果のレコード一覧
  pub results: Vec<HubSpotRecord>,
}

/// HubSpotレコード情報
#[derive(Debug, Serialize, Deserialize)]
pub struct HubSpotRecord {
  /// レコードID
  pub id: String,
  /// プロパティ情報
  pub properties: HashMap<String, String>,
}

/// ファイル情報構造体
#[derive(Debug, Serialize, Deserialize)]
pub struct FileInfo {
  /// ファイルID
  pub id: String,
  /// ファイル名
  pub name: String,
  /// ファイルパス
  pub path: String,
  /// ファイルURL
  pub url: Option<String>,
}

/// HubSpotオブジェクト情報
#[derive(Debug, Serialize, Deserialize)]
pub struct HubSpotObjectInfo {
  /// オブジェクトタイプID
  pub id: String,
  /// オブジェクト名
  pub name: String,
  /// ラベル
  pub labels: ObjectLabels,
}

/// オブジェクトラベル
#[derive(Debug, Serialize, Deserialize)]
pub struct ObjectLabels {
  /// 単数形ラベル
  pub singular: String,
  /// 複数形ラベル
  pub plural: String,
}

/// スキーマAPIレスポンス
#[derive(Debug, Serialize, Deserialize)]
pub struct SchemaResponse {
  /// 結果一覧
  pub results: Vec<HubSpotObjectInfo>,
}

/// ノート作成用のリクエストデータ
#[derive(Debug, Serialize)]
struct CreateNoteRequest {
  /// ノートのプロパティ
  properties: NoteProperties,
  /// 関連付け情報
  associations: Vec<Association>,
}

/// ノートのプロパティ
#[derive(Debug, Serialize)]
struct NoteProperties {
  /// ノート本文
  hs_note_body: String,
  /// タイムスタンプ
  hs_timestamp: String,
  /// 添付ファイルID（セミコロン区切り）
  hs_attachment_ids: Option<String>,
}

/// 関連付け情報
#[derive(Debug, Serialize)]
struct Association {
  /// 関連付け先
  to: AssociationTarget,
  /// 関連付けタイプ
  types: Vec<AssociationType>,
}

/// 関連付け先
#[derive(Debug, Serialize)]
struct AssociationTarget {
  /// 関連付け先のID
  id: String,
}

/// 関連付けタイプ
#[derive(Debug, Serialize)]
struct AssociationType {
  /// 関連付けカテゴリ
  #[serde(rename = "associationCategory")]
  association_category: String,
  /// 関連付けタイプID
  #[serde(rename = "associationTypeId")]
  association_type_id: u32,
}

impl HubSpotService {
  /// 新しいHubSpotServiceインスタンスを作成（有効期限なし、短時間処理向け）
  #[allow(dead_code)]
  pub fn new(token: String) -> Self {
    Self {
      token: Mutex::new(token),
      client: Client::new(),
      rate_limit_delay: 100, // 100ms
      expires_at: Mutex::new(None),
    }
  }

  /// トークンと有効期限を指定して作成
  pub fn new_with_expiry(token: String, expires_at: Option<i64>) -> Self {
    Self {
      token: Mutex::new(token),
      client: Client::new(),
      rate_limit_delay: 100,
      expires_at: Mutex::new(expires_at),
    }
  }

  /// トークンを取得（内部用）
  fn get_token(&self) -> String {
    self.token.lock().unwrap().clone()
  }

  /// 必要に応じてトークンをリフレッシュ（有効期限5分前にリフレッシュ）
  pub async fn refresh_token_if_needed(&self) -> Result<()> {
    let should_refresh = {
      let expires_at = self.expires_at.lock().unwrap();
      if let Some(exp) = *expires_at {
        chrono::Utc::now().timestamp() >= exp - 300
      } else {
        false
      }
    };

    if should_refresh {
      log::info!("トークンの有効期限が近いためリフレッシュ中...");
      let credentials = crate::auth::storage::SecureStorage::get_credentials_with_refresh().await?;
      *self.token.lock().unwrap() = credentials.token;
      *self.expires_at.lock().unwrap() = credentials.expires_at;
      log::info!("トークンリフレッシュ完了");
    }

    Ok(())
  }

  /// バッチでHubSpotレコードを検索
  /// 複数のSalesforce IDを一度に検索して効率化
  pub async fn batch_find_records(
    &self,
    object_type: &str,
    property_name: &str,
    property_values: &[String],
  ) -> Result<HashMap<String, String>> {
    let mut found_records = HashMap::new();
    let batch_size = 100; // HubSpot APIの制限に合わせる

    // バッチサイズごとに分割して処理
    for chunk in property_values.chunks(batch_size) {
      let search_request = serde_json::json!({
          "filterGroups": [{
              "filters": [{
                  "propertyName": property_name,
                  "operator": "IN",
                  "values": chunk
              }]
          }],
          "properties": ["hs_object_id", property_name],
          "limit": 100
      });

      let url = format!(
        "https://api.hubapi.com/crm/v3/objects/{}/search",
        object_type
      );

      let response = self
        .client
        .post(&url)
        .bearer_auth(&self.get_token())
        .json(&search_request)
        .send()
        .await?;

      if response.status().is_success() {
        let search_result: SearchResult = response.json().await?;

        // 検索結果からSalesforce ID -> HubSpot IDのマッピングを作成
        for record in search_result.results {
          if let Some(sf_id) = record.properties.get(property_name) {
            found_records.insert(sf_id.clone(), record.id);
          }
        }
      }

      // レート制限対応のための遅延
      tokio::time::sleep(tokio::time::Duration::from_millis(self.rate_limit_delay)).await;
    }

    Ok(found_records)
  }

  /// ファイルパスからHubSpotファイル情報を取得
  pub async fn get_file_by_path(&self, file_path: &str) -> Result<Option<FileInfo>> {
    // パスをセグメントごとに分割してパーセントエンコード
    use percent_encoding::{utf8_percent_encode, NON_ALPHANUMERIC};
    let encoded_path = file_path
      .split('/')
      .map(|segment| utf8_percent_encode(segment, NON_ALPHANUMERIC).to_string())
      .collect::<Vec<_>>()
      .join("%2F");

    let url = format!(
      "https://api.hubapi.com/files/v3/files/stat/{}",
      encoded_path
    );

    log::debug!("[FileCheck] Checking file: {}", file_path);
    log::debug!("[FileCheck] Encoded URL: {}", url);

    let response = self
      .client
      .get(&url)
      .bearer_auth(&self.get_token())
      .send()
      .await?;

    log::debug!("[FileCheck] Response status: {}", response.status());

    if response.status().is_success() {
      let data: serde_json::Value = response.json().await?;

      if let Some(file_data) = data.get("file") {
        let file_info = FileInfo {
          id: file_data["id"].as_str().unwrap_or("").to_string(),
          name: file_data["name"].as_str().unwrap_or("").to_string(),
          path: file_data["path"].as_str().unwrap_or("").to_string(),
          url: file_data["url"].as_str().map(|s| s.to_string()),
        };
        log::debug!(
          "[FileCheck] File found: {} (ID: {})",
          file_path,
          file_info.id
        );
        return Ok(Some(file_info));
      }
    }

    log::debug!("[FileCheck] File not found: {}", file_path);
    Ok(None)
  }

  /// base64データからHubSpotにファイルをアップロード
  pub async fn upload_file_from_base64(&self, base64_data: &str, filename: &str) -> Result<String> {
    // base64デコード
    let file_content = base64::engine::general_purpose::STANDARD
      .decode(base64_data)
      .map_err(|e| anyhow!("base64デコードエラー: {}", e))?;

    // マルチパートフォームを作成
    let form = reqwest::multipart::Form::new()
      .text("options", r#"{"access": "PRIVATE"}"#)
      .text("folderPath", "salesforce")
      .part(
        "file",
        reqwest::multipart::Part::bytes(file_content)
          .file_name(filename.to_string())
          .mime_str("application/octet-stream")?,
      );

    let url = "https://api.hubapi.com/files/v3/files";

    let response = self
      .client
      .post(url)
      .bearer_auth(&self.get_token())
      .multipart(form)
      .send()
      .await?;

    if response.status().is_success() {
      let data: serde_json::Value = response.json().await?;
      let file_id = data["id"].as_str().unwrap_or("");
      Ok(file_id.to_string())
    } else {
      Err(anyhow!(
        "ファイルアップロードに失敗しました: {}",
        response.status()
      ))
    }
  }

  /// レコードにノートを作成（ファイル添付付き）
  pub async fn create_note_for_record(
    &self,
    hubspot_record_id: &str,
    object_type: &str,
    note_content: &str,
    file_ids: Option<Vec<String>>,
  ) -> Result<()> {
    // オブジェクトタイプに応じた関連付けタイプIDを決定
    let association_type_id = match object_type {
      "contacts" => 202,
      "companies" => 190,
      "deals" => 214,
      "tickets" => 226,
      _ => 202, // デフォルトはcontacts
    };

    // 現在時刻をミリ秒で取得
    let timestamp = SystemTime::now()
      .duration_since(UNIX_EPOCH)?
      .as_millis()
      .to_string();

    // ノート作成リクエストを構築
    let note_request = CreateNoteRequest {
      properties: NoteProperties {
        hs_note_body: note_content.to_string(),
        hs_timestamp: timestamp,
        hs_attachment_ids: file_ids.map(|ids| ids.join(";")),
      },
      associations: vec![Association {
        to: AssociationTarget {
          id: hubspot_record_id.to_string(),
        },
        types: vec![AssociationType {
          association_category: "HUBSPOT_DEFINED".to_string(),
          association_type_id,
        }],
      }],
    };

    let url = "https://api.hubapi.com/crm/v3/objects/notes";

    let response = self
      .client
      .post(url)
      .bearer_auth(&self.get_token())
      .json(&note_request)
      .send()
      .await?;

    if response.status().is_success() {
      log::info!("ノート作成成功: {}", hubspot_record_id);
      Ok(())
    } else {
      let status = response.status();
      let error_text = response
        .text()
        .await
        .unwrap_or_else(|_| "Unknown error".to_string());
      Err(anyhow!(
        "ノート作成に失敗しました: {} - {}",
        status,
        error_text
      ))
    }
  }

  /// 指定されたFeedItem IDのノートが既に存在するか確認
  /// レコードに紐づくノートを検索し、本文にFeedItem IDが含まれるものがあるかチェック
  pub async fn find_existing_feed_item_ids(
    &self,
    hubspot_record_id: &str,
    object_type: &str,
  ) -> Result<std::collections::HashSet<String>> {
    let mut existing_ids = std::collections::HashSet::new();

    // レコードに紐づくノートのIDを取得
    let url = format!(
      "https://api.hubapi.com/crm/v4/objects/{}/{}/associations/notes",
      object_type, hubspot_record_id
    );

    let response = self
      .client
      .get(&url)
      .bearer_auth(&self.get_token())
      .send()
      .await?;

    if !response.status().is_success() {
      log::debug!("ノート関連付け取得失敗: {}", response.status());
      return Ok(existing_ids);
    }

    let data: serde_json::Value = response.json().await?;
    let note_ids: Vec<String> = data["results"]
      .as_array()
      .unwrap_or(&vec![])
      .iter()
      .filter_map(|r| r["toObjectId"].as_u64().map(|id| id.to_string()))
      .collect();

    if note_ids.is_empty() {
      return Ok(existing_ids);
    }

    // ノートの本文をバッチ取得（100件ずつ）
    for chunk in note_ids.chunks(100) {
      let batch_request = serde_json::json!({
        "inputs": chunk.iter().map(|id| serde_json::json!({"id": id})).collect::<Vec<_>>(),
        "properties": ["hs_note_body"]
      });

      let batch_url = "https://api.hubapi.com/crm/v3/objects/notes/batch/read";
      let response = self
        .client
        .post(batch_url)
        .bearer_auth(&self.get_token())
        .json(&batch_request)
        .send()
        .await?;

      if response.status().is_success() {
        let batch_data: serde_json::Value = response.json().await?;
        if let Some(results) = batch_data["results"].as_array() {
          for note in results {
            if let Some(body) = note["properties"]["hs_note_body"].as_str() {
              // "Salesforce FeedItem ID: xxx" パターンを抽出
              if let Some(pos) = body.find("Salesforce FeedItem ID: ") {
                let id_start = pos + "Salesforce FeedItem ID: ".len();
                let id_str = &body[id_start..];
                // IDは</p>の手前まで
                let feed_item_id = id_str
                  .split('<')
                  .next()
                  .unwrap_or("")
                  .trim()
                  .to_string();
                if !feed_item_id.is_empty() {
                  existing_ids.insert(feed_item_id);
                }
              }
            }
          }
        }
      }

      tokio::time::sleep(tokio::time::Duration::from_millis(self.rate_limit_delay)).await;
    }

    Ok(existing_ids)
  }

  /// すべてのHubSpotオブジェクトを取得（標準 + カスタム）
  pub async fn get_all_objects(&self) -> Result<Vec<crate::commands::business::HubSpotObject>> {
    let mut objects = Vec::new();

    // 標準オブジェクトを追加
    objects.extend(vec![
      crate::commands::business::HubSpotObject {
        object_type_id: "contacts".to_string(),
        name: "contacts".to_string(),
        label: "コンタクト".to_string(),
      },
      crate::commands::business::HubSpotObject {
        object_type_id: "companies".to_string(),
        name: "companies".to_string(),
        label: "会社".to_string(),
      },
      crate::commands::business::HubSpotObject {
        object_type_id: "deals".to_string(),
        name: "deals".to_string(),
        label: "取引".to_string(),
      },
      crate::commands::business::HubSpotObject {
        object_type_id: "tickets".to_string(),
        name: "tickets".to_string(),
        label: "チケット".to_string(),
      },
    ]);

    // カスタムオブジェクトを取得
    match self.get_custom_objects().await {
      Ok(custom_objects) => {
        let count = custom_objects.len();
        objects.extend(custom_objects);
        log::info!("カスタムオブジェクト: {}件", count);
      }
      Err(e) => {
        log::warn!("カスタムオブジェクト取得エラー: {}", e);
      }
    }

    Ok(objects)
  }

  /// カスタムオブジェクトを取得
  async fn get_custom_objects(&self) -> Result<Vec<crate::commands::business::HubSpotObject>> {
    let url = "https://api.hubapi.com/crm/v3/schemas";

    let response = self.client.get(url).bearer_auth(&self.get_token()).send().await?;

    if response.status().is_success() {
      let schema_response: SchemaResponse = response.json().await?;

      let custom_objects: Vec<crate::commands::business::HubSpotObject> = schema_response
        .results
        .into_iter()
        .filter(|obj| {
          !matches!(
            obj.id.as_str(),
            "contacts" | "companies" | "deals" | "tickets"
          )
        })
        .map(|obj| crate::commands::business::HubSpotObject {
          object_type_id: obj.id.clone(),
          name: obj.name,
          label: obj.labels.plural.to_string(),
        })
        .collect();

      Ok(custom_objects)
    } else {
      let status = response.status();
      let error_text = response
        .text()
        .await
        .unwrap_or_else(|_| "Unknown error".to_string());
      Err(anyhow!(
        "カスタムオブジェクト取得エラー: {} - {}",
        status,
        error_text
      ))
    }
  }
}
