use super::WindowInfo;
use std::ffi::{c_void, CStr, CString};

// CoreFoundation types
type CFArrayRef = *const c_void;
type CFDictionaryRef = *const c_void;
type CFStringRef = *const c_void;
type CFTypeRef = *const c_void;
type CFIndex = isize;

#[repr(C)]
struct CGRect {
    origin_x: f64,
    origin_y: f64,
    size_w: f64,
    size_h: f64,
}

const UTF8: u32 = 0x08000100;

#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGWindowListCopyWindowInfo(option: u32, relative_to: u32) -> CFArrayRef;
    fn CGRectMakeWithDictionaryRepresentation(dict: CFDictionaryRef, rect: *mut CGRect) -> bool;
}

#[link(name = "CoreFoundation", kind = "framework")]
extern "C" {
    fn CFArrayGetCount(array: CFArrayRef) -> CFIndex;
    fn CFArrayGetValueAtIndex(array: CFArrayRef, index: CFIndex) -> *const c_void;
    fn CFDictionaryGetValue(dict: CFDictionaryRef, key: CFTypeRef) -> *const c_void;
    fn CFStringCreateWithCString(alloc: *const c_void, s: *const i8, enc: u32) -> CFStringRef;
    fn CFStringGetCStringPtr(s: CFStringRef, enc: u32) -> *const i8;
    fn CFStringGetCString(s: CFStringRef, buf: *mut i8, size: CFIndex, enc: u32) -> bool;
    fn CFNumberGetValue(num: *const c_void, typ: i32, out: *mut c_void) -> bool;
    fn CFRelease(cf: CFTypeRef);
}

unsafe fn cf_str(s: &str) -> CFStringRef {
    let cs = CString::new(s).unwrap();
    CFStringCreateWithCString(std::ptr::null(), cs.as_ptr(), UTF8)
}

unsafe fn dict_get_string(dict: CFDictionaryRef, key: &str) -> Option<String> {
    let k = cf_str(key);
    let val = CFDictionaryGetValue(dict, k);
    CFRelease(k);
    if val.is_null() { return None; }
    let ptr = CFStringGetCStringPtr(val as CFStringRef, UTF8);
    if !ptr.is_null() {
        return Some(CStr::from_ptr(ptr).to_string_lossy().into_owned());
    }
    let mut buf = [0i8; 512];
    if CFStringGetCString(val as CFStringRef, buf.as_mut_ptr(), 512, UTF8) {
        Some(CStr::from_ptr(buf.as_ptr()).to_string_lossy().into_owned())
    } else {
        None
    }
}

unsafe fn dict_get_f64(dict: CFDictionaryRef, key: &str) -> Option<f64> {
    let k = cf_str(key);
    let val = CFDictionaryGetValue(dict, k);
    CFRelease(k);
    if val.is_null() { return None; }
    let mut out: f64 = 0.0;
    if CFNumberGetValue(val, 13 /* kCFNumberFloat64Type */, &mut out as *mut f64 as *mut c_void) {
        Some(out)
    } else {
        None
    }
}

unsafe fn dict_get_bounds(dict: CFDictionaryRef) -> Option<(f64, f64, f64, f64)> {
    let k = cf_str("kCGWindowBounds");
    let val = CFDictionaryGetValue(dict, k);
    CFRelease(k);
    if val.is_null() { return None; }
    let mut rect = CGRect { origin_x: 0.0, origin_y: 0.0, size_w: 0.0, size_h: 0.0 };
    if CGRectMakeWithDictionaryRepresentation(val, &mut rect) {
        Some((rect.origin_x, rect.origin_y, rect.size_w, rect.size_h))
    } else {
        None
    }
}

pub fn list_windows() -> Result<Vec<WindowInfo>, String> {
    unsafe {
        // kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements
        let list = CGWindowListCopyWindowInfo(1 | 16, 0);
        if list.is_null() {
            return Err("Failed to get window list".into());
        }

        let count = CFArrayGetCount(list);
        let mut windows = Vec::new();

        for i in 0..count {
            let dict = CFArrayGetValueAtIndex(list, i);
            let layer = dict_get_f64(dict, "kCGWindowLayer").unwrap_or(-1.0) as i32;
            if layer != 0 { continue; }

            let Some(bounds) = dict_get_bounds(dict) else { continue };
            if bounds.2 < 50.0 || bounds.3 < 50.0 { continue; }

            let window_id = dict_get_f64(dict, "kCGWindowNumber").unwrap_or(0.0) as u32;
            windows.push(WindowInfo {
                id: window_id,
                title: dict_get_string(dict, "kCGWindowName").unwrap_or_default(),
                app_name: dict_get_string(dict, "kCGWindowOwnerName").unwrap_or_default(),
                x: bounds.0,
                y: bounds.1,
                width: bounds.2,
                height: bounds.3,
            });
        }

        CFRelease(list);
        Ok(windows)
    }
}
