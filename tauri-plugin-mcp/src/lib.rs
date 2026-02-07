// Stub: real plugin lives outside the repo.
// This satisfies Cargo resolution when the `mcp` feature is not enabled.
// For local dev with MCP, replace this directory with a symlink to the real plugin.

pub struct PluginConfig;

impl PluginConfig {
    pub fn new(_name: String) -> Self { Self }
    pub fn start_socket_server(self, _: bool) -> Self { self }
    pub fn socket_path(self, _: std::path::PathBuf) -> Self { self }
}

pub fn init_with_config(_config: PluginConfig) -> impl tauri::plugin::Plugin<tauri::Wry> {
    tauri::plugin::Builder::new("mcp").build()
}
