use keyring::{Entry, Error};
use serde::{Deserialize, Serialize};

const ACCOUNT: &str = "Desk";

#[derive(Debug, Serialize, Deserialize)]
pub struct SecretGetResponse {
    pub value: Option<String>,
}

/// Open the OS credential-store entry for a given service.
///
/// `keyring` resolves to the platform-native store: the Keychain on macOS, the
/// Credential Manager on Windows, and the Secret Service (GNOME Keyring /
/// KWallet) on Linux.
fn entry(service: &str) -> Result<Entry, String> {
    Entry::new(service, ACCOUNT).map_err(|e| format!("Failed to open credential store: {}", e))
}

#[tauri::command]
pub async fn secret_get(service: String) -> Result<SecretGetResponse, String> {
    match entry(&service)?.get_password() {
        Ok(value) => {
            let value = value.trim().to_string();
            if value.is_empty() {
                Ok(SecretGetResponse { value: None })
            } else {
                Ok(SecretGetResponse { value: Some(value) })
            }
        }
        Err(Error::NoEntry) => Ok(SecretGetResponse { value: None }),
        Err(e) => Err(format!("Failed to get secret: {}", e)),
    }
}

#[tauri::command]
pub async fn secret_set(service: String, value: String) -> Result<(), String> {
    entry(&service)?
        .set_password(&value)
        .map_err(|e| format!("Failed to set secret: {}", e))
}

#[tauri::command]
pub async fn secret_delete(service: String) -> Result<(), String> {
    match entry(&service)?.delete_credential() {
        Ok(()) => Ok(()),
        // Treat a missing key as success.
        Err(Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("Failed to delete secret: {}", e)),
    }
}
