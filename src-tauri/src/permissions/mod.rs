use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct PermissionStatus {
    pub screen_recording_granted: bool,
    pub accessibility_granted: bool,
}

pub fn get_permission_status() -> PermissionStatus {
    #[cfg(target_os = "macos")]
    {
        return macos::get_permission_status();
    }
    #[cfg(not(target_os = "macos"))]
    {
        PermissionStatus {
            screen_recording_granted: true,
            accessibility_granted: true,
        }
    }
}

pub fn request_screen_recording_permission() -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        return macos::request_screen_recording_permission();
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(true)
    }
}

pub fn request_accessibility_permission() -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        return macos::request_accessibility_permission();
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(true)
    }
}

pub fn open_screen_recording_settings() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        return macos::open_screen_recording_settings();
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(())
    }
}

pub fn open_accessibility_settings() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        return macos::open_accessibility_settings();
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(())
    }
}

#[cfg(target_os = "macos")]
mod macos;
