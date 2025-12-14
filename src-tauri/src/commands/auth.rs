// OAuth関連のTauriコマンド
use crate::auth::{generate_auth_url, generate_state, OAuthState, SecureStorage};
use anyhow::Result;
use serde::Serialize;
use tauri::{command, State};

/// ポータル情報
#[derive(Debug, Serialize)]
pub struct PortalInfo {
  pub portal_id: u32,
  pub ui_domain: String,
}

/// OAuth設定（ビルド時に環境変数から取得）
const HUBSPOT_CLIENT_ID: &str = match option_env!("HUBSPOT_CLIENT_ID") {
  Some(id) => id,
  None => "HUBSPOT_CLIENT_ID environment variable not set at build time",
};

const OAUTH_WORKER_URL: &str = match option_env!("OAUTH_WORKER_URL") {
  Some(url) => url,
  None => "https://hubspot-oauth-proxy.stlb-file-trans.workers.dev",
};

fn get_client_id() -> String {
  HUBSPOT_CLIENT_ID.to_string()
}

fn get_worker_url() -> String {
  OAUTH_WORKER_URL.to_string()
}

/// OAuth認証を開始
#[command]
pub async fn start_oauth_flow(oauth_state: State<'_, OAuthState>) -> Result<String, String> {
  let state = generate_state();

  // state を保存
  *oauth_state.pending_auth.lock().map_err(|e| e.to_string())? = Some(state.clone());

  let auth_url = generate_auth_url(&get_client_id(), &get_worker_url(), &state);

  Ok(auth_url)
}

/// 認証状態を確認（期限切れの場合は自動リフレッシュ）
#[command]
pub async fn is_authenticated() -> Result<Option<PortalInfo>, String> {
  match SecureStorage::get_credentials_with_refresh().await {
    Ok(credentials) => {
      if let (Some(portal_id), Some(ui_domain)) = (credentials.portal_id, credentials.ui_domain) {
        Ok(Some(PortalInfo {
          portal_id,
          ui_domain,
        }))
      } else {
        Ok(None)
      }
    }
    Err(_) => Ok(None),
  }
}

/// トークンを保存
#[command]
pub async fn save_oauth_tokens(
  access_token: String,
  refresh_token: String,
  expires_in: u64,
  portal_id: u32,
  ui_domain: String,
) -> Result<(), String> {
  let expires_at = chrono::Utc::now().timestamp() + expires_in as i64;

  let credentials = crate::auth::StoredCredentials {
    token: access_token,
    refresh_token: Some(refresh_token),
    expires_at: Some(expires_at),
    portal_id: Some(portal_id),
    ui_domain: Some(ui_domain),
  };

  SecureStorage::store_credentials(&credentials).map_err(|e| e.to_string())?;
  Ok(())
}

/// ログアウト
#[command]
pub async fn logout() -> Result<(), String> {
  match SecureStorage::clear_credentials() {
    Ok(_) => {
      log::info!("Credentials cleared successfully");
      Ok(())
    }
    Err(e) => {
      log::error!("Failed to clear credentials: {}", e);
      Err(format!("ログアウトに失敗: {}", e))
    }
  }
}
