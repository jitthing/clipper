#[cfg(target_os = "macos")]
#[allow(deprecated)]
pub fn recognize_text(png_data: &[u8]) -> Result<String, String> {
    use cocoa::base::{id, nil};
    use cocoa::foundation::{NSArray, NSRect};
    use objc::rc::autoreleasepool;
    use objc::{class, msg_send, sel, sel_impl};

    autoreleasepool(|| unsafe {
        let ns_data: id =
            msg_send![class!(NSData), dataWithBytes: png_data.as_ptr() length: png_data.len()];
        if ns_data == nil {
            return Err("Failed to create NSData from PNG bytes".to_string());
        }

        let ns_image_alloc: id = msg_send![class!(NSImage), alloc];
        let ns_image: id = msg_send![ns_image_alloc, initWithData: ns_data];
        if ns_image == nil {
            return Err("Failed to create NSImage from PNG bytes".to_string());
        }

        let mut proposed_rect = NSRect::new(
            cocoa::foundation::NSPoint::new(0.0, 0.0),
            cocoa::foundation::NSSize::new(0.0, 0.0),
        );
        let cg_image: *mut std::ffi::c_void = msg_send![
            ns_image,
            CGImageForProposedRect: &mut proposed_rect
            context: nil
            hints: nil
        ];
        if cg_image.is_null() {
            return Err("Failed to convert NSImage to CGImage".to_string());
        }

        let options: id = msg_send![class!(NSDictionary), dictionary];
        let handler_alloc: id = msg_send![class!(VNImageRequestHandler), alloc];
        let handler: id = msg_send![handler_alloc, initWithCGImage: cg_image options: options];

        let request_alloc: id = msg_send![class!(VNRecognizeTextRequest), alloc];
        let request: id = msg_send![request_alloc, init];
        if request == nil {
            return Err("Failed to create VNRecognizeTextRequest".to_string());
        }

        // VNRequestTextRecognitionLevelAccurate = 1
        let _: () = msg_send![request, setRecognitionLevel: 1_i64];

        let requests: id = NSArray::arrayWithObject(nil, request);
        let mut error: id = nil;
        let ok: bool = msg_send![handler, performRequests: requests error: &mut error];
        if !ok {
            return Err(ns_error_message(error));
        }

        let observations: id = msg_send![request, results];
        if observations == nil {
            return Ok(String::new());
        }

        let count: usize = msg_send![observations, count];
        let mut lines = Vec::new();

        for idx in 0..count {
            let observation: id = msg_send![observations, objectAtIndex: idx];
            let candidates: id = msg_send![observation, topCandidates: 1_usize];
            if candidates == nil {
                continue;
            }

            let candidate_count: usize = msg_send![candidates, count];
            if candidate_count == 0 {
                continue;
            }

            let candidate: id = msg_send![candidates, objectAtIndex: 0_usize];
            if candidate == nil {
                continue;
            }

            let text: id = msg_send![candidate, string];
            if text == nil {
                continue;
            }

            let rust_text = nsstring_to_string(text);
            if !rust_text.is_empty() {
                lines.push(rust_text);
            }
        }

        Ok(lines.join("\n"))
    })
}

#[cfg(target_os = "macos")]
#[allow(deprecated)]
fn nsstring_to_string(ns_string: cocoa::base::id) -> String {
    use objc::{msg_send, sel, sel_impl};
    use std::ffi::CStr;
    use std::os::raw::c_char;

    unsafe {
        let c_str: *const c_char = msg_send![ns_string, UTF8String];
        if c_str.is_null() {
            String::new()
        } else {
            CStr::from_ptr(c_str).to_string_lossy().into_owned()
        }
    }
}

#[cfg(target_os = "macos")]
#[allow(deprecated)]
fn ns_error_message(error: cocoa::base::id) -> String {
    use cocoa::base::nil;
    use objc::{msg_send, sel, sel_impl};

    if error == nil {
        return "Vision OCR request failed".to_string();
    }

    unsafe {
        let description: cocoa::base::id = msg_send![error, localizedDescription];
        let text = nsstring_to_string(description);
        if text.is_empty() {
            "Vision OCR request failed".to_string()
        } else {
            text
        }
    }
}

#[cfg(not(target_os = "macos"))]
pub fn recognize_text(_png_data: &[u8]) -> Result<String, String> {
    Err("OCR is only supported on macOS".to_string())
}
