import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@/lib/desk/tauri-fs";

export interface McpStatus {
  available: boolean;
  transport: string;
  command: string;
  args: string[];
  server_name: string;
  tools: string[];
  claude_config_snippet: string;
  codex_config_snippet: string;
  gemini_config_snippet: string;
  shared_config_path: string;
  data_root: string;
}

export interface McpSelfTestResult {
  ok: boolean;
  command: string;
  output: string;
}

export async function getMcpStatus(): Promise<McpStatus> {
  if (!isTauri()) {
    return {
      available: false,
      transport: "stdio",
      command: "desk-mcp",
      args: [],
      server_name: "desk-mcp",
      tools: [],
      claude_config_snippet: "",
      codex_config_snippet: "",
      gemini_config_snippet: "",
      shared_config_path: "",
      data_root: "",
    };
  }
  return invoke<McpStatus>("mcp_status");
}

export async function runMcpSelfTest(): Promise<McpSelfTestResult> {
  return invoke<McpSelfTestResult>("mcp_self_test");
}
