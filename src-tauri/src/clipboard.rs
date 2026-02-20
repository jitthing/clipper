/// macOS clipboard operations using NSPasteboard API.

#[cfg(target_os = "macos")]
pub fn copy_image_to_clipboard(png_data: &[u8]) -> Result<(), String> {
    use cocoa::base::{id, nil};
    use objc::{class, msg_send, sel, sel_impl};

    unsafe {
        let pasteboard: id = msg_send![class!(NSPasteboard), generalPasteboard];
        let _: i64 = msg_send![pasteboard, clearContents];

        let png_type: id = msg_send![class!(NSString), stringWithUTF8String: b"public.png\0".as_ptr()];

        let ns_data: id = msg_send![class!(NSData), dataWithBytes: png_data.as_ptr()
                                                             length: png_data.len()];

        let success: bool = msg_send![pasteboard, setData: ns_data forType: png_type];

        if success {
            Ok(())
        } else {
            Err("Failed to set clipboard data".to_string())
        }
    }
}

#[cfg(not(target_os = "macos"))]
pub fn copy_image_to_clipboard(_png_data: &[u8]) -> Result<(), String> {
    Err("Clipboard copy is only supported on macOS".to_string())
}
