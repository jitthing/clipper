#![allow(unexpected_cfgs)]

mod capture;
mod clipboard;
mod commands;
mod hotkey;
mod image_processing;
mod ocr;
mod permissions;
mod window;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Emitter;
use tauri::Manager;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .manage(commands::CaptureState::default())
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show-main" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.emit("open-main-view", ());
                }
            }
            "open-settings" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.emit("open-settings", ());
                }
            }
            "toggle-recording" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.emit("toggle-recording-request", ());
                }
            }
            "toggle-webcam-overlay" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.emit("toggle-webcam-overlay-request", ());
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|app, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.emit("open-main-view", ());
                }
            }
        })
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let app_handle = app.handle().clone();
            let show_item = MenuItem::with_id(
                &app_handle,
                "show-main",
                "Open Snaplark",
                true,
                None::<&str>,
            )?;
            let toggle_recording_item = MenuItem::with_id(
                &app_handle,
                "toggle-recording",
                "Start / Stop Recording (⌘⇧R)",
                true,
                None::<&str>,
            )?;
            let settings_item = MenuItem::with_id(
                &app_handle,
                "open-settings",
                "Preferences",
                true,
                None::<&str>,
            )?;
            let toggle_webcam_item = MenuItem::with_id(
                &app_handle,
                "toggle-webcam-overlay",
                "Toggle Webcam Overlay",
                true,
                None::<&str>,
            )?;
            let quit_item = MenuItem::with_id(&app_handle, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(
                &app_handle,
                &[
                    &show_item,
                    &settings_item,
                    &toggle_recording_item,
                    &toggle_webcam_item,
                    &quit_item,
                ],
            )?;

            let tray_handle = app.handle().clone();
            TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(false)
                .build(&tray_handle)?;

            if let Some(window) = app.get_webview_window("main") {
                let window_clone = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = window_clone.hide();
                    }
                });
            }

            let capture_shortcut = hotkey::bootstrap_capture_shortcut(app.handle())?;
            app.manage(hotkey::HotkeyState::new(capture_shortcut));

            // Register Cmd+Shift+R global hotkey for recording toggle
            let recording_shortcut =
                Shortcut::new(Some(Modifiers::META | Modifiers::SHIFT), Code::KeyR);
            let recording_handle = app.handle().clone();
            app.global_shortcut().on_shortcut(
                recording_shortcut,
                move |_app, _shortcut, _event| {
                    if let Some(window) = recording_handle.get_webview_window("main") {
                        let _ = window.emit("toggle-recording-request", ());
                    }
                },
            )?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::capture_screen,
            commands::capture_region,
            commands::copy_to_clipboard,
            commands::ocr_image,
            commands::save_to_file,
            commands::list_windows,
            commands::capture_window_frame,
            commands::pin_screenshot,
            commands::close_pin_window,
            commands::get_permission_status,
            commands::request_screen_recording_permission,
            commands::request_accessibility_permission,
            commands::open_screen_recording_settings,
            commands::open_accessibility_settings,
            commands::hide_main_window,
            commands::show_main_window,
            commands::crop_image,
            commands::close_overlay,
            commands::complete_capture,
            commands::trigger_capture,
            commands::get_capture_shortcut,
            commands::set_capture_shortcut,
            commands::reset_capture_shortcut,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Snaplark");
}
