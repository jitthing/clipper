# Snaplark Windows Support PRD

## 1. Executive Summary

### Goal
Add first-class Windows support to Snaplark (Tauri 2.0, Rust + React/TypeScript) while preserving the existing capture UX: `Capture -> Annotate -> Copy/Save/Pin`.

### Current State (as of March 6, 2026)
- Core capture, permission checks, window listing, clipboard, and OCR are macOS-centric in Rust.
- Non-macOS paths mostly return placeholders or generic errors.
- Frontend is largely platform-neutral and can be reused with targeted UX copy and behavior updates.

### Target Scope for Windows v1
- Global hotkey trigger (`CommandOrControl+Shift+X` -> `Ctrl+Shift+X` behavior on Windows).
- Full-screen capture and region capture.
- Window listing and window-frame capture.
- Clipboard copy (PNG).
- Pin window flow parity.
- Permission/settings UX adapted for Windows privacy model.
- OCR support on Windows (functional parity target, with phased fallback if needed).

### Non-Goals (v1)
- Linux support.
- Pixel-perfect parity of OCR quality with macOS Vision on day one.
- Multi-monitor advanced workflows (defer to v1.1 if needed).

---

## 2. Platform-Specific Analysis (Module-by-Module Changes)

### `src-tauri/src/capture/macos.rs` and `src-tauri/src/capture/mod.rs`
Current:
- Uses CoreGraphics (`CGWindowListCreateImage`) to capture full screen/region.
- `capture/mod.rs` only wires macOS implementation; others return errors/default dimensions.

Windows changes:
- Add `src-tauri/src/capture/windows.rs` with Windows Desktop Duplication API (DXGI) primary path.
- Add fallback path using Windows Graphics Capture (WGC) or GDI BitBlt if duplication fails in edge cases.
- Normalize output to PNG bytes (`Vec<u8>`) exactly like current API.
- Update `capture/mod.rs`:
  - `#[cfg(target_os = "windows")] pub mod windows;`
  - Route `capture_full_screen`, `capture_region`, and `screen_size` to Windows implementation.
- Handle DPI scaling consistently (physical pixels for backend; frontend overlay math aligned via reported screen size).

### `src-tauri/src/permissions/macos.rs` and `src-tauri/src/permissions/mod.rs`
Current:
- macOS-specific privacy checks (Screen Recording + Accessibility).
- Non-macOS returns both permissions as granted.

Windows changes:
- Add `src-tauri/src/permissions/windows.rs`.
- Replace fake “always granted” behavior on Windows with real status model:
  - `screen_recording_granted`: inferred from API availability/capture probe.
  - `accessibility_granted`: based on UI Automation capability probe (if needed for window metadata quality).
- Implement settings deep-links with `ms-settings:` URIs.
- Update `permissions/mod.rs` cfg routing for Windows.
- Update frontend permission copy to avoid macOS-only wording and clarify Windows semantics (privacy toggles may not present identical prompts).

### `src-tauri/src/window/macos.rs` and `src-tauri/src/window/mod.rs`
Current:
- Uses `CGWindowListCopyWindowInfo` and related CF parsing.
- Non-macOS returns unimplemented error.

Windows changes:
- Add `src-tauri/src/window/windows.rs` using `EnumWindows`, `GetWindowTextW`, `GetWindowThreadProcessId`, `GetWindowRect`, visibility/minimized filters.
- Resolve process names via `OpenProcess` + `QueryFullProcessImageNameW` (or equivalent).
- Filter out tool/overlay/self windows to avoid recursive capture.
- Update `window/mod.rs` cfg routing for Windows.

### `src-tauri/src/ocr.rs`
Current:
- macOS Vision framework via Objective-C FFI.
- Non-macOS returns unsupported error.

Windows changes:
- Split into platform modules:
  - `ocr/macos.rs` (existing logic)
  - `ocr/windows.rs`
  - `ocr/mod.rs`
