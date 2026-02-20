use crate::capture;
use crate::clipboard;
use crate::permissions;
use crate::window;
use base64::Engine;
use serde::Deserialize;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

use std::sync::atomic::{AtomicU32, Ordering};

static PIN_COUNTER: AtomicU32 = AtomicU32::new(0);

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
pub fn copy_to_clipboard(image_data: String) -> Result<(), String> {
    use base64::Engine;
    let png_bytes = base64::engine::general_purpose::STANDARD
        .decode(&image_data)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;
    clipboard::copy_image_to_clipboard(&png_bytes)
}

#[tauri::command]
pub fn save_to_file(image_data: String, path: String, format: String) -> Result<(), String> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&image_data)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;

    let img = image::load_from_memory_with_format(&bytes, image::ImageFormat::Png)
        .map_err(|e| format!("Failed to load image: {}", e))?;

    let fmt = match format.as_str() {
        "jpg" | "jpeg" => image::ImageFormat::Jpeg,
        _ => image::ImageFormat::Png,
    };

    img.save_with_format(&path, fmt)
        .map_err(|e| format!("Failed to save: {}", e))
}

#[tauri::command]
pub fn list_windows() -> Result<Vec<window::WindowInfo>, String> {
    window::list_windows()
}

#[tauri::command]
pub async fn pin_screenshot(
    app: AppHandle,
    image_data: String,
    width: f64,
    height: f64,
) -> Result<String, String> {
    let pin_id = PIN_COUNTER.fetch_add(1, Ordering::SeqCst);
    let label = format!("pin-{}", pin_id);

    // Scale down if too large, maintaining aspect ratio
    let max_dim = 600.0_f64;
    let scale = if width > max_dim || height > max_dim {
        max_dim / width.max(height)
    } else {
        1.0
    };
    let win_w = (width * scale).round();
    let win_h = (height * scale).round();

    let url = WebviewUrl::App("index.html".into());
    let window = WebviewWindowBuilder::new(&app, &label, url)
        .title("")
        .inner_size(win_w, win_h)
        .decorations(false)
        .always_on_top(true)
        .resizable(true)
        .shadow(true)
        .skip_taskbar(true)
        .build()
        .map_err(|e| format!("Failed to create pin window: {}", e))?;

    // Send the image data to the pin window after it's ready (retry up to 5 times)
    let image_data_clone = image_data.clone();
    let label_clone = label.clone();
    tauri::async_runtime::spawn(async move {
        let js = format!(
            "window.__PIN_DATA__ = {{ imageData: '{}', label: '{}' }}; window.dispatchEvent(new Event('pin-data-ready'));",
            image_data_clone, label_clone
        );
        for _ in 0..5 {
            tokio::time::sleep(std::time::Duration::from_millis(200)).await;
            if window.eval(&js).is_ok() {
                break;
            }
        }
    });

    Ok(label)
}

#[tauri::command]
pub async fn close_pin_window(app: AppHandle, label: String) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&label) {
        window
            .close()
            .map_err(|e| format!("Failed to close: {}", e))
    } else {
        Err("Window not found".to_string())
    }
}

#[tauri::command]
pub fn get_permission_status() -> permissions::PermissionStatus {
    permissions::get_permission_status()
}

#[tauri::command]
pub fn request_screen_recording_permission() -> Result<bool, String> {
    permissions::request_screen_recording_permission()
}

#[tauri::command]
pub fn request_accessibility_permission() -> Result<bool, String> {
    permissions::request_accessibility_permission()
}

#[tauri::command]
pub fn open_screen_recording_settings() -> Result<(), String> {
    permissions::open_screen_recording_settings()
}

#[tauri::command]
pub fn open_accessibility_settings() -> Result<(), String> {
    permissions::open_accessibility_settings()
}

#[tauri::command]
pub fn hide_main_window(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;
    window
        .hide()
        .map_err(|e| format!("Failed to hide window: {e}"))
}
