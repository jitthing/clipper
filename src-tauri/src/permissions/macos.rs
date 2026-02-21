use super::PermissionStatus;
use std::ffi::{c_char, c_void, CString};
use std::process::Command;

type Boolean = u8;
type CFDictionaryRef = *const c_void;
type CFStringRef = *const c_void;
type CFTypeRef = *const c_void;
type CFBooleanRef = *const c_void;

const UTF8: u32 = 0x08000100;

#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGPreflightScreenCaptureAccess() -> Boolean;
    fn CGRequestScreenCaptureAccess() -> Boolean;
}

#[link(name = "ApplicationServices", kind = "framework")]
extern "C" {
    fn AXIsProcessTrusted() -> Boolean;
    fn AXIsProcessTrustedWithOptions(options: CFDictionaryRef) -> Boolean;
}

#[link(name = "CoreFoundation", kind = "framework")]
extern "C" {
    fn CFStringCreateWithCString(
        alloc: *const c_void,
        c_str: *const c_char,
        encoding: u32,
    ) -> CFStringRef;
    fn CFDictionaryCreate(
        allocator: *const c_void,
        keys: *const *const c_void,
        values: *const *const c_void,
        num_values: isize,
        key_callbacks: *const c_void,
        value_callbacks: *const c_void,
    ) -> CFDictionaryRef;
    fn CFRelease(cf: CFTypeRef);

    static kCFBooleanTrue: CFBooleanRef;
}

fn open_settings_url(url: &str) -> Result<(), String> {
    Command::new("open")
        .arg(url)
        .status()
        .map_err(|e| format!("Failed to open settings: {e}"))
        .and_then(|status| {
            if status.success() {
                Ok(())
            } else {
                Err("Failed to open settings URL".to_string())
            }
        })
}

pub fn get_permission_status() -> PermissionStatus {
    PermissionStatus {
        screen_recording_granted: unsafe { CGPreflightScreenCaptureAccess() != 0 },
        accessibility_granted: unsafe { AXIsProcessTrusted() != 0 },
    }
}

pub fn request_screen_recording_permission() -> Result<bool, String> {
    Ok(unsafe { CGRequestScreenCaptureAccess() != 0 })
}

pub fn request_accessibility_permission() -> Result<bool, String> {
    unsafe {
        let key_name = CString::new("AXTrustedCheckOptionPrompt")
            .map_err(|e| format!("Invalid accessibility prompt key: {e}"))?;
        let key = CFStringCreateWithCString(std::ptr::null(), key_name.as_ptr(), UTF8);
        if key.is_null() {
            return Err("Failed to create AX prompt key".to_string());
        }

        let keys = [key as *const c_void];
        let values = [kCFBooleanTrue as *const c_void];
        let options = CFDictionaryCreate(
            std::ptr::null(),
            keys.as_ptr(),
            values.as_ptr(),
            1,
            std::ptr::null(),
            std::ptr::null(),
        );
        CFRelease(key as CFTypeRef);

        if options.is_null() {
            return Err("Failed to create accessibility options dictionary".to_string());
        }

        let trusted = AXIsProcessTrustedWithOptions(options);
        CFRelease(options as CFTypeRef);
        Ok(trusted != 0)
    }
}

pub fn open_screen_recording_settings() -> Result<(), String> {
    open_settings_url(
        "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture",
    )
}

pub fn open_accessibility_settings() -> Result<(), String> {
    open_settings_url(
        "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
    )
}
