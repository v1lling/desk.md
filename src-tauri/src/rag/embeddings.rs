use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;
use std::time::Duration;

/// HTTP client timeout for embedding requests
const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);

/// Maximum texts per batch request (OpenAI limit is 2048, Voyage is 128)
/// We use a conservative limit that works for both
const MAX_BATCH_SIZE: usize = 100;

/// Shared HTTP client for connection pooling
static HTTP_CLIENT: OnceLock<Client> = OnceLock::new();

/// Get or create shared HTTP client with timeout
fn get_client() -> &'static Client {
    HTTP_CLIENT.get_or_init(|| {
        Client::builder()
            .timeout(REQUEST_TIMEOUT)
            .pool_max_idle_per_host(5)
            .build()
            .unwrap_or_else(|_| Client::new())
    })
}

/// Ollama embedding response
#[derive(Debug, Deserialize)]
struct OllamaEmbeddingResponse {
    embedding: Vec<f32>,
}

/// OpenAI embedding response
#[derive(Debug, Deserialize)]
struct OpenAIEmbeddingResponse {
    data: Vec<OpenAIEmbeddingData>,
}

#[derive(Debug, Deserialize)]
struct OpenAIEmbeddingData {
    embedding: Vec<f32>,
}

/// Voyage embedding response
#[derive(Debug, Deserialize)]
struct VoyageEmbeddingResponse {
    data: Vec<VoyageEmbeddingData>,
}

#[derive(Debug, Deserialize)]
struct VoyageEmbeddingData {
    embedding: Vec<f32>,
}

/// Embed text using Ollama (local) - 384 dimensions with nomic-embed-text
pub async fn embed_ollama(
    text: &str,
    url: &str,
    model: &str,
) -> Result<Vec<f32>, String> {
    let client = get_client();

    #[derive(Serialize)]
    struct OllamaRequest<'a> {
        model: &'a str,
        prompt: &'a str,
    }

    let response = client
        .post(format!("{}/api/embeddings", url))
        .json(&OllamaRequest { model, prompt: text })
        .send()
        .await
        .map_err(|e| format!("Ollama request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Ollama error {}: {}", status, body));
    }

    let result: OllamaEmbeddingResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;

    Ok(result.embedding)
}

/// Embed text using OpenAI API - 1536 dimensions with text-embedding-3-small
pub async fn embed_openai(
    text: &str,
    api_key: &str,
) -> Result<Vec<f32>, String> {
    let client = get_client();

    #[derive(Serialize)]
    struct OpenAIRequest<'a> {
        model: &'a str,
        input: &'a str,
    }

    let response = client
        .post("https://api.openai.com/v1/embeddings")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&OpenAIRequest {
            model: "text-embedding-3-small",
            input: text,
        })
        .send()
        .await
        .map_err(|e| format!("OpenAI request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("OpenAI error {}: {}", status, body));
    }

    let result: OpenAIEmbeddingResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse OpenAI response: {}", e))?;

    result
        .data
        .into_iter()
        .next()
        .map(|d| d.embedding)
        .ok_or_else(|| "No embedding in OpenAI response".to_string())
}

/// Embed text using Voyage API - 1024 dimensions with voyage-3.5-lite
pub async fn embed_voyage(
    text: &str,
    api_key: &str,
) -> Result<Vec<f32>, String> {
    let client = get_client();

    #[derive(Serialize)]
    struct VoyageRequest<'a> {
        model: &'a str,
        input: &'a str,
    }

    let response = client
        .post("https://api.voyageai.com/v1/embeddings")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&VoyageRequest {
            model: "voyage-3.5-lite",
            input: text,
        })
        .send()
        .await
        .map_err(|e| format!("Voyage request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Voyage error {}: {}", status, body));
    }

    let result: VoyageEmbeddingResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Voyage response: {}", e))?;

    result
        .data
        .into_iter()
        .next()
        .map(|d| d.embedding)
        .ok_or_else(|| "No embedding in Voyage response".to_string())
}

/// Batch embed texts using OpenAI API (more efficient than individual calls)
pub async fn embed_openai_batch(
    texts: &[&str],
    api_key: &str,
) -> Result<Vec<Vec<f32>>, String> {
    if texts.is_empty() {
        return Ok(vec![]);
    }

    let client = get_client();

    #[derive(Serialize)]
    struct OpenAIBatchRequest<'a> {
        model: &'a str,
        input: &'a [&'a str],
    }

    let response = client
        .post("https://api.openai.com/v1/embeddings")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&OpenAIBatchRequest {
            model: "text-embedding-3-small",
            input: texts,
        })
        .send()
        .await
        .map_err(|e| format!("OpenAI batch request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("OpenAI error {}: {}", status, body));
    }

    let result: OpenAIEmbeddingResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse OpenAI batch response: {}", e))?;

    // OpenAI returns embeddings in order, extract them
    Ok(result.data.into_iter().map(|d| d.embedding).collect())
}

