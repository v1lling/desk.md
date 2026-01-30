use log::info;
use std::process::Command;

mod ai;

/// Open a file with the system's default application
#[tauri::command]
fn open_file_with_default_app(path: String) -> Result<(), String> {
  #[cfg(target_os = "macos")]
  {
    Command::new("open")
      .arg(&path)
      .spawn()
      .map_err(|e| format!("Failed to open file: {}", e))?;
  }

  #[cfg(target_os = "windows")]
  {
    Command::new("cmd")
      .args(["/C", "start", "", &path])
      .spawn()
      .map_err(|e| format!("Failed to open file: {}", e))?;
  }

  #[cfg(target_os = "linux")]
  {
    Command::new("xdg-open")
      .arg(&path)
      .spawn()
      .map_err(|e| format!("Failed to open file: {}", e))?;
  }

  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let mut builder = tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_deep_link::init())
    .invoke_handler(tauri::generate_handler![
      ai::claude_chat,
      ai::claude_check,
      open_file_with_default_app,
    ]);

  // Add MCP plugin in debug builds only
  #[cfg(debug_assertions)]
  {
    info!("Development build detected, enabling MCP plugin");
    builder = builder.plugin(
      tauri_plugin_mcp::init_with_config(
        tauri_plugin_mcp::PluginConfig::new("Desk".to_string())
          .start_socket_server(true)
          .socket_path("/tmp/desk-mcp.sock".into())
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
