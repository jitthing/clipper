mod capture;
mod commands;
mod hotkey;
mod image_processing;
mod window;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            commands::capture_screen,
            commands::capture_region,
            commands::copy_to_clipboard,
            commands::save_to_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Snaplark");
}
