import { useState, useEffect, useCallback, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { CaptureOverlay } from "./components/CaptureOverlay";
import { FloatingToolbar } from "./components/FloatingToolbar";
import { PinWindow } from "./components/PinWindow";
import { AnnotationCanvas } from "./components/AnnotationCanvas";
import { SaveDialog } from "./components/SaveDialog";
import { PermissionPanel } from "./components/PermissionPanel";
import { useCaptureStore } from "./stores/captureStore";
import { exportCanvas } from "./utils/canvas";

interface PermissionStatus {
  screen_recording_granted: boolean;
  accessibility_granted: boolean;
}

function App() {
  const mode = useCaptureStore((s) => s.mode);
  const setMode = useCaptureStore((s) => s.setMode);
  const setCapturedImage = useCaptureStore((s) => s.setCapturedImage);
  const annotations = useCaptureStore((s) => s.annotations);
  const undo = useCaptureStore((s) => s.undo);
  const redo = useCaptureStore((s) => s.redo);
  const showSaveDialog = useCaptureStore((s) => s.showSaveDialog);
  const setShowSaveDialog = useCaptureStore((s) => s.setShowSaveDialog);
  const clearAnnotations = useCaptureStore((s) => s.clearAnnotations);

  const [isPinWindow, setIsPinWindow] = useState(false);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus | null>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hasScreenPermission = permissionStatus?.screen_recording_granted ?? false;

  const refreshPermissions = useCallback(async () => {
    try {
      const status = await invoke<PermissionStatus>("get_permission_status");
      setPermissionStatus(status);
      return status;
    } catch (err) {
      console.error("Failed to read permission status:", err);
      return null;
    }
  }, []);

  const hideMainWindow = useCallback(async () => {
    try {
      await invoke("hide_main_window");
    } catch (err) {
      console.error("Failed to hide main window:", err);
    }
  }, []);

  const startCaptureIfAllowed = useCallback(async () => {
    const status = await refreshPermissions();
    if (!status?.screen_recording_granted) {
      setMode("idle");
      return false;
    }
    setMode("capturing");
    return true;
  }, [refreshPermissions, setMode]);

  // Detect if this window instance is a pin window
  useEffect(() => {
    const checkPin = () => {
      if ((window as any).__PIN_DATA__) {
        setIsPinWindow(true);
      }
    };
    checkPin();
    window.addEventListener("pin-data-ready", checkPin);
    return () => window.removeEventListener("pin-data-ready", checkPin);
  }, []);

  // Load permission status on startup
  useEffect(() => {
    refreshPermissions();
  }, [refreshPermissions]);

  // Listen for global hotkey trigger from Rust backend
  useEffect(() => {
    const unlistenCapture = listen("capture-toggle", async () => {
      if (mode === "capturing") {
        setMode("idle");
        await hideMainWindow();
        return;
      }
      await startCaptureIfAllowed();
    });
    const unlistenOpen = listen("open-main-view", () => {
      setMode("idle");
    });
    return () => {
      unlistenCapture.then((f) => f());
      unlistenOpen.then((f) => f());
    };
  }, [mode, setMode, hideMainWindow, startCaptureIfAllowed]);

  const handleCapture = useCallback(
    (imageData: string) => {
      setCapturedImage(imageData);
      clearAnnotations();

      const img = new Image();
      img.onload = () => {
        setBgImage(img);
        setCanvasSize({ width: img.naturalWidth, height: img.naturalHeight });

        // Create a background canvas for compositing
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        bgCanvasRef.current = canvas;

        setMode("annotating");
      };
      img.src = imageData;
    },
    [setCapturedImage, setMode, clearAnnotations]
  );

  const handleDemoCapture = useCallback(() => {
    // Demo mode: generate a gradient image for testing without Tauri backend
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext("2d")!;
    const grad = ctx.createLinearGradient(0, 0, 800, 600);
    grad.addColorStop(0, "#667eea");
    grad.addColorStop(1, "#764ba2");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, 600);
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(50, 50, 300, 200);
    ctx.fillRect(400, 100, 350, 180);
    ctx.fillRect(100, 300, 600, 250);
    ctx.fillStyle = "#fff";
    ctx.font = "24px sans-serif";
    ctx.fillText("Demo Screenshot — Draw annotations!", 150, 420);
    handleCapture(canvas.toDataURL());
  }, [handleCapture]);

  // Keyboard shortcuts for undo/redo/escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode !== "annotating") return;
      if (e.key === "z" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if (e.key === "z" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        undo();
      } else if (e.key === "Escape") {
        setMode("idle");
        hideMainWindow();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, undo, redo, setMode, hideMainWindow]);

  const handleCopy = useCallback(async () => {
    if (!bgCanvasRef.current) return;
    const dataUrl = exportCanvas(bgCanvasRef.current, annotations, "png");
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [annotations]);

  const handlePin = useCallback(async () => {
    if (!bgCanvasRef.current) return;
    const dataUrl = exportCanvas(bgCanvasRef.current, annotations, "png");
    const base64 = dataUrl.split(",")[1];
    const canvas = bgCanvasRef.current;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("pin_screenshot", {
        imageData: base64,
        width: canvas.width,
        height: canvas.height,
      });
    } catch (err) {
      console.error("Pin failed:", err);
    }
  }, [annotations]);

  const handleSave = useCallback(
    async (format: "png" | "jpg", quality: number) => {
      if (!bgCanvasRef.current) return;
      const dataUrl = exportCanvas(bgCanvasRef.current, annotations, format, quality);
      const now = new Date();
      const ts = now.toISOString().replace(/T/, "_").replace(/:/g, "-").slice(0, 19);
      const ext = format === "jpg" ? "jpg" : "png";
      const defaultName = `Snaplark_${ts}.${ext}`;

      try {
        const { save } = await import("@tauri-apps/plugin-dialog");
        const filePath = await save({
          defaultPath: defaultName,
          filters: [{ name: format.toUpperCase(), extensions: [ext] }],
        });
        if (filePath) {
          const { invoke } = await import("@tauri-apps/api/core");
          const base64 = dataUrl.split(",")[1];
          await invoke("save_to_file", { imageData: base64, path: filePath, format: ext });
        }
      } catch {
        // Fallback: browser download
        const link = document.createElement("a");
        link.download = defaultName;
        link.href = dataUrl;
        link.click();
      }
      setShowSaveDialog(false);
    },
    [annotations, setShowSaveDialog]
  );

  // Early return for pin windows — must be after all hooks
  if (isPinWindow) {
    return <PinWindow />;
  }

  return (
    <div className="min-h-screen bg-transparent">
      {mode === "idle" && (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center p-8 rounded-2xl bg-white/95 shadow-xl backdrop-blur-sm max-w-xl">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Snaplark</h1>
            <p className="text-gray-600 mb-6">
              Press <kbd className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">⌘⇧X</kbd> to
              open the capture overlay from background mode.
            </p>
            {!hasScreenPermission && permissionStatus ? (
              <PermissionPanel
                screenRecordingGranted={permissionStatus.screen_recording_granted}
                accessibilityGranted={permissionStatus.accessibility_granted}
                onRequestScreenRecording={() => {
                  invoke("request_screen_recording_permission").then(() => refreshPermissions());
                }}
                onOpenScreenRecordingSettings={() => {
                  invoke("open_screen_recording_settings");
                }}
                onRequestAccessibility={() => {
                  invoke("request_accessibility_permission").then(() => refreshPermissions());
                }}
                onOpenAccessibilitySettings={() => {
                  invoke("open_accessibility_settings");
                }}
                onRefresh={refreshPermissions}
              />
            ) : (
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => {
                    startCaptureIfAllowed();
                  }}
                  className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
                >
                  Start Capture
                </button>
                <button
                  onClick={handleDemoCapture}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  Demo Mode
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {mode === "capturing" && (
        <CaptureOverlay
          onCapture={handleCapture}
          onCancel={() => {
            setMode("idle");
            hideMainWindow();
          }}
        />
      )}

      {mode === "annotating" && (
        <div className="relative h-screen overflow-auto bg-black/45 p-6">
          <div className="flex min-h-full items-center justify-center">
            <AnnotationCanvas
              backgroundImage={bgImage}
              width={canvasSize.width}
              height={canvasSize.height}
            />
          </div>
          <FloatingToolbar
            onCopy={handleCopy}
            onPin={handlePin}
            onSave={() => setShowSaveDialog(true)}
            onCloseWindow={hideMainWindow}
          />
          {showSaveDialog && (
            <SaveDialog onSave={handleSave} onCancel={() => setShowSaveDialog(false)} />
          )}
        </div>
      )}
    </div>
  );
}

export default App;
