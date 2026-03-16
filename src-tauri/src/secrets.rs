use serde::{Deserialize, Serialize};
use std::process::Command;

const ACCOUNT: &str = "Desk";

#[derive(Debug, Serialize, Deserialize)]
pub struct SecretGetResponse {
    pub value: Option<String>,
}

#[cfg(target_os = "macos")]
fn run_security(args: &[&str]) -> Result<std::process::Output, String> {
    Command::new("security")
        .args(args)
        .output()
        .map_err(|e| format!("Failed to run security command: {}", e))
}

#[tauri::command]
pub async fn secret_get(service: String) -> Result<SecretGetResponse, String> {
    #[cfg(target_os = "macos")]
    {
        let output = run_security(&["find-generic-password", "-a", ACCOUNT, "-s", &service, "-w"])?;

        if output.status.success() {
            let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if value.is_empty() {
                return Ok(SecretGetResponse { value: None });
            }
            return Ok(SecretGetResponse { value: Some(value) });
        }

        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        if stderr.contains("could not be found")
            || stderr.contains("The specified item could not be found")
        {
            return Ok(SecretGetResponse { value: None });
        }

        return Err(format!("Failed to get secret: {}", stderr.trim()));
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = service;
        Err("Keychain integration is currently implemented for macOS only".to_string())
    }
}

#[tauri::command]
pub async fn secret_set(service: String, value: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let output = run_security(&[
            "add-generic-password",
            "-a",
            ACCOUNT,
            "-s",
            &service,
            "-w",
            &value,
            "-U",
        ])?;

        if output.status.success() {
            return Ok(());
        }

        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(format!("Failed to set secret: {}", stderr.trim()));
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = (service, value);
        Err("Keychain integration is currently implemented for macOS only".to_string())
    }
}

#[tauri::command]
pub async fn secret_delete(service: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let output = run_security(&["delete-generic-password", "-a", ACCOUNT, "-s", &service])?;

        if output.status.success() {
            return Ok(());
        }

        // Treat missing key as success.
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        if stderr.contains("could not be found")
            || stderr.contains("The specified item could not be found")
        {
            return Ok(());
        }

        Err(format!("Failed to delete secret: {}", stderr.trim()))
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = service;
        Err("Keychain integration is currently implemented for macOS only".to_string())
    }
}
