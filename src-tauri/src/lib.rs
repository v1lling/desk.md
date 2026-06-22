use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{Emitter, Manager, WindowEvent};
use tauri_plugin_fs::FsExt;

pub mod app_config;
pub mod data_root;
#[cfg(target_os = "macos")]
mod drop_view;
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

/// Read a user-dropped file as text. The path comes from a Tauri drag-drop
/// event, which implies user consent — no extra fs-scope check needed.
#[tauri::command]
fn read_eml_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))
}

/// Read a user-dropped file as bytes. Paths come from a drag-drop event in the
/// native Cocoa overlay, which the OS already gated by the user's drop gesture.
/// Bypasses the fs plugin's scope so Finder-dropped files anywhere on disk work.
/// Returns `tauri::ipc::Response` so the bytes cross the IPC boundary as a
/// binary ArrayBuffer rather than a JSON number-array (matters for PDFs etc.).
#[tauri::command]
fn read_dropped_file(path: String) -> Result<tauri::ipc::Response, String> {
    std::fs::read(&path)
        .map(tauri::ipc::Response::new)
        .map_err(|e| format!("Failed to read file: {}", e))
}

/// Delete a temp file that was created from a file-promise drop, after the
/// frontend has parsed it. Paths originate from our own drop_view code under
/// `NSTemporaryDirectory()/desk-drops/`, so missing-file is non-fatal.
#[tauri::command]
fn delete_dropped_file(path: String) -> Result<(), String> {
    match std::fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.to_string()),
    }
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
            .args(["/C", "start", "cmd", "/K", &format!("cd /d \"{}\"", path)])
            .spawn()
            .map_err(|e| format!("Failed to open terminal: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        // x-terminal-emulator is a Debian alternative and isn't present on
        // every distro — try a series of common terminal emulators.
        let terminals = [
            "x-terminal-emulator",
            "gnome-terminal",
            "konsole",
            "xfce4-terminal",
            "xterm",
        ];
        let mut opened = false;
        for term in terminals {
            if Command::new(term).current_dir(&path).spawn().is_ok() {
                opened = true;
                break;
            }
        }
        if !opened {
            return Err(
                "No terminal emulator found. Install one of: gnome-terminal, konsole, xterm."
                    .to_string(),
            );
        }
    }

    Ok(())
}

/// Dynamically expand the file system scope to allow access to a directory.
/// Called by the frontend on startup with the user's configured data path.
#[tauri::command]
fn expand_fs_scope(app_handle: tauri::AppHandle, path: String) -> Result<(), String> {
    let p = std::path::PathBuf::from(&path);
    data_root::set_data_root(p.clone());
    app_config::store_data_path(&path)?;
    app_handle
        .fs_scope()
        .allow_directory(&p, true)
        .map_err(|e| e.to_string())
}

/// Canonicalize a path that may not exist yet. Walks up to the nearest existing
/// ancestor, canonicalizes it (resolving symlinks and `..`), then re-appends the
/// missing tail — rejecting any non-`Normal` tail component so `..` cannot escape.
fn lenient_canonicalize(input: &std::path::Path) -> Result<std::path::PathBuf, String> {
    use std::path::{Component, Path};

    // Fast path: the whole path already exists.
    if let Ok(real) = input.canonicalize() {
        return Ok(real);
    }

    // Find the nearest existing ancestor, collecting the missing tail bottom-up.
    let mut existing = input;
    let mut tail: Vec<&std::ffi::OsStr> = Vec::new();
    loop {
        match existing.parent() {
            Some(parent) => {
                if let Some(name) = existing.file_name() {
                    tail.push(name);
                }
                existing = parent;
                if existing.exists() {
                    break;
                }
            }
            None => {
                return Err(format!("No existing ancestor for: {}", input.display()))
            }
        }
    }

    let mut result = existing
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize ancestor: {e}"))?;

    // Re-append the tail top-down, rejecting traversal components.
    for name in tail.iter().rev() {
        match Path::new(name).components().next() {
            Some(Component::Normal(part)) => result.push(part),
            _ => return Err("Path contains an invalid component".to_string()),
        }
    }
    Ok(result)
}

/// Allow filesystem access to a single path inside the configured data root.
///
/// The runtime fs scope on Unix matches with `require_literal_leading_dot`, so the
/// `dataDir/**` glob from `expand_fs_scope` cannot reach dot-prefixed paths
/// (`.aiignore`, `.view.json`, `.desk/`). This adds a *literal* allow entry, which
/// does match dot components. The frontend calls it just-in-time before touching a
/// hidden path; the data-root containment check is the real security boundary.
#[tauri::command]
fn allow_data_path(app_handle: tauri::AppHandle, path: String) -> Result<(), String> {
    let requested = std::path::PathBuf::from(&path);

    // The target may not exist yet (first write of `.view.json`, `.desk/index/...`).
    let target = lenient_canonicalize(&requested)?;
    let root_canon = lenient_canonicalize(&data_root::get_data_root())?;

    if !target.starts_with(&root_canon) {
        return Err(format!(
            "Path is outside the Desk data root: {}",
            requested.display()
        ));
    }

    // Use the ORIGINAL path: allow_file stores the escaped path plus a
    // canonicalized-parent variant, covering both the symlink and no-symlink cases.
    app_handle
        .fs_scope()
        .allow_file(&requested)
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            confirm_close,
            expand_fs_scope,
            allow_data_path,
            read_eml_file,
            read_dropped_file,
            delete_dropped_file,
            open_file_with_default_app,
            reveal_in_finder,
            open_in_terminal,
            secrets::secret_get,
            secrets::secret_set,
            secrets::secret_delete,
        ]);

    builder
        .setup(|app| {
            let initial_root = data_root::resolve_data_root(None);
            data_root::set_data_root(initial_root);

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

            #[cfg(target_os = "macos")]
            {
                if let Some(window) = app.get_webview_window("main") {
                    if let Err(e) = drop_view::install(&window) {
                        log::error!("Failed to install email drop view: {}", e);
                    }
                }
            }

            Ok(())
        })
        .on_menu_event(|app, event| {
            if event.id().as_ref() == "save" {
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
