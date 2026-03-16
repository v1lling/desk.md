use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{Emitter, Manager, WindowEvent};
use tauri_plugin_fs::FsExt;

pub mod app_config;
mod mcp;
pub mod mcp_core;
mod secrets;

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

/// Reveal a file or folder in the system file manager (Finder on macOS, Explorer on Windows)
#[tauri::command]
fn reveal_in_finder(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .args(["-R", &path])
            .spawn()
            .map_err(|e| format!("Failed to reveal in Finder: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .args(["/select,", &path])
            .spawn()
            .map_err(|e| format!("Failed to reveal in Explorer: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        // On Linux, we can only open the parent directory
        let parent = std::path::Path::new(&path)
            .parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or(path);
        Command::new("xdg-open")
            .arg(&parent)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    Ok(())
}

/// Open a terminal at a specific directory
#[tauri::command]
fn open_in_terminal(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .args(["-a", "Terminal", &path])
            .spawn()
            .map_err(|e| format!("Failed to open terminal: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "cmd", "/K", &format!("cd /d {}", path)])
            .spawn()
            .map_err(|e| format!("Failed to open terminal: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("x-terminal-emulator")
            .args(["--working-directory", &path])
            .spawn()
            .map_err(|e| format!("Failed to open terminal: {}", e))?;
    }

    Ok(())
}

/// Dynamically expand the file system scope to allow access to a directory.
/// Called by the frontend on startup with the user's configured data path.
#[tauri::command]
fn expand_fs_scope(app_handle: tauri::AppHandle, path: String) -> Result<(), String> {
    let p = std::path::PathBuf::from(&path);
    mcp_core::set_data_root(p.clone());
    app_config::store_data_path(&path)?;
    app_handle
        .fs_scope()
        .allow_directory(&p, true)
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            confirm_close,
            expand_fs_scope,
            open_file_with_default_app,
            reveal_in_finder,
            open_in_terminal,
            mcp::mcp_status,
            mcp::mcp_self_test,
            mcp::desk_list,
            mcp::desk_read,
            mcp::desk_search,
            mcp::desk_index_search,
            mcp::desk_workspace_info,
            mcp::desk_create_task,
            mcp::desk_update_task,
            mcp::desk_create_meeting,
            mcp::desk_update_meeting,
            mcp::desk_create_doc,
            mcp::desk_update_doc,
            secrets::secret_get,
            secrets::secret_set,
            secrets::secret_delete,
        ]);

    builder
        .setup(|app| {
            let initial_root = mcp_core::resolve_data_root(None);
            mcp_core::set_data_root(initial_root);

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Create custom menu with Save item that forwards to frontend
            let save_item = MenuItem::with_id(app, "save", "Save", true, Some("CmdOrCtrl+S"))?;

            let file_menu = Submenu::with_items(app, "File", true, &[&save_item])?;

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
                window
                    .emit("window-close-requested", ())
                    .unwrap_or_else(|e| {
                        log::error!("Failed to emit close-check event: {}", e);
                    });
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
