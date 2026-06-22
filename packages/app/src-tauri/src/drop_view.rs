// macOS file-promise + file-URL drop view — Rust side.
//
// The actual Cocoa NSView lives in `drop_view.m`. This file:
//   1. Declares the C ABI exposed by drop_view.m.
//   2. Stores an AppHandle in a leaked Box so the C callbacks can route
//      events back into Tauri.
//   3. Provides `install(window)` for `lib.rs` to call during setup.
//
// Two parallel event streams:
//   - `email-drag-{enter,leave,drop}` for Apple Mail / Outlook file promises.
//   - `desk-files-drag-{enter,leave,drop}` for plain file URL drops
//     (Finder, Thunderbird, anywhere else). The drop event payload is the
//     array of file system paths.

use std::ffi::{c_char, c_void, CStr};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

type DropStateCb = extern "C" fn(*mut c_void);
type DropPathCb = extern "C" fn(*const c_char, *mut c_void);
type DropFilesCb =
    extern "C" fn(*const *const c_char, usize, f64, f64, *mut c_void);
type DropPosCb = extern "C" fn(f64, f64, *mut c_void);

#[derive(Serialize, Clone)]
struct DragOverPayload {
    x: f64,
    y: f64,
}

#[derive(Serialize, Clone)]
struct FilesDropPayload {
    paths: Vec<String>,
    x: f64,
    y: f64,
}

extern "C" {
    fn desk_install_drop_view(
        ns_window: *mut c_void,
        on_enter: DropStateCb,
        on_leave: DropStateCb,
        on_drop: DropPathCb,
        on_files_enter: DropStateCb,
        on_files_leave: DropStateCb,
        on_files_over: DropPosCb,
        on_files_drop: DropFilesCb,
        user_data: *mut c_void,
    );
}

extern "C" fn on_enter(user_data: *mut c_void) {
    if let Some(app) = unsafe { user_data.cast::<AppHandle>().as_ref() } {
        let _ = app.emit("email-drag-enter", ());
    }
}

extern "C" fn on_leave(user_data: *mut c_void) {
    if let Some(app) = unsafe { user_data.cast::<AppHandle>().as_ref() } {
        let _ = app.emit("email-drag-leave", ());
    }
}

extern "C" fn on_drop(path: *const c_char, user_data: *mut c_void) {
    let (Some(app), Some(path_str)) = (
        unsafe { user_data.cast::<AppHandle>().as_ref() },
        unsafe { path.as_ref() }.and_then(|_| unsafe { CStr::from_ptr(path) }.to_str().ok()),
    ) else {
        return;
    };
    let _ = app.emit("email-drag-drop", path_str.to_string());
}

extern "C" fn on_files_enter(user_data: *mut c_void) {
    if let Some(app) = unsafe { user_data.cast::<AppHandle>().as_ref() } {
        let _ = app.emit("desk-files-drag-enter", ());
    }
}

extern "C" fn on_files_leave(user_data: *mut c_void) {
    if let Some(app) = unsafe { user_data.cast::<AppHandle>().as_ref() } {
        let _ = app.emit("desk-files-drag-leave", ());
    }
}

extern "C" fn on_files_over(x: f64, y: f64, user_data: *mut c_void) {
    if let Some(app) = unsafe { user_data.cast::<AppHandle>().as_ref() } {
        let _ = app.emit("desk-files-drag-over", DragOverPayload { x, y });
    }
}

extern "C" fn on_files_drop(
    paths: *const *const c_char,
    count: usize,
    x: f64,
    y: f64,
    user_data: *mut c_void,
) {
    let Some(app) = (unsafe { user_data.cast::<AppHandle>().as_ref() }) else {
        return;
    };
    if paths.is_null() || count == 0 {
        return;
    }
    let mut out: Vec<String> = Vec::with_capacity(count);
    for i in 0..count {
        let entry = unsafe { *paths.add(i) };
        if entry.is_null() {
            continue;
        }
        if let Ok(s) = unsafe { CStr::from_ptr(entry) }.to_str() {
            out.push(s.to_string());
        }
    }
    if !out.is_empty() {
        let _ = app.emit(
            "desk-files-drag-drop",
            FilesDropPayload { paths: out, x, y },
        );
    }
}

pub fn install(window: &WebviewWindow) -> Result<(), String> {
    // Leak an AppHandle so the C callbacks have a stable pointer for the
    // lifetime of the app. There is exactly one main window, so this leaks
    // 16 bytes once; trivial.
    let handle_ptr: *mut AppHandle = Box::into_raw(Box::new(window.app_handle().clone()));

    let ns_window = window
        .ns_window()
        .map_err(|e| format!("failed to get NSWindow: {e}"))?;

    // The Cocoa side installs onto the window's contentView on whatever
    // thread it runs on. Tauri's setup runs on the main thread on macOS,
    // which is what AppKit requires. The Obj-C function is idempotent.
    unsafe {
        desk_install_drop_view(
            ns_window,
            on_enter,
            on_leave,
            on_drop,
            on_files_enter,
            on_files_leave,
            on_files_over,
            on_files_drop,
            handle_ptr.cast::<c_void>(),
        );
    }

    Ok(())
}
