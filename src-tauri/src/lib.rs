#![allow(unexpected_cfgs)]

mod capture;
mod clipboard;
mod commands;
mod hotkey;
mod image_processing;
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
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show-main" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.emit("open-main-view", ());
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
            let quit_item = MenuItem::with_id(&app_handle, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(&app_handle, &[&show_item, &quit_item])?;

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

            // Register Cmd+Shift+X global hotkey
            let shortcut = Shortcut::new(Some(Modifiers::META | Modifiers::SHIFT), Code::KeyX);
            let handle = app.handle().clone();
            app.global_shortcut()
                .on_shortcut(shortcut, move |_app, _shortcut, _event| {
                    if let Some(window) = handle.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = window.emit("capture-toggle", ());
                    } else {
                        let _ = handle.emit("capture-toggle", ());
                    }
                })?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::capture_screen,
            commands::capture_region,
            commands::copy_to_clipboard,
            commands::save_to_file,
            commands::list_windows,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running Snaplark");
}
