use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatRequest {
    pub prompt: String,
    pub system_prompt: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatResponse {
    pub message: String,
    pub usage: Option<TokenUsage>,
    pub cost_usd: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenUsage {
    pub input_tokens: u32,
    pub output_tokens: u32,
    pub total_tokens: u32,
    pub cache_creation_input_tokens: Option<u32>,
    pub cache_read_input_tokens: Option<u32>,
}

/// Claude CLI JSON response structure
#[derive(Debug, Deserialize)]
struct ClaudeJsonResponse {
    result: String,
    is_error: bool,
    #[serde(default)]
    usage: Option<ClaudeUsage>,
    #[serde(default)]
    total_cost_usd: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct ClaudeUsage {
    input_tokens: Option<u32>,
    output_tokens: Option<u32>,
    cache_creation_input_tokens: Option<u32>,
    cache_read_input_tokens: Option<u32>,
}

/// Invoke Claude Code CLI in print mode with JSON output for usage tracking
#[tauri::command]
pub async fn claude_chat(request: ChatRequest) -> Result<ChatResponse, String> {
    let mut cmd = Command::new("claude");

    // Use print mode for non-interactive output
    cmd.arg("-p");

    // Use JSON output format to get usage data
    cmd.arg("--output-format").arg("json");

    // Add system prompt if provided
    if let Some(system) = &request.system_prompt {
        cmd.arg("--system-prompt").arg(system);
    }

    // Add the user prompt
    cmd.arg(&request.prompt);

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to run claude CLI: {}. Is Claude Code installed?", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Claude CLI error: {}", stderr));
    }

    let stdout = String::from_utf8(output.stdout)
        .map_err(|e| format!("Invalid UTF-8 in response: {}", e))?;

    // Parse JSON response
    let json_response: ClaudeJsonResponse = serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse Claude response: {}. Raw: {}", e, stdout))?;

    if json_response.is_error {
        return Err(format!("Claude returned error: {}", json_response.result));
    }

    // Extract usage data
    let usage = json_response.usage.map(|u| {
        let input = u.input_tokens.unwrap_or(0);
        let output = u.output_tokens.unwrap_or(0);
        TokenUsage {
            input_tokens: input,
            output_tokens: output,
            total_tokens: input + output,
            cache_creation_input_tokens: u.cache_creation_input_tokens,
            cache_read_input_tokens: u.cache_read_input_tokens,
        }
    });

    Ok(ChatResponse {
        message: json_response.result,
        usage,
        cost_usd: json_response.total_cost_usd,
    })
}

/// Check if Claude Code CLI is available
#[tauri::command]
pub async fn claude_check() -> Result<bool, String> {
    let output = Command::new("claude").arg("--version").output();

    Ok(output.is_ok() && output.unwrap().status.success())
}
