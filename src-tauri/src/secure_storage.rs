use keyring::Entry;
use serde::{Deserialize, Serialize};
use anyhow::{Result, anyhow};

const SERVICE_NAME: &str = "sf-hs-file-trans-app";
const TOKEN_KEY: &str = "hubspot_token";
const PORTAL_ID_KEY: &str = "hubspot_portal_id";
const UI_DOMAIN_KEY: &str = "hubspot_ui_domain";

#[derive(Debug, Serialize, Deserialize)]
pub struct StoredCredentials {
    pub token: String,
    pub portal_id: Option<u32>,
    pub ui_domain: Option<String>,
}

pub struct SecureStorage;

impl SecureStorage {
    pub fn store_token(token: &str) -> Result<()> {
        log::debug!("Storing token in keychain: service={}, account={}", SERVICE_NAME, TOKEN_KEY);
        let entry = Entry::new(SERVICE_NAME, TOKEN_KEY)?;
        entry.set_password(token)?;
        log::debug!("Token stored successfully");
        Ok(())
    }

    pub fn get_token() -> Result<String> {
        log::debug!("Retrieving token from keychain: service={}, account={}", SERVICE_NAME, TOKEN_KEY);
        let entry = Entry::new(SERVICE_NAME, TOKEN_KEY)?;
        let result = entry.get_password().map_err(|e| anyhow!("Token not found: {}", e));
        log::debug!("Token retrieval result: {}", result.is_ok());
        result
    }

    pub fn store_portal_id(portal_id: u32) -> Result<()> {
        let entry = Entry::new(SERVICE_NAME, PORTAL_ID_KEY)?;
        entry.set_password(&portal_id.to_string())?;
        Ok(())
    }

    pub fn get_portal_id() -> Result<u32> {
        let entry = Entry::new(SERVICE_NAME, PORTAL_ID_KEY)?;
        let portal_id_str = entry.get_password().map_err(|e| anyhow!("Portal ID not found: {}", e))?;
        portal_id_str.parse().map_err(|e| anyhow!("Invalid portal ID format: {}", e))
    }

    pub fn store_ui_domain(ui_domain: &str) -> Result<()> {
        let entry = Entry::new(SERVICE_NAME, UI_DOMAIN_KEY)?;
        entry.set_password(ui_domain)?;
        Ok(())
    }

    pub fn get_ui_domain() -> Result<String> {
        let entry = Entry::new(SERVICE_NAME, UI_DOMAIN_KEY)?;
        entry.get_password().map_err(|e| anyhow!("UI Domain not found: {}", e))
    }

    pub fn store_credentials(credentials: &StoredCredentials) -> Result<()> {
        log::debug!("Storing credentials: token_len={}, portal_id={:?}", credentials.token.len(), credentials.portal_id);
        Self::store_token(&credentials.token)?;
        if let Some(portal_id) = credentials.portal_id {
            Self::store_portal_id(portal_id)?;
        }
        if let Some(ui_domain) = &credentials.ui_domain {
            Self::store_ui_domain(ui_domain)?;
        }
        log::debug!("Credentials stored successfully");
        Ok(())
    }

    pub fn get_credentials() -> Result<StoredCredentials> {
        let token = Self::get_token()?;
        let portal_id = Self::get_portal_id().ok();
        let ui_domain = Self::get_ui_domain().ok();
        Ok(StoredCredentials { token, portal_id, ui_domain })
    }

    pub fn clear_credentials() -> Result<()> {
        if let Ok(entry) = Entry::new(SERVICE_NAME, TOKEN_KEY) {
            let _ = entry.delete_credential();
        }
        if let Ok(entry) = Entry::new(SERVICE_NAME, PORTAL_ID_KEY) {
            let _ = entry.delete_credential();
        }
        if let Ok(entry) = Entry::new(SERVICE_NAME, UI_DOMAIN_KEY) {
            let _ = entry.delete_credential();
        }
        Ok(())
    }
}