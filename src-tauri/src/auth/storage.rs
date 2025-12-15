use anyhow::Result;
use keyring::Entry;
use serde::{Deserialize, Serialize};

const SERVICE_NAME: &str = "start-connect";
const CREDENTIALS_KEY: &str = "credentials";

const OAUTH_WORKER_URL: &str = match option_env!("OAUTH_WORKER_URL") {
  Some(url) => url,
  None => "https://hubspot-oauth-proxy.stlb-file-trans.workers.dev",
};

#[derive(Debug, Serialize, Deserialize)]
pub struct StoredCredentials {
  pub token: String,
  pub refresh_token: Option<String>,
  pub expires_at: Option<i64>,
  pub portal_id: Option<u32>,
  pub ui_domain: Option<String>,
}

pub struct SecureStorage;

impl SecureStorage {
  pub fn store_credentials(credentials: &StoredCredentials) -> Result<()> {
    let entry = Entry::new(SERVICE_NAME, CREDENTIALS_KEY)?;
    let _ = entry.delete_credential();
    let json = serde_json::to_string(credentials)?;
    entry.set_password(&json)?;
    Ok(())
  }

  pub fn get_credentials() -> Result<StoredCredentials> {
    let entry = Entry::new(SERVICE_NAME, CREDENTIALS_KEY)?;
    let json = entry.get_password()?;
    let credentials = serde_json::from_str(&json)?;
    Ok(credentials)
  }

  /// 有効な認証情報を取得（期限切れの場合は自動リフレッシュ）
  pub async fn get_credentials_with_refresh() -> Result<StoredCredentials> {
    let credentials = Self::get_credentials()?;

    // 有効期限をチェック
    if let Some(expires_at) = credentials.expires_at {
      let now = chrono::Utc::now().timestamp();
      // 5分のバッファを持たせてリフレッシュ
      if now >= expires_at - 300 {
        log::info!("Token expired or expiring soon, refreshing...");
        Self::refresh_token().await?;
        return Self::get_credentials();
      }
    }

    Ok(credentials)
  }

  /// トークンをリフレッシュ（内部関数）
  async fn refresh_token() -> Result<()> {
    let credentials = Self::get_credentials()?;

    let refresh_token = credentials
      .refresh_token
      .ok_or_else(|| anyhow::anyhow!("リフレッシュトークンが見つかりません"))?;

    let portal_id = credentials
      .portal_id
      .ok_or_else(|| anyhow::anyhow!("ポータルIDが見つかりません"))?;
    let ui_domain = credentials
      .ui_domain
      .ok_or_else(|| anyhow::anyhow!("UIドメインが見つかりません"))?;

    let client = reqwest::Client::new();
    let response = client
      .post(format!("{}/oauth/refresh", OAUTH_WORKER_URL))
      .json(&serde_json::json!({ "refresh_token": refresh_token }))
      .send()
      .await?;

    if !response.status().is_success() {
      return Err(anyhow::anyhow!(
        "トークンリフレッシュに失敗: {}",
        response.status()
      ));
    }

    let token_data: TokenRefreshResponse = response.json().await?;

    let expires_at = chrono::Utc::now().timestamp() + token_data.expires_in as i64;
    let new_credentials = StoredCredentials {
      token: token_data.access_token,
      refresh_token: Some(token_data.refresh_token),
      expires_at: Some(expires_at),
      portal_id: Some(portal_id),
      ui_domain: Some(ui_domain),
    };

    Self::store_credentials(&new_credentials)?;
    log::info!("Token refreshed successfully");
    Ok(())
  }

  pub fn clear_credentials() -> Result<()> {
    log::debug!("Attempting to clear credentials from keychain");
    let entry = Entry::new(SERVICE_NAME, CREDENTIALS_KEY)?;
    log::debug!("Entry created, deleting credential...");
    entry.delete_credential()?;
    log::debug!("Credential deleted successfully");
    Ok(())
  }
}

#[derive(Debug, Deserialize)]
struct TokenRefreshResponse {
  access_token: String,
  refresh_token: String,
  expires_in: u64,
}
