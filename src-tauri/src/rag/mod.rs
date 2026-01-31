pub mod db;
pub mod embeddings;

use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::path::Path;
use zerocopy::IntoBytes;

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

/// Result of indexing operation
#[derive(Debug, Serialize, Deserialize)]
pub struct IndexResult {
    pub indexed_count: u32,
    pub skipped_count: u32,
    pub error_count: u32,
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

/// Index chunks with embeddings
#[tauri::command]
pub async fn rag_index_chunks(
    data_path: String,
    chunks: Vec<ChunkInput>,
    settings: EmbeddingSettings,
) -> Result<IndexResult, String> {
    if chunks.is_empty() {
        return Ok(IndexResult {
            indexed_count: 0,
            skipped_count: 0,
            error_count: 0,
        });
    }

    // Determine actual provider (resolve "auto")
    let actual_provider = if settings.provider == "auto" {
        // Check if Ollama is available
        let client = reqwest::Client::new();
        let ollama_ok = client
            .get(format!("{}/api/tags", settings.ollama_url))
            .send()
            .await
            .map(|r| r.status().is_success())
            .unwrap_or(false);

        if ollama_ok {
            "ollama"
        } else if settings.openai_api_key.as_ref().map(|k| !k.is_empty()).unwrap_or(false) {
            "openai"
        } else if settings.voyage_api_key.as_ref().map(|k| !k.is_empty()).unwrap_or(false) {
            "voyage"
        } else {
            return Err("No embedding provider available".to_string());
        }
    } else {
        &settings.provider
    };

    // Open database and ensure schema
    let conn = db::open_db(&data_path).map_err(|e| format!("Failed to open database: {}", e))?;
    db::init_schema(&conn, actual_provider)
        .map_err(|e| format!("Failed to init schema: {}", e))?;

    let mut indexed_count = 0u32;
    let mut skipped_count = 0u32;
    let mut error_count = 0u32;

    // Process each chunk
    for chunk in chunks {
        // Check if chunk already exists with same hash
        let needs_update = db::needs_reindex(&conn, &chunk.doc_path, &chunk.content_hash)
            .unwrap_or(true);

        if !needs_update && chunk.chunk_index == 0 {
            // Document hasn't changed, skip all its chunks
            skipped_count += chunk.total_chunks;
            continue;
        }

        // Generate embedding
        let embedding_result = embeddings::embed(
            &chunk.content,
            actual_provider,
            &settings.ollama_url,
            &settings.ollama_model,
            settings.openai_api_key.as_deref(),
            settings.voyage_api_key.as_deref(),
        )
        .await;

        let embedding = match embedding_result {
            Ok(e) => e,
            Err(e) => {
                log::error!("Failed to embed chunk {}: {}", chunk.doc_path, e);
                error_count += 1;
                continue;
            }
        };

        // Delete existing chunk if updating
        if chunk.chunk_index == 0 {
            let _ = db::delete_doc(&conn, &chunk.doc_path);
        }

        // Insert chunk metadata
        let now = chrono::Utc::now().to_rfc3339();
        let insert_result = conn.execute(
            "INSERT INTO chunks (doc_path, workspace_id, content_type, title, content, content_hash, chunk_index, total_chunks, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                chunk.doc_path,
                chunk.workspace_id,
                chunk.content_type,
                chunk.title,
                chunk.content,
                chunk.content_hash,
                chunk.chunk_index,
                chunk.total_chunks,
                now,
            ],
        );

        let chunk_id = match insert_result {
            Ok(_) => conn.last_insert_rowid(),
            Err(e) => {
                log::error!("Failed to insert chunk: {}", e);
                error_count += 1;
                continue;
            }
        };

        // Insert embedding vector
        let embedding_bytes = embedding.as_bytes();
        let vector_result = conn.execute(
            "INSERT INTO chunk_vectors (chunk_id, embedding) VALUES (?1, ?2)",
            params![chunk_id, embedding_bytes],
        );

        if let Err(e) = vector_result {
            log::error!("Failed to insert vector: {}", e);
            error_count += 1;
            continue;
        }

        indexed_count += 1;
    }

    // Update last indexed timestamp
    let now = chrono::Utc::now().to_rfc3339();
    let _ = conn.execute(
        "INSERT OR REPLACE INTO index_meta (key, value) VALUES ('last_full_index', ?)",
        params![now],
    );

    Ok(IndexResult {
        indexed_count,
        skipped_count,
        error_count,
    })
}

/// Search for similar chunks
#[tauri::command]
pub async fn rag_search(
    data_path: String,
    query: String,
    limit: usize,
    settings: EmbeddingSettings,
) -> Result<Vec<SearchResult>, String> {
    let index_dir = Path::new(&data_path).join(".index");
    let db_path = index_dir.join("vectors.db");

    if !db_path.exists() {
        return Ok(vec![]);
    }

    let conn = db::open_db(&data_path).map_err(|e| format!("Failed to open database: {}", e))?;

    // Get current provider from index metadata
    let meta = db::get_meta(&conn);
    let provider = meta.provider.as_deref().unwrap_or("ollama");

    // Generate query embedding
    let query_embedding = embeddings::embed(
        &query,
        provider,
        &settings.ollama_url,
        &settings.ollama_model,
        settings.openai_api_key.as_deref(),
        settings.voyage_api_key.as_deref(),
    )
    .await?;

    // Search for similar vectors
    let query_bytes = query_embedding.as_bytes();
    let mut stmt = conn
        .prepare(
            "SELECT
                c.doc_path,
                c.workspace_id,
                c.content_type,
                c.title,
                c.content,
                c.chunk_index,
                v.distance
             FROM chunk_vectors v
             JOIN chunks c ON c.id = v.chunk_id
             WHERE v.embedding MATCH ?1
             ORDER BY v.distance
             LIMIT ?2",
        )
        .map_err(|e| format!("Failed to prepare search query: {}", e))?;

    let results: Vec<SearchResult> = stmt
        .query_map(params![query_bytes, limit as i64], |row| {
            let distance: f64 = row.get(6)?;
            // Convert distance to similarity score (0-1)
            // sqlite-vec uses L2 distance, so smaller is better
            // We normalize it to a 0-1 score where 1 is most similar
            let score = 1.0 / (1.0 + distance as f32);

            Ok(SearchResult {
                doc_path: row.get(0)?,
                workspace_id: row.get(1)?,
                content_type: row.get(2)?,
                title: row.get(3)?,
                content: row.get(4)?,
                chunk_index: row.get(5)?,
                score,
            })
        })
        .map_err(|e| format!("Search query failed: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(results)
}
