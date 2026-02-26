use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::AppHandle;
use tauri::Manager;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

use crate::commands;

pub const DEFAULT_CAPTURE_HOTKEY: &str = "CommandOrControl+Shift+X";
const RECORDING_HOTKEY: &str = "CommandOrControl+Shift+R";
const HOTKEYS_FILE: &str = "hotkeys.json";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct HotkeyConfig {
    pub capture: String,
}

#[derive(Debug, Serialize)]
pub struct HotkeyMutationResult {
    pub status: String,
    pub message: String,
    pub shortcut: String,
}

#[derive(Debug)]
pub enum HotkeyValidationError {
    Empty,
    InvalidFormat(String),
    UnsupportedKey(String),
    MustIncludeCmdOrCtrl,
    MustIncludeNonShiftModifier,
    ReservedCombo,
}

impl HotkeyValidationError {
    pub fn message(&self) -> String {
        match self {
            Self::Empty => "Shortcut cannot be empty.".to_string(),
            Self::InvalidFormat(msg) => format!("Invalid shortcut: {msg}"),
            Self::UnsupportedKey(key) => {
                format!("Unsupported key '{key}'. Use an A-Z key.")
            }
            Self::MustIncludeCmdOrCtrl => {
                "Shortcut must include Command (macOS) or Control (Windows/Linux).".to_string()
            }
            Self::MustIncludeNonShiftModifier => {
                "Shortcut must include another modifier (Shift or Alt).".to_string()
            }
            Self::ReservedCombo => "Shortcut is reserved. Choose another combination.".to_string(),
        }
    }
}

pub struct HotkeyState {
    capture: Mutex<String>,
}

impl HotkeyState {
    pub fn new(capture: String) -> Self {
        Self {
            capture: Mutex::new(capture),
        }
    }

    pub fn get_capture(&self) -> String {
        self.capture.lock().unwrap().clone()
    }

    pub fn set_capture(&self, shortcut: String) {
        *self.capture.lock().unwrap() = shortcut;
    }
}

struct ParsedShortcut {
    shortcut: Shortcut,
    normalized: String,
    has_cmd_or_ctrl: bool,
    has_non_shift_modifier: bool,
}

pub fn bootstrap_capture_shortcut(app: &AppHandle) -> Result<String, String> {
    let saved = load_config(app)?.capture;
    let parsed = parse_and_validate_capture_shortcut(&saved).map_err(|err| err.message())?;
    bind_capture_shortcut(app, parsed)?;
    Ok(normalize_shortcut_string(&saved))
}

pub fn get_capture_shortcut(state: &HotkeyState) -> String {
    state.get_capture()
}

pub fn update_capture_shortcut(
    app: &AppHandle,
    state: &HotkeyState,
    shortcut: &str,
) -> Result<HotkeyMutationResult, String> {
    let parsed = match parse_and_validate_capture_shortcut(shortcut) {
        Ok(parsed) => parsed,
        Err(err) => {
            return Ok(HotkeyMutationResult {
                status: "invalid".to_string(),
                message: err.message(),
                shortcut: state.get_capture(),
            });
        }
    };

    let normalized = normalize_shortcut_string(shortcut);
    let current = state.get_capture();
    if normalized == current {
        return Ok(HotkeyMutationResult {
            status: "ok".to_string(),
            message: "Shortcut unchanged.".to_string(),
            shortcut: current,
        });
    }

    let shortcut_api = app.global_shortcut();

    if shortcut_api.is_registered(parsed) {
        return Ok(HotkeyMutationResult {
            status: "conflict".to_string(),
            message: "Shortcut is already in use.".to_string(),
            shortcut: current,
        });
    }

    let current_parsed =
        parse_and_validate_capture_shortcut(&current).map_err(|err| err.message())?;

    shortcut_api
        .unregister(current_parsed)
        .map_err(|e| format!("Failed to unregister previous capture shortcut: {e}"))?;

    if let Err(err) = bind_capture_shortcut(app, parsed) {
        let _ = bind_capture_shortcut(app, current_parsed);
        return Ok(HotkeyMutationResult {
            status: "conflict".to_string(),
            message: format!("Failed to register shortcut: {err}"),
            shortcut: current,
        });
    }

    state.set_capture(normalized.clone());
    save_config(
        app,
        &HotkeyConfig {
            capture: normalized.clone(),
        },
    )?;

    Ok(HotkeyMutationResult {
        status: "ok".to_string(),
        message: "Shortcut updated.".to_string(),
        shortcut: normalized,
    })
}

