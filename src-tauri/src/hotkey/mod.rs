/// Global hotkey registration and management.
///
/// Uses tauri-plugin-global-shortcut for cross-platform hotkey support.
/// Default capture hotkey: Cmd+Shift+X (macOS) / Ctrl+Shift+X (Windows/Linux)
///
/// TODO: Implement hotkey registration in the Tauri setup hook.
/// The actual registration happens in lib.rs using the plugin,
/// but this module will handle custom hotkey configuration.

pub const DEFAULT_CAPTURE_HOTKEY: &str = "CommandOrControl+Shift+X";

pub struct HotkeyConfig {
    pub capture: String,
}

impl Default for HotkeyConfig {
    fn default() -> Self {
        Self {
            capture: DEFAULT_CAPTURE_HOTKEY.to_string(),
        }
    }
}
