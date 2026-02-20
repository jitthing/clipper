# Snaplark — Project Plan

## Vision

An open-source, lightweight screenshot and screen capture tool that replicates Lark's capture experience: **capture → annotate → pin → share**. macOS first, cross-platform later.

## Tech Stack Decision

### Framework: Tauri 2.0 ✅

| Criteria | Tauri 2.0 | Electron | Swift Native |
|---|---|---|---|
| Bundle size | ~3-8 MB | ~150+ MB | ~5 MB |
| Memory usage | ~58% less than Electron | High (Chromium per app) | Lowest |
| Language | Rust + Web frontend | JS/Node + Chromium | Swift/ObjC |
| Cross-platform | ✅ macOS/Win/Linux | ✅ macOS/Win/Linux | ❌ macOS only |
| Web UI for annotations | ✅ Canvas/SVG | ✅ Canvas/SVG | AppKit (harder) |
| Security | Sandboxed, no Node.js | Full Node.js access | Native sandbox |
| Dev speed | Medium (Rust compile) | Fast | Medium |

**Decision: Tauri 2.0** — Best balance of performance, small bundle, cross-platform support, and web-based annotation UI. Rust backend gives us native macOS API access (ScreenCaptureKit) with safety guarantees. Existing ecosystem (`tauri-plugin-screenshots`, `tauri-plugin-global-shortcut`) accelerates development.

### Screen Capture: macOS ScreenCaptureKit
- Apple's modern capture framework (macOS 12.3+)
- Supports window-level and display-level capture
- Hardware-accelerated, low latency
- Accessed via Rust FFI (`objc2` / `screencapturekit-rs` crates)

### Annotation Layer: HTML Canvas API
- Better performance for real-time drawing vs SVG
- Simpler hit-testing for blur/mosaic (pixel manipulation)
- Libraries: Fabric.js or custom canvas renderer
- SVG export possible for vector annotations later

### Global Hotkeys: `tauri-plugin-global-shortcut`
- Official Tauri 2.0 plugin
- Platform-native under the hood

### Frontend: React + TypeScript + Vite
- Fast dev iteration with HMR
- Rich component ecosystem
- TailwindCSS for styling

## Features Roadmap

### MVP (v0.1)
1. Global hotkey (Cmd+Shift+X) → region/window selection overlay
2. Smart window detection (auto-detect windows under cursor via Accessibility API)
3. Annotation toolbar: arrow, rectangle, circle, line, text, blur/mosaic, numbering, color picker
4. Copy to clipboard / save to file (PNG/JPG)
5. Pin to screen (floating always-on-top mini window)

### v0.2
6. Scrolling capture (auto-scroll and stitch)
7. Screen recording with webcam overlay
8. OCR text recognition (macOS Vision framework)
9. Quick share (drag to any app, upload to cloud)

### v0.3
10. Cross-platform (Windows, Linux)
11. Plugin system for custom annotation tools
12. Keyboard shortcuts customization

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Snaplark App                       │
├──────────────────────┬──────────────────────────────┤
│   Frontend (WebView) │      Rust Backend (Tauri)     │
│                      │                               │
│  ┌────────────────┐  │  ┌─────────────────────────┐ │
│  │ Capture Overlay │  │  │ capture::ScreenCapture  │ │
│  │ (fullscreen     │◄─┼─►│  - ScreenCaptureKit     │ │
│  │  transparent)   │  │  │  - Display/Window enum  │ │
│  └────────────────┘  │  └─────────────────────────┘ │
│                      │                               │
│  ┌────────────────┐  │  ┌─────────────────────────┐ │
│  │ Annotation      │  │  │ window::WindowDetector  │ │
│  │ Canvas          │  │  │  - Accessibility API     │ │
│  │  - Drawing tools│  │  │  - Window list/bounds    │ │
│  │  - Blur/mosaic  │  │  └─────────────────────────┘ │
│  └────────────────┘  │                               │
│                      │  ┌─────────────────────────┐ │
│  ┌────────────────┐  │  │ hotkey::HotkeyManager   │ │
│  │ Pin Window      │  │  │  - Global shortcuts      │ │
│  │ (always-on-top) │  │  │  - tauri-plugin-global   │ │
│  └────────────────┘  │  └─────────────────────────┘ │
│                      │                               │
│  ┌────────────────┐  │  ┌─────────────────────────┐ │
│  │ Toolbar UI      │  │  │ image::ImageProcessor   │ │
│  │  - Tools panel  │  │  │  - Crop, resize          │ │
│  │  - Settings     │  │  │  - Format conversion     │ │
│  └────────────────┘  │  │  - Clipboard ops          │ │
│                      │  └─────────────────────────┘ │
├──────────────────────┴──────────────────────────────┤
│              Tauri IPC (Commands + Events)            │
└─────────────────────────────────────────────────────┘
```

### Data Flow
1. User presses global hotkey → Rust receives via `tauri-plugin-global-shortcut`
2. Rust captures screen via ScreenCaptureKit → sends image data to frontend
3. Frontend shows fullscreen transparent overlay with captured image
4. User selects region → frontend crops and enters annotation mode
5. User annotates on Canvas → exports final image
6. Rust handles clipboard/save/pin operations via Tauri commands

## File Structure

```
snaplark/
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/
│   │   └── default.json
│   ├── icons/
│   ├── src/
│   │   ├── lib.rs              # Tauri app setup, plugin registration
│   │   ├── main.rs             # Entry point
│   │   ├── capture/
│   │   │   ├── mod.rs          # Screen capture module
│   │   │   └── macos.rs        # ScreenCaptureKit implementation
│   │   ├── window/
│   │   │   ├── mod.rs          # Window detection module
│   │   │   └── macos.rs        # Accessibility API
│   │   ├── hotkey/
│   │   │   └── mod.rs          # Global hotkey management
│   │   ├── image/
│   │   │   └── mod.rs          # Image processing, clipboard
│   │   └── commands.rs         # Tauri IPC command handlers
│   └── build.rs
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── CaptureOverlay.tsx
│   │   ├── AnnotationCanvas.tsx
│   │   ├── Toolbar.tsx
│   │   ├── PinWindow.tsx
│   │   └── ColorPicker.tsx
│   ├── hooks/
│   │   ├── useCapture.ts
│   │   └── useAnnotation.ts
│   ├── stores/
│   │   └── captureStore.ts
│   ├── utils/
│   │   └── canvas.ts
│   └── styles/
│       └── globals.css
├── public/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── README.md
├── PLAN.md
├── CONTRIBUTING.md
├── LICENSE
├── .gitignore
└── .editorconfig
```
