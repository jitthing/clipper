use base64::Engine;
use serde::Deserialize;

use crate::capture;
use crate::window;

#[derive(Debug, Deserialize)]
pub struct Region {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[tauri::command]
pub fn capture_screen() -> Result<String, String> {
    let data = capture::capture_full_screen()?;
    Ok(base64::engine::general_purpose::STANDARD.encode(&data))
}

#[tauri::command]
pub fn capture_region(region: Region) -> Result<String, String> {
    let data = capture::capture_region(region.x, region.y, region.width, region.height)?;
    Ok(base64::engine::general_purpose::STANDARD.encode(&data))
}

#[tauri::command]
pub fn copy_to_clipboard(_image_data: String) -> Result<(), String> {
    // TODO: Use platform clipboard APIs to copy image
    Err("Clipboard copy not yet implemented".to_string())
}

#[tauri::command]
pub fn save_to_file(image_data: String, path: String, _format: String) -> Result<(), String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&image_data)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;
    std::fs::write(&path, &bytes).map_err(|e| format!("Failed to write file: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn list_windows() -> Result<Vec<window::WindowInfo>, String> {
    window::list_windows()
}