pub fn reset_capture_shortcut(
    app: &AppHandle,
    state: &HotkeyState,
) -> Result<HotkeyMutationResult, String> {
    update_capture_shortcut(app, state, DEFAULT_CAPTURE_HOTKEY)
}

pub fn parse_and_validate_capture_shortcut(value: &str) -> Result<Shortcut, HotkeyValidationError> {
    let parsed = parse_shortcut(value)?;
    if !parsed.has_cmd_or_ctrl {
        return Err(HotkeyValidationError::MustIncludeCmdOrCtrl);
    }
    if !parsed.has_non_shift_modifier {
        return Err(HotkeyValidationError::MustIncludeNonShiftModifier);
    }
    if parsed.normalized == RECORDING_HOTKEY {
        return Err(HotkeyValidationError::ReservedCombo);
    }
    Ok(parsed.shortcut)
}

fn parse_shortcut(value: &str) -> Result<ParsedShortcut, HotkeyValidationError> {
    let value = value.trim();
    if value.is_empty() {
        return Err(HotkeyValidationError::Empty);
    }

    let parts: Vec<String> = value
        .split('+')
        .map(|part| part.trim().to_string())
        .filter(|part| !part.is_empty())
        .collect();

    if parts.len() < 2 {
        return Err(HotkeyValidationError::InvalidFormat(
            "must include modifiers and key".to_string(),
        ));
    }

    let mut modifiers = Modifiers::empty();
    let mut has_cmd_or_ctrl = false;
    let mut has_shift = false;
    let mut has_alt = false;

    for modifier in &parts[..parts.len() - 1] {
        let lower = modifier.to_ascii_lowercase();
        match lower.as_str() {
            "commandorcontrol" => {
                has_cmd_or_ctrl = true;
                #[cfg(target_os = "macos")]
                {
                    modifiers |= Modifiers::META;
                }
                #[cfg(not(target_os = "macos"))]
                {
                    modifiers |= Modifiers::CONTROL;
                }
            }
            "command" | "cmd" | "meta" | "super" => {
                modifiers |= Modifiers::META;
                has_cmd_or_ctrl = true;
            }
            "control" | "ctrl" => {
                modifiers |= Modifiers::CONTROL;
                has_cmd_or_ctrl = true;
            }
            "shift" => {
                modifiers |= Modifiers::SHIFT;
                has_shift = true;
            }
            "alt" | "option" => {
                modifiers |= Modifiers::ALT;
                has_alt = true;
            }
            _ => {
                return Err(HotkeyValidationError::InvalidFormat(format!(
                    "unknown modifier '{modifier}'"
                )));
            }
        }
    }

    let key = parts.last().unwrap();
    let key_upper = key.to_ascii_uppercase();
    let code = parse_key_code(&key_upper)?;

    let mut normalized_parts: Vec<&str> = Vec::new();
    if has_cmd_or_ctrl {
        normalized_parts.push("CommandOrControl");
    }
    if has_alt {
        normalized_parts.push("Alt");
    }
    if has_shift {
        normalized_parts.push("Shift");
    }
    normalized_parts.push(key_upper.as_str());

    Ok(ParsedShortcut {
        shortcut: Shortcut::new(Some(modifiers), code),
        normalized: normalized_parts.join("+"),
        has_cmd_or_ctrl,
        has_non_shift_modifier: has_alt || has_shift,
    })
}

