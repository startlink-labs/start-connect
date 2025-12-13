use keyring::Entry;
use serde::{Deserialize, Serialize};
use anyhow::{Result, anyhow};

const SERVICE_NAME: &str = "sf-hs-file-trans-app";
const CREDENTIALS_KEY: &str = "hubspot_credentials";

#[derive(Debug, Serialize, Deserialize)]
pub struct StoredCredentials {
    pub token: String,
    pub portal_id: Option<u32>,
    pub ui_domain: Option<String>,
}

pub struct SecureStorage;

impl SecureStorage {


    pub fn store_credentials(credentials: &StoredCredentials) -> Result<()> {
        log::debug!("Storing credentials: token_len={}, portal_id={:?}", credentials.token.len(), credentials.portal_id);
        let entry = Entry::new(SERVICE_NAME, CREDENTIALS_KEY)?;
        let json_data = serde_json::to_string(credentials)
            .map_err(|e| anyhow!("Failed to serialize credentials: {}", e))?;
        entry.set_password(&json_data)?;
        log::debug!("Credentials stored successfully");
        Ok(())
    }

    pub fn get_credentials() -> Result<StoredCredentials> {
        log::debug!("Retrieving credentials from keychain: service={}, account={}", SERVICE_NAME, CREDENTIALS_KEY);
        let entry = Entry::new(SERVICE_NAME, CREDENTIALS_KEY)?;
        let json_data = entry.get_password().map_err(|e| anyhow!("Credentials not found: {}", e))?;
        let credentials = serde_json::from_str(&json_data)
            .map_err(|e| anyhow!("Failed to deserialize credentials: {}", e))?;
        log::debug!("Credentials retrieved successfully");
        Ok(credentials)
    }

    pub fn clear_credentials() -> Result<()> {
        if let Ok(entry) = Entry::new(SERVICE_NAME, CREDENTIALS_KEY) {
            let _ = entry.delete_credential();
        }
        Ok(())
    }
}