use serde::{Deserialize, Serialize};
use std::process::Command;
use std::path::PathBuf;

/// Result of finding Claude CLI - includes path and optional bin directory for PATH
struct ClaudeBinaryInfo {
    path: PathBuf,
    bin_dir: Option<PathBuf>, // Directory to add to PATH (needed for nvm/node)
}

/// Find the Claude CLI binary path
/// Tries common installation locations since bundled apps don't have shell PATH
fn find_claude_binary() -> Option<ClaudeBinaryInfo> {
    let home = std::env::var("HOME").ok()?;

    // Check nvm paths first (most common for npm-installed Claude)
    let nvm_base = format!("{}/.nvm/versions/node", home);
    if let Ok(entries) = std::fs::read_dir(&nvm_base) {
        for entry in entries.flatten() {
            let bin_dir = entry.path().join("bin");
            let claude_path = bin_dir.join("claude");
            if claude_path.exists() {
                return Some(ClaudeBinaryInfo {
                    path: claude_path,
                    bin_dir: Some(bin_dir), // Include bin dir so node is in PATH
                });
            }
        }
    }

    // Other common locations (don't need special PATH handling)
    let candidates = [
        format!("{}/.claude/local/claude", home),
        "/opt/homebrew/bin/claude".to_string(),
        "/usr/local/bin/claude".to_string(),
        format!("{}/.npm/bin/claude", home),
    ];

    for path in candidates {
        let p = PathBuf::from(&path);
        if p.exists() {
            return Some(ClaudeBinaryInfo {
                path: p,
                bin_dir: None,
            });
        }
    }

    // Fallback: try PATH (works in dev mode)
    if let Ok(output) = Command::new("which").arg("claude").output() {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() {
                return Some(ClaudeBinaryInfo {
                    path: PathBuf::from(path),
                    bin_dir: None,
                });
            }
        }
    }

    None
}

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
    let claude_info = find_claude_binary()
        .ok_or_else(|| "Claude Code CLI not found. Please install it from https://claude.ai/code".to_string())?;

    let mut cmd = Command::new(&claude_info.path);

    // If we have a bin_dir (e.g., from nvm), add it to PATH so node can be found
    if let Some(bin_dir) = &claude_info.bin_dir {
        let current_path = std::env::var("PATH").unwrap_or_default();
        let new_path = format!("{}:{}", bin_dir.display(), current_path);
        cmd.env("PATH", new_path);
    }

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

/// Detailed status of Claude Code CLI
#[derive(Debug, Serialize, Deserialize)]
pub struct ClaudeStatus {
    pub available: bool,
    pub path: Option<String>,
    pub error: Option<String>,
}

/// Check if Claude Code CLI is available with detailed status
#[tauri::command]
pub async fn claude_check() -> Result<ClaudeStatus, String> {
    match find_claude_binary() {
        Some(info) => {
            // Test that we can actually run it (checks node availability too)
            let mut cmd = Command::new(&info.path);
            cmd.arg("--version");

            if let Some(bin_dir) = &info.bin_dir {
                let current_path = std::env::var("PATH").unwrap_or_default();
                cmd.env("PATH", format!("{}:{}", bin_dir.display(), current_path));
            }

            match cmd.output() {
                Ok(output) if output.status.success() => {
                    Ok(ClaudeStatus {
                        available: true,
                        path: Some(info.path.display().to_string()),
                        error: None,
                    })
                }
                Ok(output) => {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    Ok(ClaudeStatus {
                        available: false,
                        path: Some(info.path.display().to_string()),
                        error: Some(format!("CLI found but failed to run: {}", stderr.trim())),
                    })
                }
                Err(e) => {
                    Ok(ClaudeStatus {
                        available: false,
                        path: Some(info.path.display().to_string()),
                        error: Some(format!("CLI found but cannot execute: {}", e)),
                    })
                }
            }
        }
        None => {
            Ok(ClaudeStatus {
                available: false,
                path: None,
                error: Some("Claude Code CLI not found. Install from https://claude.ai/code".to_string()),
            })
        }
    }
}
