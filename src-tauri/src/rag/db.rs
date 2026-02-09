use rusqlite::{ffi::sqlite3_auto_extension, params, Connection, Result as SqliteResult};
use serde::{Deserialize, Serialize};
use sqlite_vec::sqlite3_vec_init;
use std::path::Path;
use std::sync::Once;

static INIT: Once = Once::new();

/// Initialize sqlite-vec extension (call once at startup)
pub fn init_sqlite_vec() {
    INIT.call_once(|| {
        unsafe {
            sqlite3_auto_extension(Some(std::mem::transmute(sqlite3_vec_init as *const ())));
        }
    });
}

/// Provider dimensions mapping
pub fn get_provider_dimensions(provider: &str) -> u32 {
    match provider {
        "ollama" => 384,   // nomic-embed-text
        "openai" => 1536,  // text-embedding-3-small
        "voyage" => 1024,  // voyage-3.5-lite
        _ => 384,          // default to ollama
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IndexStatus {
    pub document_count: u32,
    pub chunk_count: u32,
    pub last_indexed_at: Option<String>,
    pub index_size_bytes: u64,
    pub indexed_with_provider: Option<String>,
    pub indexed_with_model: Option<String>,
    pub dimensions: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IndexMeta {
    pub provider: Option<String>,
    pub model: Option<String>,
    pub dimensions: Option<u32>,
    pub last_full_index: Option<String>,
    pub version: Option<String>,
}

/// Open or create the vector database
pub fn open_db(data_path: &str) -> SqliteResult<Connection> {
    init_sqlite_vec();

    let index_dir = Path::new(data_path).join(".desk").join("rag");
    std::fs::create_dir_all(&index_dir).map_err(|e| {
        rusqlite::Error::InvalidPath(index_dir.join(format!("create_dir failed: {}", e)))
    })?;

    let db_path = index_dir.join("vectors.db");
    Connection::open(db_path)
}

/// Initialize database schema
pub fn init_schema(conn: &Connection, provider: &str) -> SqliteResult<()> {
    let dimensions = get_provider_dimensions(provider);

    // Create index_meta table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS index_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    )?;

    // Create chunks table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS chunks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            doc_path TEXT NOT NULL,
            workspace_id TEXT NOT NULL,
            content_type TEXT NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            content_hash TEXT NOT NULL,
            chunk_index INTEGER NOT NULL,
            total_chunks INTEGER NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(doc_path, chunk_index)
        )",
        [],
    )?;

    // Create indexes
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_chunks_doc_path ON chunks(doc_path)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_chunks_workspace ON chunks(workspace_id)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_chunks_hash ON chunks(content_hash)",
        [],
    )?;

    // Check if we need to create/recreate the vector table
    let current_dims: Option<String> = conn
        .query_row(
            "SELECT value FROM index_meta WHERE key = 'dimensions'",
            [],
            |row| row.get(0),
        )
        .ok();

    let current_dims_num: Option<u32> = current_dims.and_then(|s| s.parse().ok());

    if current_dims_num != Some(dimensions) {
        // Drop existing vector table if dimensions changed
        conn.execute("DROP TABLE IF EXISTS chunk_vectors", [])?;

        // Create vector table with correct dimensions
        let create_vec_sql = format!(
            "CREATE VIRTUAL TABLE IF NOT EXISTS chunk_vectors USING vec0(
                chunk_id INTEGER PRIMARY KEY,
                embedding FLOAT[{}]
            )",
            dimensions
        );
        conn.execute(&create_vec_sql, [])?;

        // Update metadata
        conn.execute(
            "INSERT OR REPLACE INTO index_meta (key, value) VALUES ('dimensions', ?)",
            params![dimensions.to_string()],
        )?;
        conn.execute(
            "INSERT OR REPLACE INTO index_meta (key, value) VALUES ('provider', ?)",
            params![provider],
        )?;
    }

    // Set version
    conn.execute(
        "INSERT OR REPLACE INTO index_meta (key, value) VALUES ('version', '1')",
        [],
    )?;

    Ok(())
}

/// Get index metadata
pub fn get_meta(conn: &Connection) -> IndexMeta {
    let get_value = |key: &str| -> Option<String> {
        conn.query_row(
            "SELECT value FROM index_meta WHERE key = ?",
            params![key],
            |row| row.get(0),
        )
        .ok()
    };

    IndexMeta {
        provider: get_value("provider"),
        model: get_value("model"),
        dimensions: get_value("dimensions").and_then(|s| s.parse().ok()),
        last_full_index: get_value("last_full_index"),
        version: get_value("version"),
    }
}

/// Get index status
pub fn get_status(conn: &Connection, db_path: &Path) -> SqliteResult<IndexStatus> {
    let document_count: u32 = conn
        .query_row(
            "SELECT COUNT(DISTINCT doc_path) FROM chunks",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let chunk_count: u32 = conn
        .query_row("SELECT COUNT(*) FROM chunks", [], |row| row.get(0))
        .unwrap_or(0);

    let meta = get_meta(conn);

    let index_size_bytes = std::fs::metadata(db_path)
        .map(|m| m.len())
        .unwrap_or(0);

    Ok(IndexStatus {
        document_count,
        chunk_count,
        last_indexed_at: meta.last_full_index,
        index_size_bytes,
        indexed_with_provider: meta.provider,
        indexed_with_model: meta.model,
        dimensions: meta.dimensions,
    })
}

/// Clear all indexed data
pub fn clear_index(conn: &Connection) -> SqliteResult<()> {
    conn.execute("DELETE FROM chunks", [])?;
    conn.execute("DELETE FROM chunk_vectors", [])?;
    conn.execute("DELETE FROM index_meta WHERE key = 'last_full_index'", [])?;
    Ok(())
}

/// Delete chunks for a specific document
pub fn delete_doc(conn: &Connection, doc_path: &str) -> SqliteResult<()> {
    // First get the chunk IDs
    let mut stmt = conn.prepare("SELECT id FROM chunks WHERE doc_path = ?")?;
    let chunk_ids: Vec<i64> = stmt
        .query_map(params![doc_path], |row| row.get(0))?
        .filter_map(|r| r.ok())
        .collect();
    drop(stmt); // Explicitly drop to release the borrow

    // Delete from vector table
    for chunk_id in &chunk_ids {
        conn.execute(
            "DELETE FROM chunk_vectors WHERE chunk_id = ?",
            params![chunk_id],
        )?;
    }

    // Delete from chunks table
    conn.execute("DELETE FROM chunks WHERE doc_path = ?", params![doc_path])?;

    Ok(())
}

/// Check if a document needs re-indexing based on content hash
pub fn needs_reindex(conn: &Connection, doc_path: &str, content_hash: &str) -> SqliteResult<bool> {
    let existing_hash: Option<String> = conn
        .query_row(
            "SELECT content_hash FROM chunks WHERE doc_path = ? LIMIT 1",
            params![doc_path],
            |row| row.get(0),
        )
        .ok();

    Ok(existing_hash.as_deref() != Some(content_hash))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_open_and_init() {
        let temp_dir = std::env::temp_dir().join("rag_test");
        std::fs::create_dir_all(&temp_dir).unwrap();

        let conn = open_db(temp_dir.to_str().unwrap()).unwrap();
        init_schema(&conn, "ollama").unwrap();

        let meta = get_meta(&conn);
        assert_eq!(meta.provider, Some("ollama".to_string()));
        assert_eq!(meta.dimensions, Some(384));

        std::fs::remove_dir_all(&temp_dir).ok();
    }
}
