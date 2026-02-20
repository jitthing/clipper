# 📸 Snaplark

A lightweight, open-source screenshot and screen capture tool inspired by Lark's capture experience. **Capture → Annotate → Pin → Share.**

Built with [Tauri 2.0](https://v2.tauri.app/) (Rust + React + TypeScript).

![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-macOS-lightgrey)
![Status](https://img.shields.io/badge/status-in%20development-orange)

<!-- TODO: Add screenshot/demo GIF here -->

## Features

### MVP (v0.1) — In Progress
- [ ] Global hotkey (`⌘⇧X`) → region/window selection overlay
- [ ] Smart window detection (auto-detect windows under cursor)
- [ ] Annotation toolbar: arrow, rectangle, circle, line, text, blur/mosaic, numbering
- [ ] Color picker for annotations
- [ ] Copy to clipboard / save to file (PNG/JPG)
- [ ] Pin screenshot to screen (floating always-on-top window)

### Planned
- [ ] Scrolling capture (auto-scroll and stitch)
- [ ] Screen recording with webcam overlay
- [ ] OCR text recognition (macOS Vision framework)
- [ ] Quick share (drag to app, upload to cloud)
- [ ] Cross-platform support (Windows, Linux)
- [ ] Plugin system for custom tools
- [ ] Keyboard shortcuts customization

## Tech Stack

| Component | Technology |
|---|---|
| Framework | Tauri 2.0 |
| Backend | Rust |
| Frontend | React + TypeScript + Vite |
| Styling | TailwindCSS |
| Screen Capture | macOS ScreenCaptureKit |
| Annotations | HTML Canvas API |
| State Management | Zustand |

## Getting Started

### Prerequisites

- [Rust](https://rustup.rs/) (latest stable)
- [Node.js](https://nodejs.org/) (v18+)
- macOS 12.3+ (for ScreenCaptureKit)

### Development

```bash
# Clone the repository
git clone https://github.com/jitthing/snaplark.git
cd snaplark

# Install dependencies
npm install

# Run in development mode
npm run tauri dev
```

### Build

```bash
# Build for production
npm run tauri build
```

The built app will be in `src-tauri/target/release/bundle/`.

## Project Structure

```
snaplark/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── hooks/              # Custom React hooks
│   ├── stores/             # Zustand state stores
│   ├── utils/              # Canvas drawing utilities
│   └── styles/             # Global styles
├── src-tauri/              # Rust backend
│   └── src/
│       ├── capture/        # Screen capture (ScreenCaptureKit)
│       ├── window/         # Window detection (Accessibility API)
│       ├── hotkey/         # Global hotkey management
│       ├── image_processing/ # Image manipulation
│       └── commands.rs     # Tauri IPC command handlers
└── PLAN.md                 # Detailed project plan
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[MIT](LICENSE) © jitthing
