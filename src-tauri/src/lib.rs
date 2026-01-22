use log::info;

mod ai;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let mut builder = tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_shell::init())
    .invoke_handler(tauri::generate_handler![
      ai::claude_chat,
      ai::claude_check,
    ]);

  // Add MCP plugin in debug builds only
  #[cfg(debug_assertions)]
  {
    info!("Development build detected, enabling MCP plugin");
    builder = builder.plugin(
      tauri_plugin_mcp::init_with_config(
        tauri_plugin_mcp::PluginConfig::new("Orbit".to_string())
          .start_socket_server(true)
          .socket_path("/tmp/orbit-mcp.sock".into())
      )
    );
  }

  builder
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
