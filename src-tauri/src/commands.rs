use crate::capture;
use crate::clipboard;
use crate::hotkey;
use crate::ocr;
use crate::permissions;
use crate::window;
use base64::Engine;
use serde::Deserialize;
use tauri::State;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;

static PIN_COUNTER: AtomicU32 = AtomicU32::new(0);

#[derive(Default)]
pub struct CaptureState {
    pub captured_image: Mutex<Option<String>>,
}

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
pub fn ocr_image(image_data: String) -> Result<String, String> {
    let png_bytes = base64::engine::general_purpose::STANDARD
        .decode(&image_data)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;
    ocr::recognize_text(&png_bytes)
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
pub fn capture_window_frame(window_id: u32) -> Result<String, String> {
    let target = window::list_windows()?
        .into_iter()
        .find(|w| w.id == window_id)
        .ok_or_else(|| format!("Window {window_id} not found"))?;

    let x = target.x.round() as i32;
    let y = target.y.round() as i32;
    let width = target.width.round().max(1.0) as u32;
    let height = target.height.round().max(1.0) as u32;

    let data = capture::capture_region(x, y, width, height)?;
    Ok(base64::engine::general_purpose::STANDARD.encode(&data))
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

#[tauri::command]
pub fn show_main_window(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;
    window
        .show()
        .map_err(|e| format!("Failed to show window: {e}"))
}

#[tauri::command]
pub fn crop_image(image_data: String, region: Region) -> Result<String, String> {
    let png_bytes = base64::engine::general_purpose::STANDARD
        .decode(&image_data)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;

    let img = image::load_from_memory_with_format(&png_bytes, image::ImageFormat::Png)
        .map_err(|e| format!("Failed to load image: {}", e))?;

    let cropped = img.crop_imm(
        region.x as u32,
        region.y as u32,
        region.width,
        region.height,
    );

    let mut buf = std::io::Cursor::new(Vec::new());
    cropped
        .write_to(&mut buf, image::ImageFormat::Png)
        .map_err(|e| format!("Failed to encode cropped image: {}", e))?;

    Ok(base64::engine::general_purpose::STANDARD.encode(buf.into_inner()))
}

#[tauri::command]
pub async fn close_overlay(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("capture-overlay") {
        window
            .close()
            .map_err(|e| format!("Failed to close overlay: {e}"))
    } else {
        Ok(())
    }
}

#[tauri::command]
pub async fn complete_capture(app: AppHandle, image_data: String) -> Result<(), String> {
    // Store the image
    let state = app.state::<CaptureState>();
    *state.captured_image.lock().unwrap() = Some(image_data.clone());

    // Show main window
    if let Some(main_win) = app.get_webview_window("main") {
        let _ = main_win.show();
        let _ = main_win.set_focus();
        let _ = main_win.emit("capture-complete", &image_data);
    }

    // Close overlay
    if let Some(overlay) = app.get_webview_window("capture-overlay") {
        let _ = overlay.close();
    }

    Ok(())
}

#[tauri::command]
pub async fn trigger_capture(app: AppHandle) -> Result<(), String> {
    // Hide main window first
    if let Some(main_win) = app.get_webview_window("main") {
        let _ = main_win.hide();
    }
    start_capture_flow(&app).await
}

#[tauri::command]
pub fn get_capture_shortcut(state: State<hotkey::HotkeyState>) -> String {
    hotkey::get_capture_shortcut(&state)
}

#[tauri::command]
pub fn set_capture_shortcut(
    app: AppHandle,
    state: State<hotkey::HotkeyState>,
    shortcut: String,
) -> Result<hotkey::HotkeyMutationResult, String> {
    hotkey::update_capture_shortcut(&app, &state, &shortcut)
}

#[tauri::command]
pub fn reset_capture_shortcut(
    app: AppHandle,
    state: State<hotkey::HotkeyState>,
) -> Result<hotkey::HotkeyMutationResult, String> {
    hotkey::reset_capture_shortcut(&app, &state)
}

pub async fn start_capture_flow(app: &AppHandle) -> Result<(), String> {
    // 1. Hide main window if visible (so it doesn't appear in screenshot)
    if let Some(main_win) = app.get_webview_window("main") {
        let _ = main_win.hide();
    }

    // Small delay to ensure window is hidden
    tokio::time::sleep(std::time::Duration::from_millis(150)).await;

    // 2. Capture full screen
    let png_bytes =
        capture::capture_full_screen().map_err(|e| format!("Screen capture failed: {e}"))?;
    let base64_data = base64::engine::general_purpose::STANDARD.encode(&png_bytes);

    // 3. Check if overlay window already exists, close it
    if let Some(existing) = app.get_webview_window("capture-overlay") {
        let _ = existing.close();
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    }

    // 4. Get screen dimensions
    let (screen_w, screen_h) = capture::screen_size();

    // 5. Create fullscreen overlay window
    let overlay = WebviewWindowBuilder::new(
        app,
        "capture-overlay",
        WebviewUrl::App("index.html?mode=overlay".into()),
    )
    .title("")
    .inner_size(screen_w, screen_h)
    .position(0.0, 0.0)
    .decorations(false)
    .always_on_top(true)
    .resizable(false)
    .skip_taskbar(true)
    .shadow(false)
    .visible(false)
    .build()
    .map_err(|e| format!("Failed to create overlay: {e}"))?;

    // 6. Send screenshot data to overlay once it's ready
    let js = format!(
        "window.__SCREENSHOT_DATA__ = 'data:image/png;base64,{}'; window.dispatchEvent(new Event('screenshot-ready'));",
        base64_data
    );
    let mut sent = false;
    // Retry sending data (window might need time to load)
    for _ in 0..10 {
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
        if overlay.eval(&js).is_ok() {
            sent = true;
            break;
        }
    }

    if sent {
        let _ = overlay.show();
        let _ = overlay.set_focus();
    } else {
        let _ = overlay.close();
        return Err("Failed to initialize capture overlay".to_string());
    }

    Ok(())
}