fn parse_key_code(key_upper: &str) -> Result<Code, HotkeyValidationError> {
    match key_upper {
        "A" => Ok(Code::KeyA),
        "B" => Ok(Code::KeyB),
        "C" => Ok(Code::KeyC),
        "D" => Ok(Code::KeyD),
        "E" => Ok(Code::KeyE),
        "F" => Ok(Code::KeyF),
        "G" => Ok(Code::KeyG),
        "H" => Ok(Code::KeyH),
        "I" => Ok(Code::KeyI),
        "J" => Ok(Code::KeyJ),
        "K" => Ok(Code::KeyK),
        "L" => Ok(Code::KeyL),
        "M" => Ok(Code::KeyM),
        "N" => Ok(Code::KeyN),
        "O" => Ok(Code::KeyO),
        "P" => Ok(Code::KeyP),
        "Q" => Ok(Code::KeyQ),
        "R" => Ok(Code::KeyR),
        "S" => Ok(Code::KeyS),
        "T" => Ok(Code::KeyT),
        "U" => Ok(Code::KeyU),
        "V" => Ok(Code::KeyV),
        "W" => Ok(Code::KeyW),
        "X" => Ok(Code::KeyX),
        "Y" => Ok(Code::KeyY),
        "Z" => Ok(Code::KeyZ),
        _ => Err(HotkeyValidationError::UnsupportedKey(key_upper.to_string())),
    }
}

fn bind_capture_shortcut(app: &AppHandle, shortcut: Shortcut) -> Result<(), String> {
    let handle = app.clone();
    app.global_shortcut()
        .on_shortcut(shortcut, move |_app, _shortcut, _event| {
            let handle = handle.clone();
            tauri::async_runtime::spawn(async move {
                if let Err(err) = commands::start_capture_flow(&handle).await {
                    eprintln!("Capture flow failed: {err}");
                }
            });
        })
        .map_err(|e| format!("Failed to register capture shortcut: {e}"))
}

pub fn normalize_shortcut_string(value: &str) -> String {
    match parse_shortcut(value) {
        Ok(parsed) => parsed.normalized,
        Err(_) => DEFAULT_CAPTURE_HOTKEY.to_string(),
    }
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to resolve app config directory: {e}"))?;
    Ok(config_dir.join(HOTKEYS_FILE))
}

fn load_config(app: &AppHandle) -> Result<HotkeyConfig, String> {
    let path = config_path(app)?;
    if !path.exists() {
        return Ok(HotkeyConfig {
            capture: DEFAULT_CAPTURE_HOTKEY.to_string(),
        });
    }

    let raw = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read hotkey config '{}': {e}", path.display()))?;
    let mut config: HotkeyConfig = serde_json::from_str(&raw)
        .map_err(|e| format!("Failed to parse hotkey config '{}': {e}", path.display()))?;
    if parse_and_validate_capture_shortcut(&config.capture).is_err() {
        config.capture = DEFAULT_CAPTURE_HOTKEY.to_string();
    } else {
        config.capture = normalize_shortcut_string(&config.capture);
    }
    Ok(config)
}

fn save_config(app: &AppHandle, config: &HotkeyConfig) -> Result<(), String> {
    let path = config_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| {
            format!(
                "Failed to create hotkey config directory '{}': {e}",
                parent.display()
            )
        })?;
    }
    let json = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize hotkey config: {e}"))?;
    fs::write(&path, json)
        .map_err(|e| format!("Failed to write hotkey config '{}': {e}", path.display()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_valid_shortcut() {
        parse_and_validate_capture_shortcut("CommandOrControl+Shift+X")
            .expect("expected valid shortcut");
        assert_eq!(
            normalize_shortcut_string("CommandOrControl+Shift+X"),
            "CommandOrControl+Shift+X"
        );
    }

    #[test]
    fn rejects_without_cmd_or_ctrl() {
        let error = parse_and_validate_capture_shortcut("Shift+X")
            .err()
            .expect("expected validation error");
        assert!(matches!(error, HotkeyValidationError::MustIncludeCmdOrCtrl));
    }

    #[test]
    fn rejects_without_non_shift_modifier() {
        let error = parse_and_validate_capture_shortcut("CommandOrControl+X")
            .err()
            .expect("expected validation error");
        assert!(matches!(
            error,
            HotkeyValidationError::MustIncludeNonShiftModifier
        ));
    }

    #[test]
    fn rejects_reserved_recording_shortcut() {
        let error = parse_and_validate_capture_shortcut("CommandOrControl+Shift+R")
            .err()
            .expect("expected validation error");
        assert!(matches!(error, HotkeyValidationError::ReservedCombo));
    }

    #[test]
    fn rejects_unsupported_key() {
        let error = parse_and_validate_capture_shortcut("CommandOrControl+Shift+1")
            .err()
            .expect("expected validation error");
        assert!(matches!(error, HotkeyValidationError::UnsupportedKey(_)));
    }
}