- Implement Windows OCR path using Windows Media OCR (`Windows.Media.Ocr`) via WinRT bindings (`windows` crate).
- Keep command contract unchanged: input PNG bytes, output newline-joined text.
- Add feature flag/fallback:
  - If OCR API unavailable, return explicit actionable error (not generic unsupported).

### `src-tauri/src/clipboard.rs`
Current:
- macOS NSPasteboard API.
- Non-macOS returns unsupported error.

Windows changes:
- Add Windows path using Win32 clipboard API (`OpenClipboard`, `EmptyClipboard`, `SetClipboardData`) with `CF_DIB`/bitmap conversion from PNG.
- Keep API signature unchanged (`copy_image_to_clipboard(png_data: &[u8])`).
- Ensure memory ownership and global allocation semantics are correct for clipboard transfer.

### `src-tauri/src/hotkey/`
Current:
- Uses `tauri-plugin-global-shortcut` and `CommandOrControl` abstraction.
- Parsing/validation already includes Windows-friendly branch for `CommandOrControl`.

Windows changes:
- Verify reserved/system hotkey conflicts on Windows; extend conflict messaging if needed.
- Ensure tray menu copy for recording shortcut is platform-aware (`Ctrl+Shift+R` label on Windows).
- Add Windows integration tests for persisted hotkey loading and registration failure recovery.

### Frontend (React 18 + TS + Tailwind + Zustand)
Current:
- Platform-neutral core UX.
- Permission panel text and actions are macOS-oriented.

Windows changes:
- Make permission text conditional by platform.
- Keep command names unchanged; backend provides platform behavior.
- Validate overlay positioning/sizing on high-DPI and multi-display Windows setups.
- Ensure pin window behavior is equivalent (always-on-top, resize, drag, close).

### Bootstrap / Build / CI
Current:
- Cargo has macOS-specific deps for OCR only.
- CI/release workflows are macOS-only.

Windows changes:
- Add Windows-specific dependencies (`windows` crate + needed Win32/WinRT feature flags).
- Extend CI matrix to run typecheck/build/tests on `windows-latest`.
- Add Windows preview artifacts and release packaging in release workflow.

---

## 3. Windows API Equivalents for macOS APIs in Use

| Current macOS API | Used For | Windows Equivalent | Notes |
|---|---|---|---|
| `CGWindowListCreateImage` | Full/region capture | DXGI Desktop Duplication (`IDXGIOutputDuplication`) | Primary high-performance capture path. |
| `CGMainDisplayID`, `CGDisplayPixelsWide/High` | Screen dimensions | `GetSystemMetrics` / monitor APIs (`EnumDisplayMonitors`, `GetMonitorInfo`) | Use physical pixel dimensions; account for DPI scaling. |
| `CGImage*` + `CGDataProviderCopyData` | Raw pixel extraction | `ID3D11Texture2D` map/copy or `GetDIBits` fallback | Convert to RGBA then PNG encode via existing `image` crate path. |
| `CGPreflightScreenCaptureAccess` / `CGRequestScreenCaptureAccess` | Screen permission status/prompt | Windows privacy settings + capture probe | Windows does not mirror macOS prompt model exactly. |
| `AXIsProcessTrusted` / `AXIsProcessTrustedWithOptions` | Accessibility trust | UI Automation availability/probe | May be optional for v1 if using Win32 window enum only. |
| `open x-apple.systempreferences:...` | Open settings pages | `ShellExecuteW("ms-settings:...")` | Use deep links to privacy/accessibility settings where available. |
| `CGWindowListCopyWindowInfo` | Window enumeration | `EnumWindows` + `GetWindowRect` + `GetWindowTextW` + process APIs | Apply filtering for visible/top-level windows. |
| `CGRectMakeWithDictionaryRepresentation` | Parse window bounds | `GetWindowRect` / `DwmGetWindowAttribute` | Use extended frame bounds for accurate capture regions. |
| macOS Vision (`VNRecognizeTextRequest`) | OCR | WinRT `Windows.Media.Ocr.OcrEngine` | Language pack availability affects results. |
| `NSPasteboard` image write | Clipboard PNG | Win32 Clipboard (`OpenClipboard`, `SetClipboardData`) | Convert PNG bytes into clipboard-compatible bitmap format. |
| `tauri::ActivationPolicy::Accessory` (macOS-only) | Menubar/activation behavior | N/A (Windows-specific tray behavior via Tauri defaults) | Ensure startup/minimize-to-tray UX remains consistent. |

