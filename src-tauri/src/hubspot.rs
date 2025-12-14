// HubSpot API関連の処理を行うモジュール
use anyhow::{anyhow, Result};
use base64::Engine;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

/// HubSpotサービス構造体
/// APIトークンとHTTPクライアントを管理
pub struct HubSpotService {
  /// HubSpot APIアクセストークン
  token: String,
  /// HTTP通信用クライアント
  client: Client,
  /// レート制限対応用の遅延時間（ミリ秒）
  rate_limit_delay: u64,
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

/// HubSpotアカウント詳細情報
#[derive(Debug, Serialize, Deserialize)]
pub struct AccountDetails {
  #[serde(rename = "portalId")]
  pub portal_id: u64,
  #[serde(rename = "accountType")]
  pub account_type: String,
  #[serde(rename = "timeZone")]
  pub time_zone: String,
  #[serde(rename = "companyCurrency")]
  pub company_currency: String,
  #[serde(rename = "uiDomain")]
  pub ui_domain: String,
  #[serde(rename = "dataHostingLocation")]
  pub data_hosting_location: String,
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
  /// 新しいHubSpotServiceインスタンスを作成
  pub fn new(token: String) -> Self {
    Self {
      token,
      client: Client::new(),
      rate_limit_delay: 100, // 100ms
    }
  }

  /// HubSpotトークンを検証してアカウント情報を取得
  pub async fn verify_token(&self) -> Result<AccountDetails> {
    self.get_account_details().await
  }

  /// HubSpotアカウント詳細情報を取得
  pub async fn get_account_details(&self) -> Result<AccountDetails> {
    let url = "https://api.hubapi.com/account-info/v3/details";

    let response = self.client.get(url).bearer_auth(&self.token).send().await?;

    if !response.status().is_success() {
      return Err(anyhow!("無効なトークンです: {}", response.status()));
    }

    let account_details: AccountDetails = response.json().await?;
    Ok(account_details)
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
        .bearer_auth(&self.token)
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
    // URLエンコード
    let encoded_path =
      url::form_urlencoded::byte_serialize(file_path.as_bytes()).collect::<String>();

    let url = format!(
      "https://api.hubapi.com/files/v3/files/stat/{}",
      encoded_path
    );

    let response = self
      .client
      .get(&url)
      .bearer_auth(&self.token)
      .send()
      .await?;

    if response.status().is_success() {
      let data: serde_json::Value = response.json().await?;

      if let Some(file_data) = data.get("file") {
        let file_info = FileInfo {
          id: file_data["id"].as_str().unwrap_or("").to_string(),
          name: file_data["name"].as_str().unwrap_or("").to_string(),
          path: file_data["path"].as_str().unwrap_or("").to_string(),
          url: file_data["url"].as_str().map(|s| s.to_string()),
        };
        return Ok(Some(file_info));
      }
    }

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
      .bearer_auth(&self.token)
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
      .bearer_auth(&self.token)
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

  /// すべてのHubSpotオブジェクトを取得（標準 + カスタム）
  pub async fn get_all_objects(&self) -> Result<Vec<crate::commands::HubSpotObject>> {
    let mut objects = Vec::new();

    // 標準オブジェクトを追加
    objects.extend(vec![
      crate::commands::HubSpotObject {
        object_type_id: "contacts".to_string(),
        name: "contacts".to_string(),
        label: "コンタクト".to_string(),
      },
      crate::commands::HubSpotObject {
        object_type_id: "companies".to_string(),
        name: "companies".to_string(),
        label: "会社".to_string(),
      },
      crate::commands::HubSpotObject {
        object_type_id: "deals".to_string(),
        name: "deals".to_string(),
        label: "取引".to_string(),
      },
      crate::commands::HubSpotObject {
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
  async fn get_custom_objects(&self) -> Result<Vec<crate::commands::HubSpotObject>> {
    let url = "https://api.hubapi.com/crm/v3/schemas";

    let response = self.client.get(url).bearer_auth(&self.token).send().await?;

    if response.status().is_success() {
      let schema_response: SchemaResponse = response.json().await?;

      let custom_objects: Vec<crate::commands::HubSpotObject> = schema_response
        .results
        .into_iter()
        .filter(|obj| {
          !matches!(
            obj.id.as_str(),
            "contacts" | "companies" | "deals" | "tickets"
          )
        })
        .map(|obj| crate::commands::HubSpotObject {
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
