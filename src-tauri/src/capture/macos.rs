/// macOS screen capture using ScreenCaptureKit.
///
/// TODO: Implement using ScreenCaptureKit framework via objc2 bindings.
/// For now, this is a placeholder that will be implemented in issue #1.

pub fn capture_screen() -> Result<Vec<u8>, String> {
    // TODO: Use SCScreenshotManager / SCShareableContent to capture
    // the full screen via ScreenCaptureKit (macOS 12.3+)
    Err("ScreenCaptureKit capture not yet implemented".to_string())
}

pub fn capture_region(_x: i32, _y: i32, _width: u32, _height: u32) -> Result<Vec<u8>, String> {
    // TODO: Capture full screen then crop to region,
    // or use CGWindowListCreateImage for region capture
    Err("Region capture not yet implemented".to_string())
}
