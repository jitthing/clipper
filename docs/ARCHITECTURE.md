# Clipper Architecture

## System Overview

```
┌──────────────────────────────────────────────────────────────┐
│                        Clipper App                           │
├─────────────────────────────┬────────────────────────────────┤
│    Frontend (WebView/React) │     Backend (Rust/Tauri 2.0)   │
│                             │                                │
│  ┌───────────────────────┐  │  ┌──────────────────────────┐  │
│  │   CaptureOverlay      │  │  │  capture/                │  │
│  │   - Region selection   │◄─┼─►│  - ScreenCaptureKit      │  │
│  │   - Crosshair cursor   │  │  │  - Display & window enum │  │
│  └───────────────────────┘  │  └──────────────────────────┘  │
│                             │                                │
│  ┌───────────────────────┐  │  ┌──────────────────────────┐  │
│  │   AnnotationCanvas    │  │  │  window/                 │  │
│  │   - Drawing tools      │  │  │  - Accessibility API     │  │
│  │   - Canvas API         │  │  │  - Window bounds/list    │  │
│  └───────────────────────┘  │  └──────────────────────────┘  │
│                             │                                │
│  ┌───────────────────────┐  │  ┌──────────────────────────┐  │
│  │   Toolbar             │  │  │  clipboard               │  │
│  │   - Tool selection     │  │  │  - NSPasteboard API      │  │
│  │   - Copy / Save / Pin  │  │  │  - PNG image copy        │  │
│  └───────────────────────┘  │  └──────────────────────────┘  │
│                             │                                │
│  ┌───────────────────────┐  │  ┌──────────────────────────┐  │
│  │   PinWindow           │  │  │  hotkey/                 │  │
│  │   - Frameless window   │  │  │  - Global shortcuts      │  │
│  │   - Always-on-top      │  │  │  - tauri-plugin-global   │  │
│  │   - Draggable/resize   │  │  └──────────────────────────┘  │
│  └───────────────────────┘  │                                │
│                             │  ┌──────────────────────────┐  │
│                             │  │  image_processing/       │  │
│                             │  │  - PNG encode/decode      │  │
│                             │  │  - Format conversion      │  │
│                             │  └──────────────────────────┘  │
├─────────────────────────────┴────────────────────────────────┤
│                 Tauri IPC (Commands + Events)                 │
└──────────────────────────────────────────────────────────────┘
```

## Data Flow

```
User presses ⌘⇧X (global, app can stay hidden/background)
       │
       ▼
┌─────────────────┐     ┌──────────────────┐
│ Global Shortcut  │────►│ Show overlay window│
│ (Rust plugin)    │     │ + toggle capture   │
└─────────────────┘     └────────┬─────────┘
                                 │ base64 PNG
                                 ▼
                        ┌──────────────────┐
                        │ Capture Overlay   │
                        │ (region select)   │
                        └────────┬─────────┘
                                 │ cropped region
                                 ▼
                        ┌──────────────────┐
                        │ Annotation Mode   │
                        │ (Canvas drawing)  │
                        └────────┬─────────┘
                                 │ final image
                          ┌──────┼──────┐
                          ▼      ▼      ▼
                       ┌─────┐┌─────┐┌─────┐
                       │Copy ││Save ││ Pin │
                       │     ││     ││     │
                       └─────┘└─────┘└─────┘
                         │      │      │
                         ▼      ▼      ▼
                     Clipboard  File  New window
                    (NSPaste-  (PNG/  (always-on-
                     board)    JPG)    top)
```

## Frontend Component Hierarchy

```
App
├── CaptureOverlay          # Fullscreen transparent overlay for region selection
│   └── (crosshair + drag selection)
├── Toolbar                 # Annotation tool bar
│   ├── Tool buttons        # Arrow, Rectangle, Circle, Line, Text, Blur, Number
│   ├── ColorPicker         # Annotation color selection
│   ├── Copy button         # Copy to clipboard (+ ⌘C shortcut)
│   ├── Save button         # Save to file
│   ├── Pin button          # Pin to screen
│   └── Toast notification  # Brief feedback messages
├── AnnotationCanvas        # HTML Canvas for drawing annotations
└── PinWindow               # Rendered inside frameless pin windows
    └── Close button (X)
```

## Rust Module Structure

| Module | File | Responsibility |
|---|---|---|
| `capture` | `capture/mod.rs`, `capture/macos.rs` | Screen capture via ScreenCaptureKit |
| `window` | `window/mod.rs`, `window/macos.rs` | Window detection via Accessibility API |
| `hotkey` | `hotkey/mod.rs` | Global hotkey registration |
| `clipboard` | `clipboard.rs` | macOS NSPasteboard clipboard operations |
| `image_processing` | `image_processing/mod.rs` | Image encoding, format conversion |
| `commands` | `commands.rs` | Tauri IPC command handlers |

## IPC Protocol (Tauri Commands)

| Command | Direction | Parameters | Returns | Description |
|---|---|---|---|---|
| `capture_screen` | FE → BE | — | `String` (base64) | Full screen capture |
| `capture_region` | FE → BE | `{x, y, width, height}` | `String` (base64) | Region capture |
| `copy_to_clipboard` | FE → BE | `imageData: String` (base64 PNG) | `()` | Copy image to system clipboard |
| `save_to_file` | FE → BE | `imageData, path, format` | `()` | Save image to disk |
| `pin_screenshot` | FE → BE | `imageData, width, height` | `String` (window label) | Create pinned window |
| `close_pin_window` | FE → BE | `label: String` | `()` | Close a pinned window |
| `list_windows` | FE → BE | — | `Vec<WindowInfo>` | List visible windows |
| `get_permission_status` | FE → BE | — | `PermissionStatus` | Read Screen Recording + Accessibility state |
| `request_screen_recording_permission` | FE → BE | — | `bool` | Trigger Screen Recording permission prompt |
| `request_accessibility_permission` | FE → BE | — | `bool` | Trigger Accessibility permission prompt |
| `open_screen_recording_settings` | FE → BE | — | `()` | Open macOS Screen Recording settings |
| `open_accessibility_settings` | FE → BE | — | `()` | Open macOS Accessibility settings |
| `hide_main_window` | FE → BE | — | `()` | Hide main window (background mode) |

## State Management (Zustand)

```typescript
interface CaptureState {
  // App mode
  mode: "idle" | "capturing" | "annotating" | "pinned";
  setMode: (mode) => void;

  // Captured image
  capturedImageUrl: string | null;
  setCapturedImage: (url: string | null) => void;
}
```

The store is intentionally minimal. Annotation state (tool selection, color, drawn shapes) is managed locally within the `AnnotationCanvas` and `Toolbar` components, as it doesn't need to be shared globally.