---

## 4. Implementation Phases (Phased Rollout)

### Phase 0: Architecture and Scaffolding (3-5 days)
- Add Windows module scaffolds:
  - `capture/windows.rs`, `permissions/windows.rs`, `window/windows.rs`, `ocr/windows.rs`.
- Refactor `ocr.rs` into platform module structure.
- Add cfg routing in `mod.rs` files.
- Add dependency/features in `Cargo.toml`.
- Add Windows build job in CI (compile + tests smoke).

Exit criteria:
- `cargo build` passes on macOS and Windows.
- Existing macOS behavior unchanged.

### Phase 1: Capture + Clipboard MVP (5-8 days)
- Implement Windows full-screen capture and region crop pipeline.
- Implement `screen_size()` with accurate DPI-aware dimensions.
- Implement Windows clipboard image copy.
- Validate overlay flow end-to-end (`trigger_capture`, `complete_capture`, copy).

Exit criteria:
- User can hotkey capture region and copy to clipboard on Windows.
- No crashes in 30-run manual capture stress test.

### Phase 2: Window Detection + Window Capture (4-6 days)
- Implement `list_windows` Windows backend.
- Implement robust filtering (invisible/minimized/system windows/self overlays).
- Validate `capture_window_frame` works against common apps (Browser, VS Code, Explorer).

Exit criteria:
- Window list usable and accurate enough for daily workflows.
- Window-frame capture success >=95% across target app set.

### Phase 3: Permissions UX + Settings Deep Links (2-4 days)
- Implement Windows permission status semantics and settings openers.
- Update frontend `PermissionPanel` copy/actions for platform-aware behavior.
- Ensure app does not block workflow unnecessarily if Windows reports permissive defaults.

Exit criteria:
- Permission panel displays correct platform wording and actionable buttons.
- No macOS regression.

### Phase 4: OCR on Windows (5-8 days)
- Implement WinRT OCR path and language handling.
- Add graceful fallback/error surfaces when OCR services unavailable.
- Benchmark OCR latency and result quality against baseline samples.

Exit criteria:
- OCR command functional on supported Windows configurations.
- Clear user-visible error when unsupported/misconfigured.

### Phase 5: Hardening + Release Readiness (4-6 days)
- Cross-platform test pass (unit, integration smoke, manual matrix).
- Packaging/signing pipeline updates for Windows installer.
- Documentation updates (README/platform matrix/troubleshooting).

Exit criteria:
- Windows preview artifact from CI.
- Release checklist signed off.

---

## 5. Risk Assessment

### High Risks
1. Capture API reliability across GPU/drivers
- Risk: DXGI duplication can fail on some hardware/session states.
- Mitigation: fallback capture path, retries, telemetry/logging with error taxonomy.

2. DPI and coordinate mismatches
- Risk: Overlay selection coordinates may not match captured bitmap on scaled displays.
- Mitigation: define canonical coordinate space; add DPI-aware conversion tests; validate on 100%/125%/150%/200%.

3. OCR dependency variability
- Risk: WinRT OCR availability/language packs differ by system.
- Mitigation: capability checks, explicit setup guidance, fallback behavior.

### Medium Risks
1. Window enumeration accuracy
- Risk: Wrong bounds for borderless/UWP/elevated windows.
- Mitigation: combine `GetWindowRect` with DWM frame bounds; maintain exclusion filters.

