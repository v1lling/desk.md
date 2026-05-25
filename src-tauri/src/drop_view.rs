// macOS file-promise drop view — Rust side.
//
// The actual Cocoa NSView lives in `drop_view.m`. This file:
//   1. Declares the C ABI exposed by drop_view.m.
//   2. Stores an AppHandle in a leaked Box so the C callbacks can route
//      events back into Tauri (`email-drag-enter`/`leave`/`drop`).
//   3. Provides `install(window)` for `lib.rs` to call during setup.
//
// See drop_view.m for the file-promise / FSEvents coordination logic and
// the Apple Mail workaround documentation.

use std::ffi::{c_char, c_void, CStr};

use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

type DropStateCb = extern "C" fn(*mut c_void);
type DropPathCb = extern "C" fn(*const c_char, *mut c_void);

extern "C" {
    fn desk_install_drop_view(
        ns_window: *mut c_void,
        on_enter: DropStateCb,
        on_leave: DropStateCb,
        on_drop: DropPathCb,
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
            handle_ptr.cast::<c_void>(),
        );
    }

    Ok(())
}
