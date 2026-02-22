#[cfg(target_os = "macos")]
pub mod macos;

/// Capture the entire screen and return raw image bytes.
pub fn capture_full_screen() -> Result<Vec<u8>, String> {
    #[cfg(target_os = "macos")]
    {
        macos::capture_screen()
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("Screen capture not yet implemented for this platform".to_string())
    }
}

/// Return the main display dimensions in points.
pub fn screen_size() -> (f64, f64) {
    #[cfg(target_os = "macos")]
    {
        macos::screen_size()
    }
    #[cfg(not(target_os = "macos"))]
    {
        (1920.0, 1080.0)
    }
}

/// Capture a specific region of the screen.
pub fn capture_region(x: i32, y: i32, width: u32, height: u32) -> Result<Vec<u8>, String> {
    #[cfg(target_os = "macos")]
    {
        macos::capture_region(x, y, width, height)
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (x, y, width, height);
        Err("Screen capture not yet implemented for this platform".to_string())
    }
}
