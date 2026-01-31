use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

/// HTTP client timeout for embedding requests
const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);

/// Create HTTP client with timeout
fn create_client() -> Result<Client, String> {
    Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))
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
    let client = create_client()?;

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
    let client = create_client()?;

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
    let client = create_client()?;

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
            match embed_ollama(text, ollama_url, ollama_model).await {
                Ok(embedding) => Ok(embedding),
                Err(_) => {
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
                    Err("No embedding provider available. Start Ollama or configure API keys.".to_string())
                }
            }
        }
        _ => Err(format!("Unknown embedding provider: {}", provider)),
    }
}

/// Batch embed multiple texts (more efficient for indexing)
pub async fn embed_batch(
    texts: &[String],
    provider: &str,
    ollama_url: &str,
    ollama_model: &str,
    openai_api_key: Option<&str>,
    voyage_api_key: Option<&str>,
) -> Result<Vec<Vec<f32>>, String> {
    // For now, embed one at a time
    // TODO: Implement batch API calls for OpenAI/Voyage for efficiency
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
