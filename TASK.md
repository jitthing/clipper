# Issue #19: Quick Actions (OCR, Copy, Download/Export)

## Objective
Add OCR text extraction via macOS Vision framework, improve save UX with sensible defaults, and add loading states for async actions.

## What Already Works (DO NOT BREAK)
- Copy to clipboard: `copy_to_clipboard` command in `src-tauri/src/commands.rs` → `clipboard.rs`
- Save to file: `save_to_file` command + `SaveDialog.tsx` with format picker
- Pin screenshot: works via `pin_screenshot` command
- Floating toolbar with onCopy, onSave, onPin, onCloseWindow props

## Tasks

### 1. OCR via macOS Vision framework (`src-tauri/src/ocr.rs`)
Create a new `ocr.rs` module that uses Apple's Vision framework for text recognition:
- Use `objc` crate (already a dependency) to call VNRecognizeTextRequest
- Function: `pub fn recognize_text(png_data: &[u8]) -> Result<String, String>`
- Steps:
  1. Create NSImage/CGImage from PNG data
  2. Create VNImageRequestHandler with the image
  3. Create VNRecognizeTextRequest
  4. Set recognition level to accurate (VNRequestTextRecognitionLevelAccurate = 1)
  5. Perform request, collect results from VNRecognizedTextObservation
  6. Return concatenated text with newlines between observations
- Add `#[cfg(target_os = "macos")]` gate
- Non-macOS stub returns error

### 2. Tauri command for OCR (`src-tauri/src/commands.rs`)
- Add `#[tauri::command] pub fn ocr_image(image_data: String) -> Result<String, String>`
- Decodes base64 PNG, calls `ocr::recognize_text`, returns extracted text
- Register in `lib.rs` invoke_handler

### 3. OCR UI in frontend
- Add OCR button to FloatingToolbar (📝 or similar icon, tooltip "OCR")
- Add `onOcr` prop to FloatingToolbar
- In App.tsx: `handleOcr` function that:
  1. Composites annotations onto image (use `exportCanvas` from canvas.ts)
  2. Strips data URL prefix, calls `invoke("ocr_image", { imageData: base64 })`
  3. Shows result in a modal/popover with the extracted text
  4. "Copy Text" button copies OCR result to system clipboard (use navigator.clipboard.writeText)
- Show loading spinner on OCR button while processing
- Show error toast if OCR fails

### 4. Improve Save UX
- Update `handleSave` in App.tsx:
  - Default save path: `~/Downloads/snaplark-YYYYMMDD-HHMMSS.png`
  - Still use Tauri save dialog but pre-fill the default path/filename
  - If dialog is cancelled, do nothing (don't show error)
- The `SaveDialog` component can stay as-is for format selection

### 5. Loading States
- Add loading state for Copy button (brief checkmark ✓ after success, then revert)
- Add loading state for OCR button (spinner while processing)
- Add toast/notification component for success/error feedback
  - "Copied to clipboard!" toast
  - "Saved to ~/Downloads/..." toast
  - "OCR failed: ..." error toast
- Toast: small dark pill that appears above the floating toolbar, auto-dismisses after 2s

### 6. Keyboard Shortcuts
- Add these to the existing keyboard handler in AnnotationCanvas or App.tsx:
  - Cmd+T or Cmd+Shift+T: trigger OCR

## Build Requirements
- `npx tsc --noEmit` must pass
- `npm run build` must pass
- `cargo fmt --check` must pass
- `cargo clippy -- -D warnings` must pass (use #[allow] if needed for objc macro warnings)

## Framework Linking
In `src-tauri/build.rs`, add:
```rust
println!("cargo:rustc-link-lib=framework=Vision");
println!("cargo:rustc-link-lib=framework=AppKit");
```
(AppKit may already be linked via cocoa crate, but Vision needs explicit linking)

## Files to Create/Modify
- CREATE: `src-tauri/src/ocr.rs`
- MODIFY: `src-tauri/src/lib.rs` (add mod ocr, register command)
- MODIFY: `src-tauri/src/commands.rs` (add ocr_image command)
- MODIFY: `src-tauri/build.rs` (link Vision framework)
- MODIFY: `src/components/FloatingToolbar.tsx` (add OCR button, onOcr prop, loading states)
- MODIFY: `src/App.tsx` (handleOcr, improved handleSave, toast state)
- CREATE: `src/components/Toast.tsx` (lightweight toast notification)

## When Done
- Commit with message: "feat: OCR, improved save, loading states (#19)"
- Push to origin
- Run: openclaw system event --text "Done: Issue #19 quick actions — OCR via Vision, save defaults, toasts" --mode now
