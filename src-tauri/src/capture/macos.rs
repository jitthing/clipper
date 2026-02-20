use std::ffi::c_void;

#[repr(C)]
struct CGRect {
    x: f64,
    y: f64,
    w: f64,
    h: f64,
}

type CGImageRef = *const c_void;
type CFDataRef = *const c_void;

#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGWindowListCreateImage(
        rect: CGRect,
        option: u32,
        window_id: u32,
        image_option: u32,
    ) -> CGImageRef;
    fn CGMainDisplayID() -> u32;
    fn CGDisplayPixelsWide(display: u32) -> usize;
    fn CGDisplayPixelsHigh(display: u32) -> usize;
    fn CGImageRelease(image: CGImageRef);
    fn CGImageGetWidth(image: CGImageRef) -> usize;
    fn CGImageGetHeight(image: CGImageRef) -> usize;
    fn CGImageGetBytesPerRow(image: CGImageRef) -> usize;
    fn CGImageGetDataProvider(image: CGImageRef) -> *const c_void;
    fn CGDataProviderCopyData(provider: *const c_void) -> CFDataRef;
}

#[link(name = "CoreFoundation", kind = "framework")]
extern "C" {
    fn CFDataGetBytePtr(data: CFDataRef) -> *const u8;
    fn CFDataGetLength(data: CFDataRef) -> isize;
    fn CFRelease(cf: *const c_void);
}

pub fn capture_screen() -> Result<Vec<u8>, String> {
    unsafe {
        let display = CGMainDisplayID();
        let w = CGDisplayPixelsWide(display) as f64;
        let h = CGDisplayPixelsHigh(display) as f64;
        capture_cg_rect(CGRect { x: 0.0, y: 0.0, w, h })
    }
}

pub fn capture_region(x: i32, y: i32, width: u32, height: u32) -> Result<Vec<u8>, String> {
    unsafe {
        capture_cg_rect(CGRect {
            x: x as f64,
            y: y as f64,
            w: width as f64,
            h: height as f64,
        })
    }
}

unsafe fn capture_cg_rect(rect: CGRect) -> Result<Vec<u8>, String> {
    // kCGWindowListOptionOnScreenOnly = 1, kCGNullWindowID = 0, kCGWindowImageDefault = 0
    let image = CGWindowListCreateImage(rect, 1, 0, 0);
    if image.is_null() {
        return Err("CGWindowListCreateImage returned null".into());
    }
    let result = cg_image_to_png(image);
    CGImageRelease(image);
    result
}

unsafe fn cg_image_to_png(image: CGImageRef) -> Result<Vec<u8>, String> {
    let width = CGImageGetWidth(image);
    let height = CGImageGetHeight(image);
    let bytes_per_row = CGImageGetBytesPerRow(image);

    let provider = CGImageGetDataProvider(image);
    if provider.is_null() {
        return Err("Failed to get data provider".into());
    }

    let data = CGDataProviderCopyData(provider);
    if data.is_null() {
        return Err("Failed to copy image data".into());
    }

    let ptr = CFDataGetBytePtr(data);
    let len = CFDataGetLength(data) as usize;
    let raw = std::slice::from_raw_parts(ptr, len);

    // Convert BGRA -> RGBA
    let mut rgba = Vec::with_capacity(width * height * 4);
    for row in 0..height {
        let row_start = row * bytes_per_row;
        for col in 0..width {
            let px = row_start + col * 4;
            if px + 3 < len {
                rgba.push(raw[px + 2]); // R
                rgba.push(raw[px + 1]); // G
                rgba.push(raw[px]);     // B
                rgba.push(raw[px + 3]); // A
            }
        }
    }
    CFRelease(data);

    // Encode to PNG
    let img = image::RgbaImage::from_raw(width as u32, height as u32, rgba)
        .ok_or("Failed to create image buffer")?;
    let mut png_bytes = Vec::new();
    let encoder = image::codecs::png::PngEncoder::new(&mut png_bytes);
    image::ImageEncoder::write_image(
        encoder,
        &img,
        width as u32,
        height as u32,
        image::ExtendedColorType::Rgba8,
    )
    .map_err(|e| format!("PNG encode error: {e}"))?;

    Ok(png_bytes)
}
