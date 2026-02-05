use log::info;
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{Emitter, Manager, WindowEvent};
use tauri::menu::{Menu, MenuItem, Submenu, PredefinedMenuItem};

mod ai;
mod rag;

// Flag to track if close has been confirmed by frontend
static CLOSE_CONFIRMED: AtomicBool = AtomicBool::new(false);

/// Confirm that the window can be closed (called by frontend after save/discard)
#[tauri::command]
fn confirm_close(window: tauri::Window) {
  CLOSE_CONFIRMED.store(true, Ordering::SeqCst);
  window.close().unwrap_or_else(|e| {
    log::error!("Failed to close window: {}", e);
  });
}

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
      confirm_close,
      open_file_with_default_app,
      rag::rag_init_db,
      rag::rag_get_status,
      rag::rag_clear_index,
      rag::rag_delete_doc,
      rag::rag_check_ollama,
      rag::rag_index_chunks,
      rag::rag_search,
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

      // Create custom menu with Save item that forwards to frontend
      let save_item = MenuItem::with_id(app, "save", "Save", true, Some("CmdOrCtrl+S"))?;

      let file_menu = Submenu::with_items(
        app,
        "File",
        true,
        &[&save_item],
      )?;

      let edit_menu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
          &PredefinedMenuItem::undo(app, None)?,
          &PredefinedMenuItem::redo(app, None)?,
          &PredefinedMenuItem::separator(app)?,
          &PredefinedMenuItem::cut(app, None)?,
          &PredefinedMenuItem::copy(app, None)?,
          &PredefinedMenuItem::paste(app, None)?,
          &PredefinedMenuItem::select_all(app, None)?,
        ],
      )?;

      let window_menu = Submenu::with_items(
        app,
        "Window",
        true,
        &[
          &PredefinedMenuItem::minimize(app, None)?,
          &PredefinedMenuItem::maximize(app, None)?,
          &PredefinedMenuItem::close_window(app, None)?,
          &PredefinedMenuItem::separator(app)?,
          &PredefinedMenuItem::fullscreen(app, None)?,
        ],
      )?;

      let menu = Menu::with_items(
        app,
        &[
          &Submenu::with_items(
            app,
            "Desk",
            true,
            &[
              &PredefinedMenuItem::about(app, None, None)?,
              &PredefinedMenuItem::separator(app)?,
              &PredefinedMenuItem::services(app, None)?,
              &PredefinedMenuItem::separator(app)?,
              &PredefinedMenuItem::hide(app, None)?,
              &PredefinedMenuItem::hide_others(app, None)?,
              &PredefinedMenuItem::show_all(app, None)?,
              &PredefinedMenuItem::separator(app)?,
              &PredefinedMenuItem::quit(app, None)?,
            ],
          )?,
          &file_menu,
          &edit_menu,
          &window_menu,
        ],
      )?;

      app.set_menu(menu)?;

      Ok(())
    })
    .on_menu_event(|app, event| {
      if event.id().as_ref() == "save" {
        // Forward save action to frontend
        if let Some(window) = app.get_webview_window("main") {
          window.emit("menu-save", ()).unwrap_or_else(|e| {
            log::error!("Failed to emit menu-save event: {}", e);
          });
        }
      }
    })
    .on_window_event(|window, event| {
      if let WindowEvent::CloseRequested { api, .. } = event {
        // If close was confirmed by frontend, allow it
        if CLOSE_CONFIRMED.load(Ordering::SeqCst) {
          CLOSE_CONFIRMED.store(false, Ordering::SeqCst);
          return;
        }

        // Prevent default close behavior
        api.prevent_close();

        // Emit event to frontend to check for unsaved changes
        window.emit("window-close-requested", ()).unwrap_or_else(|e| {
          log::error!("Failed to emit close-check event: {}", e);
        });
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