/// Batch embed texts using Voyage API (more efficient than individual calls)
pub async fn embed_voyage_batch(
    texts: &[&str],
    api_key: &str,
) -> Result<Vec<Vec<f32>>, String> {
    if texts.is_empty() {
        return Ok(vec![]);
    }

    let client = get_client();

    #[derive(Serialize)]
    struct VoyageBatchRequest<'a> {
        model: &'a str,
        input: &'a [&'a str],
    }

    let response = client
        .post("https://api.voyageai.com/v1/embeddings")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&VoyageBatchRequest {
            model: "voyage-3.5-lite",
            input: texts,
        })
        .send()
        .await
        .map_err(|e| format!("Voyage batch request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Voyage error {}: {}", status, body));
    }

    let result: VoyageEmbeddingResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Voyage batch response: {}", e))?;

    // Voyage returns embeddings in order, extract them
    Ok(result.data.into_iter().map(|d| d.embedding).collect())
}

/// Embed text using the configured provider
pub async fn embed(
    text: &str,
    provider: &str,
    ollama_url: &str,
    ollama_model: &str,
    openai_api_key: Option<&str>,
    voyage_api_key: Option<&str>,
) -> Result<Vec<f32>, String> {
    match provider {
        "ollama" => embed_ollama(text, ollama_url, ollama_model).await,
        "openai" => {
            let key = openai_api_key.ok_or("OpenAI API key not configured")?;
            embed_openai(text, key).await
        }
        "voyage" => {
            let key = voyage_api_key.ok_or("Voyage API key not configured")?;
            embed_voyage(text, key).await
        }
        "auto" => {
            // Try Ollama first, fall back to cloud providers
            let ollama_err = match embed_ollama(text, ollama_url, ollama_model).await {
                Ok(embedding) => return Ok(embedding),
                Err(e) => e,
            };

            // Try OpenAI if configured
            if let Some(key) = openai_api_key {
                if !key.is_empty() {
                    return embed_openai(text, key).await;
                }
            }
            // Try Voyage if configured
            if let Some(key) = voyage_api_key {
                if !key.is_empty() {
                    return embed_voyage(text, key).await;
                }
            }

            // All providers failed - build detailed error
            let mut reasons = Vec::new();
            reasons.push(format!("Ollama ({}): {}", ollama_model, ollama_err));
            if openai_api_key.map(|k| k.is_empty()).unwrap_or(true) {
                reasons.push("OpenAI: no API key configured".to_string());
            }
            if voyage_api_key.map(|k| k.is_empty()).unwrap_or(true) {
                reasons.push("Voyage: no API key configured".to_string());
            }

            Err(format!(
                "No embedding provider available. Tried:\n  - {}",
                reasons.join("\n  - ")
            ))
        }
        _ => Err(format!("Unknown embedding provider: {}", provider)),
    }
}

/// Batch embed multiple texts (more efficient for indexing)
/// Uses native batch APIs for OpenAI/Voyage, falls back to sequential for Ollama
pub async fn embed_batch(
    texts: &[String],
    provider: &str,
    ollama_url: &str,
    ollama_model: &str,
    openai_api_key: Option<&str>,
    voyage_api_key: Option<&str>,
) -> Result<Vec<Vec<f32>>, String> {
    if texts.is_empty() {
        return Ok(vec![]);
    }

    match provider {
        "openai" => {
            let key = openai_api_key.ok_or("OpenAI API key not configured")?;
            let mut all_embeddings = Vec::with_capacity(texts.len());

            // Process in batches to respect API limits
            for chunk in texts.chunks(MAX_BATCH_SIZE) {
                let text_refs: Vec<&str> = chunk.iter().map(|s| s.as_str()).collect();
                let batch_embeddings = embed_openai_batch(&text_refs, key).await?;
                all_embeddings.extend(batch_embeddings);
            }
            Ok(all_embeddings)
        }
        "voyage" => {
            let key = voyage_api_key.ok_or("Voyage API key not configured")?;
            let mut all_embeddings = Vec::with_capacity(texts.len());

            // Process in batches to respect API limits
            for chunk in texts.chunks(MAX_BATCH_SIZE) {
                let text_refs: Vec<&str> = chunk.iter().map(|s| s.as_str()).collect();
                let batch_embeddings = embed_voyage_batch(&text_refs, key).await?;
                all_embeddings.extend(batch_embeddings);
            }
            Ok(all_embeddings)
        }
        // Ollama doesn't support batch embedding, fall back to sequential
        _ => {
            let mut embeddings = Vec::with_capacity(texts.len());
            for text in texts {
                let embedding = embed(
                    text,
                    provider,
                    ollama_url,
                    ollama_model,
                    openai_api_key,
                    voyage_api_key,
                )
                .await?;
                embeddings.push(embedding);
            }
            Ok(embeddings)
        }
    }
}
