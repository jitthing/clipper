#[cfg(target_os = "macos")]
pub mod macos;

use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct WindowInfo {
    pub id: u32,
    pub title: String,
    pub app_name: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// List all visible windows with their bounds.
pub fn list_windows() -> Result<Vec<WindowInfo>, String> {
    #[cfg(target_os = "macos")]
    {
        macos::list_windows()
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("Window detection not yet implemented for this platform".to_string())
    }
}
