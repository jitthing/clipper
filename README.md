# 📸 Clipper

A lightweight, open-source screenshot and screen capture tool that replicates Lark's capture experience: **Capture → Annotate → Pin → Share.**

Built with [Tauri 2.0](https://v2.tauri.app/) — Rust backend, React + TypeScript frontend. Tiny bundle (~5 MB), native performance, macOS first.

![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-macOS-lightgrey)
![Status](https://img.shields.io/badge/status-in%20development-orange)
![CI](https://github.com/jitthing/clipper/actions/workflows/ci.yml/badge.svg)

## Features

### MVP (v0.1)

| Feature | Status |
|---|---|
| Background/menubar mode + global hotkey (`⌘⇧X`) | ✅ Done |
| Instant capture overlay UX (`ESC` dismiss) | ✅ Done |
| First-run permissions onboarding (Screen Recording + Accessibility status) | ✅ Done |
| Smart window detection (window metadata via macOS window APIs) | ✅ Done |
| Annotation toolbar (arrow, rect, circle, line, text, blur, numbering) | ✅ Done |
| Color picker | ✅ Done |
| Copy to clipboard (⌘C) | ✅ Done |
| Save to file (PNG/JPG) | ✅ Done |
| Pin screenshot to screen (always-on-top, draggable, resizable) | ✅ Done |
| OCR text recognition (macOS Vision) | ✅ Done |

### Roadmap (v0.2+)

| Feature | Status |
|---|---|
| Scrolling capture (scrollshot) | 🚧 Iterating |
| Screen recording + webcam overlay | ✅ Done ([#29](https://github.com/jitthing/clipper/issues/29), [#36](https://github.com/jitthing/clipper/pull/36)) |
| Quick share (upload + copy link + retry UX) | 📋 Planned ([#30](https://github.com/jitthing/clipper/issues/30)) |
| Keyboard shortcuts customization | 📋 Planned ([#31](https://github.com/jitthing/clipper/issues/31)) |
| Plugin/extensibility system | 📋 Planned ([#32](https://github.com/jitthing/clipper/issues/32)) |
| Cross-platform (Windows/Linux abstraction) | 📋 Planned ([#33](https://github.com/jitthing/clipper/issues/33)) |

Tracking epic: [#28 — v0.2 roadmap](https://github.com/jitthing/clipper/issues/28)

## Screenshots

<!-- TODO: Add screenshot/demo GIF here -->
> Screenshots coming soon.

## Tech Stack

| Component | Technology |
|---|---|
| Framework | Tauri 2.0 |
| Backend | Rust |
| Frontend | React 18 + TypeScript + Vite |
| Styling | TailwindCSS |
| Screen Capture | macOS ScreenCaptureKit |
| Annotations | HTML Canvas API |
| State Management | Zustand |

## Install (No Rust Required)

If you only want to use Clipper, you **do not** need Rust or Node.

### Option A — Download app from GitHub Releases

1. Go to [Releases](https://github.com/jitthing/clipper/releases)
2. Download the latest macOS `.dmg`
3. Open the DMG and drag **Clipper.app** to Applications

### Option B — Homebrew (planned)

Homebrew Cask support is planned so users can install with a single command.
Until then, use the DMG from Releases.

## Getting Started

### Prerequisites

- **macOS 12.3+** (required for ScreenCaptureKit)
- [Rust](https://rustup.rs/) (latest stable)
- [Node.js](https://nodejs.org/) v18+
- Xcode Command Line Tools (`xcode-select --install`)

### Development Setup

```bash
# Clone the repository
git clone https://github.com/jitthing/clipper.git
cd clipper

# Install frontend dependencies
npm install

# Run in development mode (starts both Vite dev server and Tauri)
npm run tauri dev
```

### Usage

1. Clipper runs in background/menubar mode.
2. Press `⌘⇧X` from anywhere to open the capture overlay.
3. Press `⌘⇧X` again (or `ESC`) to dismiss the overlay.
4. Drag to capture a region, then annotate/copy/save/pin.

### macOS Permissions (First Run)

Clipper checks permission state and shows an in-app onboarding panel when access is missing.

Required:
- Screen Recording (needed for screenshot capture)

Recommended:
- Accessibility (improves window metadata and selection UX)

If capture fails or status is missing:
1. Open Clipper from the tray icon.
2. Use the in-app permission panel buttons:
   - `Request Screen Recording`
   - `Open Screen Settings`
   - `Request Accessibility`
   - `Open Accessibility Settings`
3. After granting access in System Settings, click `Refresh Status`.

### Build from Source

```bash
# Production build
npm run tauri build

# Output locations:
#   macOS app:  src-tauri/target/release/bundle/macos/Clipper.app
#   DMG:        src-tauri/target/release/bundle/dmg/Clipper_0.1.0_aarch64.dmg
```

### CI Distribution Pipelines

- `release.yml` publishes GitHub Release app bundles on version tags (`v*`).
- The same workflow also builds macOS preview artifacts on every PR, so testers can download and run Clipper without local Rust setup.

### Project Structure

```
clipper/
├── src/                        # React frontend
│   ├── components/
│   │   ├── CaptureOverlay.tsx  # Region selection overlay
│   │   ├── AnnotationCanvas.tsx# Canvas drawing layer
│   │   ├── Toolbar.tsx         # Tool bar (copy, save, pin)
│   │   ├── PinWindow.tsx       # Pinned screenshot window
│   │   └── ColorPicker.tsx     # Color selection
│   ├── hooks/                  # Custom React hooks
│   ├── stores/                 # Zustand state stores
│   └── utils/                  # Canvas utilities
├── src-tauri/                  # Rust backend
│   └── src/
│       ├── capture/            # ScreenCaptureKit integration
│       ├── window/             # Window detection (Accessibility API)
│       ├── hotkey/             # Global hotkey management
│       ├── clipboard.rs        # macOS clipboard (NSPasteboard)
│       ├── image_processing/   # Image encoding & conversion
│       └── commands.rs         # Tauri IPC commands
├── docs/
│   └── ARCHITECTURE.md         # System architecture documentation
└── .github/workflows/          # CI/CD pipelines
```

For detailed architecture documentation, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[MIT](LICENSE) © jitthing
