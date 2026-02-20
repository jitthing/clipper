use super::WindowInfo;

/// List visible windows using macOS Accessibility API / CGWindowListCopyWindowInfo.
///
/// TODO: Implement using CoreGraphics CGWindowListCopyWindowInfo
/// to enumerate all on-screen windows with their bounds.
pub fn list_windows() -> Result<Vec<WindowInfo>, String> {
    // TODO: Use CGWindowListCopyWindowInfo to get window list
    // Filter by kCGWindowListOptionOnScreenOnly
    // Parse each window's bounds, title, owning application
    Ok(vec![])
}
