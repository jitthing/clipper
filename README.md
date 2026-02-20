# 📸 Snaplark

A lightweight, open-source screenshot and screen capture tool that replicates Lark's capture experience: **Capture → Annotate → Pin → Share.**

Built with [Tauri 2.0](https://v2.tauri.app/) — Rust backend, React + TypeScript frontend. Tiny bundle (~5 MB), native performance, macOS first.

![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-macOS-lightgrey)
![Status](https://img.shields.io/badge/status-in%20development-orange)
![CI](https://github.com/jitthing/snaplark/actions/workflows/ci.yml/badge.svg)

## Features

### MVP (v0.1)

| Feature | Status |
|---|---|
| Global hotkey (`⌘⇧X`) → region selection overlay | 🚧 In Progress |
| Smart window detection (Accessibility API) | 🚧 In Progress |
| Annotation toolbar (arrow, rect, circle, line, text, blur, numbering) | 🚧 In Progress |
| Color picker | 🚧 In Progress |
| Copy to clipboard (⌘C) | ✅ Done |
| Save to file (PNG/JPG) | 🚧 In Progress |
| Pin screenshot to screen (always-on-top, draggable, resizable) | ✅ Done |

### Planned (v0.2+)

| Feature | Status |
|---|---|
| Scrolling capture | 📋 Planned |
| Screen recording + webcam overlay | 📋 Planned |
| OCR text recognition (macOS Vision) | 📋 Planned |
| Quick share (drag to app, cloud upload) | 📋 Planned |
| Cross-platform (Windows, Linux) | 📋 Planned |
| Plugin system | 📋 Planned |
| Keyboard shortcuts customization | 📋 Planned |

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

## Getting Started

### Prerequisites

- **macOS 12.3+** (required for ScreenCaptureKit)
- [Rust](https://rustup.rs/) (latest stable)
- [Node.js](https://nodejs.org/) v18+
- Xcode Command Line Tools (`xcode-select --install`)

### Development Setup

```bash
# Clone the repository
git clone https://github.com/jitthing/snaplark.git
cd snaplark

# Install frontend dependencies
npm install

# Run in development mode (starts both Vite dev server and Tauri)
npm run tauri dev
```

### Build from Source

```bash
# Production build
npm run tauri build

# Output locations:
#   macOS app:  src-tauri/target/release/bundle/macos/Snaplark.app
#   DMG:        src-tauri/target/release/bundle/dmg/Snaplark_0.1.0_aarch64.dmg
```

### Project Structure

```
snaplark/
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
