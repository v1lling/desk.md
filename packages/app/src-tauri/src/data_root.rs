//! Data-root resolution for the desk.md Tauri shell.
//!
//! Resolves and caches the user's Desk data directory (CLI override →
//! DESK_DATA_ROOT env → shared config → ~/Desk default) so the fs-scope setup
//! can contain reads/writes to it. The former desk_* read/write commands that
//! also lived here were retired: the in-app assistant now runs its tools on the
//! TypeScript domain layer (src/lib/desk), the single read+write implementation.
use crate::app_config;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

static DATA_ROOT: OnceLock<Mutex<Option<PathBuf>>> = OnceLock::new();

fn data_root_store() -> &'static Mutex<Option<PathBuf>> {
    DATA_ROOT.get_or_init(|| Mutex::new(None))
}

pub fn set_data_root(path: PathBuf) {
    if let Ok(mut root) = data_root_store().lock() {
        *root = Some(path);
    }
}

pub fn resolve_data_root(cli_override: Option<PathBuf>) -> PathBuf {
    if let Some(path) = cli_override {
        return path;
    }

    if let Ok(from_env) = std::env::var("DESK_DATA_ROOT") {
        let trimmed = from_env.trim();
        if !trimmed.is_empty() {
            return PathBuf::from(trimmed);
        }
    }

    if let Ok(config) = app_config::read_shared_config() {
        let configured = config.data_path.trim();
        if !configured.is_empty() {
            return PathBuf::from(configured);
        }
    }

    default_data_root()
}

fn default_data_root() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    Path::new(&home).join("Desk")
}

pub fn get_data_root() -> PathBuf {
    if let Ok(root) = data_root_store().lock() {
        if let Some(path) = root.clone() {
            return path;
        }
    }
    resolve_data_root(None)
}
