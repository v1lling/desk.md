pub mod db;

use serde::{Deserialize, Serialize};
use std::path::Path;

// Re-export types
pub use db::IndexStatus;

/// Chunk input from frontend
#[derive(Debug, Serialize, Deserialize)]
pub struct ChunkInput {
    pub doc_path: String,
    pub workspace_id: String,
    pub content_type: String,
    pub title: String,
    pub content: String,
    pub content_hash: String,
    pub chunk_index: u32,
    pub total_chunks: u32,
}

/// Search result returned to frontend
#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub doc_path: String,
    pub workspace_id: String,
    pub content_type: String,
    pub title: String,
    pub content: String,
    pub chunk_index: u32,
    pub score: f32,
}

/// Embedding provider settings from frontend
#[derive(Debug, Serialize, Deserialize)]
pub struct EmbeddingSettings {
    pub provider: String,
    pub ollama_url: String,
    pub ollama_model: String,
    pub openai_api_key: Option<String>,
    pub voyage_api_key: Option<String>,
}

/// Initialize the RAG database
#[tauri::command]
pub async fn rag_init_db(data_path: String, provider: String) -> Result<(), String> {
    let conn = db::open_db(&data_path).map_err(|e| format!("Failed to open database: {}", e))?;
    db::init_schema(&conn, &provider).map_err(|e| format!("Failed to init schema: {}", e))?;
    Ok(())
}

/// Get index status
#[tauri::command]
pub async fn rag_get_status(data_path: String) -> Result<IndexStatus, String> {
    let index_dir = Path::new(&data_path).join(".index");
    let db_path = index_dir.join("vectors.db");

    // If database doesn't exist, return empty status
    if !db_path.exists() {
        return Ok(IndexStatus {
            document_count: 0,
            chunk_count: 0,
            last_indexed_at: None,
            index_size_bytes: 0,
            indexed_with_provider: None,
            indexed_with_model: None,
            dimensions: None,
        });
    }

    let conn = db::open_db(&data_path).map_err(|e| format!("Failed to open database: {}", e))?;
    db::get_status(&conn, &db_path).map_err(|e| format!("Failed to get status: {}", e))
}

/// Clear the entire index
#[tauri::command]
pub async fn rag_clear_index(data_path: String) -> Result<(), String> {
    let conn = db::open_db(&data_path).map_err(|e| format!("Failed to open database: {}", e))?;
    db::clear_index(&conn).map_err(|e| format!("Failed to clear index: {}", e))
}

/// Delete a single document from the index
#[tauri::command]
pub async fn rag_delete_doc(data_path: String, doc_path: String) -> Result<(), String> {
    let conn = db::open_db(&data_path).map_err(|e| format!("Failed to open database: {}", e))?;
    db::delete_doc(&conn, &doc_path).map_err(|e| format!("Failed to delete doc: {}", e))
}

/// Check if Ollama is available
#[tauri::command]
pub async fn rag_check_ollama(url: String) -> Result<bool, String> {
    let client = reqwest::Client::new();
    match client.get(format!("{}/api/tags", url)).send().await {
        Ok(response) => Ok(response.status().is_success()),
        Err(_) => Ok(false),
    }
}
