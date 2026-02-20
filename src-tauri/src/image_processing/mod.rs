/// Image processing utilities for screenshots.
///
/// Handles cropping, format conversion, and clipboard operations.

use base64::Engine;

/// Encode raw image bytes to base64 PNG for frontend display.
pub fn encode_to_base64_png(data: &[u8], width: u32, height: u32) -> Result<String, String> {
    let img = image::RgbaImage::from_raw(width, height, data.to_vec())
        .ok_or("Failed to create image from raw data")?;

    let mut buf = Vec::new();
    let mut cursor = std::io::Cursor::new(&mut buf);
    img.write_to(&mut cursor, image::ImageFormat::Png)
        .map_err(|e| e.to_string())?;

    Ok(base64::engine::general_purpose::STANDARD.encode(&buf))
}

/// Save image data to a file.
pub fn save_image(data: &[u8], width: u32, height: u32, path: &str, format: &str) -> Result<(), String> {
    let img = image::RgbaImage::from_raw(width, height, data.to_vec())
        .ok_or("Failed to create image from raw data")?;

    let fmt = match format {
        "jpg" | "jpeg" => image::ImageFormat::Jpeg,
        _ => image::ImageFormat::Png,
    };

    img.save_with_format(path, fmt).map_err(|e| e.to_string())
}