2. Clipboard bitmap conversion bugs
- Risk: incorrect alpha/pixel format causing blank or corrupted paste.
- Mitigation: integration tests (paste into Paint, Office, browser editors), strict format conversion path.

3. Hotkey conflicts
- Risk: Windows-reserved combos and third-party conflicts.
- Mitigation: conflict detection messaging; default shortcut validation; fallback reset path.

### Low Risks
1. Frontend portability
- Risk: minor UI copy mismatch.
- Mitigation: platform-conditional strings and QA pass.

---

## 6. Testing Strategy

### Unit Tests (Rust)
- Hotkey parse/normalize and platform-specific modifier mapping.
- Capture region boundary checks and PNG encode integrity.
- Window filtering logic (visibility, size threshold, self-window exclusions).
- Permission status mapper behavior on mocked API responses.

### Integration Tests (Rust/Tauri)
- Invoke command smoke on Windows:
  - `capture_screen`, `capture_region`, `copy_to_clipboard`, `list_windows`, `capture_window_frame`, `ocr_image`.
- Validate returned payloads are non-empty and parseable where expected.

### Frontend Tests
- Permission panel behavior based on mocked platform/status.
- Overlay lifecycle events (`screenshot-ready`, `capture-complete`) unchanged across platforms.

### Manual QA Matrix
- Windows 10 (22H2), Windows 11 (23H2/24H2).
- Single and multi-monitor.
- DPI scales: 100%, 125%, 150%, 200%.
- GPU vendors: Intel, NVIDIA, AMD (at least one test machine each if available).
- Apps for window capture: Chrome/Edge, VS Code, Explorer, Office, UWP app.

### Regression Coverage (macOS)
- Full capture and region capture.
- Permissions onboarding.
- OCR and clipboard.
- Global hotkey customization.

### CI/CD
- Add `windows-latest` to CI build/test matrix.
- Add Windows preview artifacts for PRs.
- Add Windows release artifacts for tags.

---

## 7. Timeline Estimates

### Engineering Estimate (single engineer)
- Phase 0: 0.5-1 week
- Phase 1: 1-1.5 weeks
- Phase 2: 0.75-1 week
- Phase 3: 0.5 week
- Phase 4: 1-1.5 weeks
- Phase 5: 0.75-1 week

Total: **4.5 to 6.5 weeks** (single engineer, includes QA/hardening).

### Team Estimate (2 engineers: platform + frontend/qa support)
Total: **3 to 4.5 weeks** with parallelization of Phases 2-4 and earlier QA.

### Milestone Plan
- Milestone A (end of week 2): Windows capture + clipboard MVP.
- Milestone B (end of week 3): Window capture + permissions UX parity.
- Milestone C (end of week 4/5): OCR + release-ready Windows artifacts.

---

## Appendix: Proposed File-Level Worklist

Rust:
- `src-tauri/src/capture/mod.rs` (Windows routing)
- `src-tauri/src/capture/windows.rs` (new)
- `src-tauri/src/window/mod.rs` (Windows routing)
- `src-tauri/src/window/windows.rs` (new)
- `src-tauri/src/permissions/mod.rs` (Windows routing)
- `src-tauri/src/permissions/windows.rs` (new)
- `src-tauri/src/ocr.rs` -> `src-tauri/src/ocr/mod.rs` + `ocr/macos.rs` + `ocr/windows.rs`
- `src-tauri/src/clipboard.rs` (Windows implementation or split)
- `src-tauri/Cargo.toml` (Windows deps/features)
- `src-tauri/src/lib.rs` (platform-specific tray/menu labels where needed)

Frontend:
- `src/components/PermissionPanel.tsx` (platform-aware copy/actions)
- `src/App.tsx` (platform conditionals if needed)

CI/Release:
- `.github/workflows/ci.yml` (Windows matrix)
- `.github/workflows/release.yml` (Windows preview + release artifacts)
