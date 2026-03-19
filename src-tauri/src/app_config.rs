use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

const APP_DIR_NAME: &str = "Desk";
const CONFIG_FILE_NAME: &str = "config.json";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct SharedConfig {
    pub version: u32,
    pub data_path: String,
}

pub fn config_file_path() -> Result<PathBuf, String> {
    let base = platform_config_dir()?;
    Ok(base.join(APP_DIR_NAME).join(CONFIG_FILE_NAME))
}

pub fn read_shared_config() -> Result<SharedConfig, String> {
    let path = config_file_path()?;
    if !path.exists() {
        return Ok(SharedConfig::default());
    }

    let raw = fs::read_to_string(&path).map_err(|err| {
        format!(
            "Failed to read shared config at {}: {}",
            path.display(),
            err
        )
    })?;
    serde_json::from_str(&raw).map_err(|err| {
        format!(
            "Failed to parse shared config at {}: {}",
            path.display(),
            err
        )
    })
}

pub fn write_shared_config(config: &SharedConfig) -> Result<(), String> {
    let path = config_file_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| {
            format!(
                "Failed to create shared config directory {}: {}",
                parent.display(),
                err
            )
        })?;
    }

    let payload = serde_json::to_string_pretty(config)
        .map_err(|err| format!("Failed to serialize shared config: {}", err))?;
    fs::write(&path, payload).map_err(|err| {
        format!(
            "Failed to write shared config at {}: {}",
            path.display(),
            err
        )
    })
}

pub fn store_data_path(data_path: &str) -> Result<(), String> {
    let mut config = read_shared_config()?;
    config.version = 1;
    config.data_path = data_path.to_string();
    write_shared_config(&config)
}

fn platform_config_dir() -> Result<PathBuf, String> {
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME")
            .map_err(|_| "Unable to resolve HOME for config directory".to_string())?;
        return Ok(PathBuf::from(home)
            .join("Library")
            .join("Application Support"));
    }

    #[cfg(target_os = "linux")]
    {
        if let Ok(xdg) = std::env::var("XDG_CONFIG_HOME") {
            if !xdg.trim().is_empty() {
                return Ok(PathBuf::from(xdg));
            }
        }
        let home = std::env::var("HOME")
            .map_err(|_| "Unable to resolve HOME for config directory".to_string())?;
        return Ok(PathBuf::from(home).join(".config"));
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(app_data) = std::env::var("APPDATA") {
            if !app_data.trim().is_empty() {
                return Ok(PathBuf::from(app_data));
            }
        }
        return Err("Unable to resolve APPDATA for config directory".to_string());
    }

    #[allow(unreachable_code)]
    Err("Unsupported platform for shared config directory".to_string())
}
