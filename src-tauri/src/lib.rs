mod capture;
mod clipboard;
mod commands;
mod hotkey;
mod image_processing;
mod window;

use tauri::Emitter;
use tauri::Manager;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Register Cmd+Shift+X global hotkey
            let shortcut = Shortcut::new(
                Some(Modifiers::META | Modifiers::SHIFT),
                Code::KeyX,
            );
            let handle = app.handle().clone();
            app.global_shortcut().on_shortcut(shortcut, move |_app, _shortcut, _event| {
                let _ = handle.emit("capture-trigger", ());
            })?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::capture_screen,
            commands::capture_region,
            commands::copy_to_clipboard,
            commands::save_to_file,
            commands::list_windows,
            commands::pin_screenshot,
            commands::close_pin_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Snaplark");
}
