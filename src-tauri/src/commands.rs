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
    let _data = capture::capture_full_screen()?;
    // TODO: encode to base64 and return
    Ok("capture_placeholder".to_string())
}

#[tauri::command]
pub fn capture_region(region: Region) -> Result<String, String> {
    let _data = capture::capture_region(region.x, region.y, region.width, region.height)?;
    Ok("region_capture_placeholder".to_string())
}

#[tauri::command]
pub fn copy_to_clipboard(_image_data: String) -> Result<(), String> {
    // TODO: Use platform clipboard APIs to copy image
    Err("Clipboard copy not yet implemented".to_string())
}

#[tauri::command]
pub fn save_to_file(_image_data: String, _path: String, _format: String) -> Result<(), String> {
    // TODO: Decode base64 image and save to file
    Err("Save to file not yet implemented".to_string())
}

#[tauri::command]
pub fn list_windows() -> Result<Vec<window::WindowInfo>, String> {
    window::list_windows()
}
