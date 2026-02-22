import { useState, useEffect, useCallback, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow, LogicalSize, LogicalPosition } from "@tauri-apps/api/window";
import { CaptureOverlay } from "./components/CaptureOverlay";
import { FloatingToolbar } from "./components/FloatingToolbar";
import { PinWindow } from "./components/PinWindow";
import { AnnotationCanvas } from "./components/AnnotationCanvas";
import { SaveDialog } from "./components/SaveDialog";
import { PermissionPanel } from "./components/PermissionPanel";
import { Toast } from "./components/Toast";
import { useCaptureStore } from "./stores/captureStore";
import { exportCanvas } from "./utils/canvas";

interface PermissionStatus {
  screen_recording_granted: boolean;
  accessibility_granted: boolean;
}

interface ToastState {
  message: string;
  variant: "success" | "error";
}

function formatSaveTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
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
  const [fullScreenshot, setFullScreenshot] = useState<string | null>(null);
  const [isCopying, setIsCopying] = useState(false);
  const [isCopySuccess, setIsCopySuccess] = useState(false);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const savedWindowStateRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const hasScreenPermission = permissionStatus?.screen_recording_granted ?? false;

  const showToast = useCallback((message: string, variant: "success" | "error" = "success") => {
    setToast({ message, variant });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

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

  const restoreWindow = useCallback(async () => {
    const win = getCurrentWindow();
    await win.setAlwaysOnTop(false);
    await win.setResizable(true);
    await win.setDecorations(true);
    const saved = savedWindowStateRef.current;
    if (saved) {
      await win.setSize(new LogicalSize(saved.width, saved.height));
      await win.setPosition(new LogicalPosition(saved.x, saved.y));
    }
    setFullScreenshot(null);
  }, []);

  const startCaptureIfAllowed = useCallback(async () => {
    const status = await refreshPermissions();
    if (!status?.screen_recording_granted) {
      setMode("idle");
      return false;
    }

    // Save current window state
    const win = getCurrentWindow();
    const pos = await win.outerPosition();
    const size = await win.outerSize();
    const scaleFactor = await win.scaleFactor();
    savedWindowStateRef.current = {
      x: pos.x / scaleFactor,
      y: pos.y / scaleFactor,
      width: size.width / scaleFactor,
      height: size.height / scaleFactor,
    };

    // Hide window, capture desktop, then show fullscreen overlay
    await invoke("hide_main_window");
    await new Promise((r) => setTimeout(r, 200));

    try {
      const base64 = await invoke<string>("capture_screen");
      setFullScreenshot(`data:image/png;base64,${base64}`);

      // Setup window as fullscreen overlay
      const screenW = window.screen.width;
      const screenH = window.screen.height;
      await win.setDecorations(false);
      await win.setResizable(false);
      await win.setAlwaysOnTop(true);
      await win.setPosition(new LogicalPosition(0, 0));
      await win.setSize(new LogicalSize(screenW, screenH));

      await invoke("show_main_window");
      setMode("capturing");
    } catch (err) {
      console.error("Capture failed:", err);
      await invoke("show_main_window");
      setMode("idle");
    }

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
        await restoreWindow();
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
  }, [mode, setMode, hideMainWindow, restoreWindow, startCaptureIfAllowed]);

  const handleCapture = useCallback(
    async (imageData: string) => {
      setCapturedImage(imageData);
      clearAnnotations();
      setFullScreenshot(null);

      // Restore window before showing annotation view
      await restoreWindow();

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
    [setCapturedImage, setMode, clearAnnotations, restoreWindow]
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
    ctx.fillText("Demo Screenshot - Draw annotations!", 150, 420);
    handleCapture(canvas.toDataURL());
  }, [handleCapture]);

  const handleCopy = useCallback(async () => {
    if (!bgCanvasRef.current || isCopying) return;

    setIsCopying(true);
    try {
      const dataUrl = exportCanvas(bgCanvasRef.current, annotations, "png");
      const base64 = dataUrl.split(",")[1];
      await invoke("copy_to_clipboard", { imageData: base64 });
      setIsCopySuccess(true);
      showToast("Copied to clipboard!");
      window.setTimeout(() => setIsCopySuccess(false), 1000);
    } catch (err) {
      console.error("Failed to copy:", err);
      showToast("Copy failed", "error");
      setIsCopySuccess(false);
    } finally {
      setIsCopying(false);
    }
  }, [annotations, isCopying, showToast]);

  const handleOcr = useCallback(async () => {
    if (!bgCanvasRef.current || isOcrLoading) return;

    setIsOcrLoading(true);
    try {
      const dataUrl = exportCanvas(bgCanvasRef.current, annotations, "png");
      const base64 = dataUrl.split(",")[1];
      const text = await invoke<string>("ocr_image", { imageData: base64 });
      setOcrResult(text || "");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("OCR failed:", err);
      showToast(`OCR failed: ${message}`, "error");
    } finally {
      setIsOcrLoading(false);
    }
  }, [annotations, isOcrLoading, showToast]);

  const handlePin = useCallback(async () => {
    if (!bgCanvasRef.current) return;
    const dataUrl = exportCanvas(bgCanvasRef.current, annotations, "png");
    const base64 = dataUrl.split(",")[1];
    const canvas = bgCanvasRef.current;
    try {
      await invoke("pin_screenshot", {
        imageData: base64,
        width: canvas.width,
        height: canvas.height,
      });
    } catch (err) {
      console.error("Pin failed:", err);
      showToast("Pin failed", "error");
    }
  }, [annotations, showToast]);

  const handleSave = useCallback(
    async (format: "png" | "jpg", quality: number) => {
      if (!bgCanvasRef.current) return;

      const dataUrl = exportCanvas(bgCanvasRef.current, annotations, format, quality);
      const ext = format === "jpg" ? "jpg" : "png";
      const defaultPath = `~/Downloads/snaplark-${formatSaveTimestamp(new Date())}.${ext}`;

      try {
        const { save } = await import("@tauri-apps/plugin-dialog");
        const filePath = await save({
          defaultPath,
          filters: [{ name: format.toUpperCase(), extensions: [ext] }],
        });

        if (!filePath) {
          setShowSaveDialog(false);
          return;
        }

        const base64 = dataUrl.split(",")[1];
        await invoke("save_to_file", { imageData: base64, path: filePath, format: ext });
        showToast(`Saved to ${filePath}`);
      } catch (err) {
        console.error("Save failed:", err);
        showToast("Save failed", "error");
      }

      setShowSaveDialog(false);
    },
    [annotations, setShowSaveDialog, showToast]
  );

  const handleCopyOcrText = useCallback(async () => {
    if (!ocrResult) return;

    try {
      await navigator.clipboard.writeText(ocrResult);
      showToast("Copied OCR text to clipboard!");
    } catch (err) {
      console.error("Failed to copy OCR text:", err);
      showToast("Failed to copy OCR text", "error");
    }
  }, [ocrResult, showToast]);

  // Keyboard shortcuts for undo/redo/escape/OCR
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode !== "annotating") return;
      if (e.key === "z" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if (e.key === "z" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        undo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "t") {
        e.preventDefault();
        handleOcr();
      } else if (e.key === "Escape") {
        setMode("idle");
        hideMainWindow();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, undo, redo, handleOcr, setMode, hideMainWindow]);

  // Early return for pin windows - must be after all hooks
  if (isPinWindow) {
    return <PinWindow />;
  }

  return (
    <div className="min-h-screen bg-transparent">
      {mode === "idle" && (
        <div className="flex min-h-screen items-center justify-center">
          <div className="max-w-xl rounded-2xl bg-white/95 p-8 text-center shadow-xl backdrop-blur-sm">
            <h1 className="mb-2 text-4xl font-bold text-gray-900">Snaplark</h1>
            <p className="mb-6 text-gray-600">
              Press <kbd className="rounded bg-gray-100 px-2 py-1 font-mono text-sm">⌘⇧X</kbd> to
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
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => {
                    startCaptureIfAllowed();
                  }}
                  className="rounded-lg bg-blue-500 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-600"
                >
                  Start Capture
                </button>
                <button
                  onClick={handleDemoCapture}
                  className="rounded-lg bg-gray-200 px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-300"
                >
                  Demo Mode
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {mode === "capturing" && fullScreenshot && (
        <CaptureOverlay
          screenshotData={fullScreenshot}
          onCapture={handleCapture}
          onCancel={async () => {
            setMode("idle");
            await restoreWindow();
            await hideMainWindow();
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

          {toast && <Toast message={toast.message} variant={toast.variant} />}

          <FloatingToolbar
            onCopy={handleCopy}
            onOcr={handleOcr}
            onPin={handlePin}
            onSave={() => setShowSaveDialog(true)}
            onCloseWindow={hideMainWindow}
            isCopying={isCopying}
            isCopySuccess={isCopySuccess}
            isOcrLoading={isOcrLoading}
          />

          {showSaveDialog && (
            <SaveDialog onSave={handleSave} onCancel={() => setShowSaveDialog(false)} />
          )}

          {ocrResult !== null && (
            <div
              className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
              onClick={() => setOcrResult(null)}
            >
              <div
                className="w-full max-w-2xl rounded-2xl border border-white/10 bg-gray-900/95 p-5 text-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold tracking-wide text-white/90">OCR Result</h2>
                  <button
                    onClick={() => setOcrResult(null)}
                    className="rounded-md px-2 py-1 text-xs text-white/70 hover:bg-white/10 hover:text-white"
                  >
                    Close
                  </button>
                </div>
                <textarea
                  readOnly
                  value={ocrResult}
                  className="h-60 w-full resize-none rounded-xl border border-white/15 bg-black/35 p-3 text-sm text-white outline-none"
                />
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    onClick={handleCopyOcrText}
                    className="rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white hover:bg-blue-600"
                  >
                    Copy Text
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
