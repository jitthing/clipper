import { useState, useEffect, useCallback, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { CaptureOverlay } from "./components/CaptureOverlay";
import { FloatingToolbar } from "./components/FloatingToolbar";
import { PinWindow } from "./components/PinWindow";
import { AnnotationCanvas } from "./components/AnnotationCanvas";
import { SaveDialog } from "./components/SaveDialog";
import { PermissionPanel } from "./components/PermissionPanel";
import { SettingsPanel } from "./components/SettingsPanel";
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

interface HotkeyMutationResult {
  status: "ok" | "invalid" | "conflict";
  message: string;
  shortcut: string;
}

function formatSaveTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

function formatRecordingDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
}

function formatShortcutForDisplay(shortcut: string): string {
  return shortcut
    .replace(/CommandOrControl/g, "⌘/Ctrl")
    .replace(/Shift/g, "⇧")
    .replace(/Alt/g, "⌥");
}

function shortcutFromKeyboardEvent(event: KeyboardEvent): string | null {
  const key = event.key.toUpperCase();
  if (["SHIFT", "CONTROL", "META", "ALT"].includes(key)) {
    return null;
  }
  if (!/^[A-Z]$/.test(key)) {
    return null;
  }

  const parts: string[] = [];
  if (event.metaKey || event.ctrlKey) {
    parts.push("CommandOrControl");
  }
  if (event.altKey) {
    parts.push("Alt");
  }
  if (event.shiftKey) {
    parts.push("Shift");
  }
  parts.push(key);
  return parts.join("+");
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
  const [isOverlay, setIsOverlay] = useState(false);
  const [overlayScreenshot, setOverlayScreenshot] = useState<string | null>(null);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus | null>(null);
  const [isCopying, setIsCopying] = useState(false);
  const [isCopySuccess, setIsCopySuccess] = useState(false);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isStartingRecording, setIsStartingRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [webcamOverlayEnabled, setWebcamOverlayEnabled] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [captureShortcut, setCaptureShortcut] = useState("CommandOrControl+Shift+A");
  const [pendingCaptureShortcut, setPendingCaptureShortcut] = useState("CommandOrControl+Shift+A");
  const [isListeningForShortcut, setIsListeningForShortcut] = useState(false);
  const [shortcutStatus, setShortcutStatus] = useState<{
    variant: "success" | "error";
    message: string;
  } | null>(null);

  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const renderLoopRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const isRecordingRef = useRef(false);
  const webcamOverlayEnabledRef = useRef(false);

  const hasScreenPermission = permissionStatus?.screen_recording_granted ?? false;

  const showToast = useCallback((message: string, variant: "success" | "error" = "success") => {
    setToast({ message, variant });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    webcamOverlayEnabledRef.current = webcamOverlayEnabled;
  }, [webcamOverlayEnabled]);

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

  const loadCaptureShortcut = useCallback(async () => {
    try {
      const shortcut = await invoke<string>("get_capture_shortcut");
      setCaptureShortcut(shortcut);
      setPendingCaptureShortcut(shortcut);
    } catch (err) {
      console.error("Failed to load capture shortcut:", err);
    }
  }, []);

  const hideMainWindow = useCallback(async () => {
    try {
      await invoke("hide_main_window");
    } catch (err) {
      console.error("Failed to hide main window:", err);
    }
  }, []);

  // Detect overlay mode from query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "overlay") {
      setIsOverlay(true);
      // Check if data is already available
      if ((window as any).__SCREENSHOT_DATA__) {
        setOverlayScreenshot((window as any).__SCREENSHOT_DATA__);
      }
      // Listen for data from Rust eval()
      const handler = () => {
        setOverlayScreenshot((window as any).__SCREENSHOT_DATA__);
      };
      window.addEventListener("screenshot-ready", handler);
      return () => window.removeEventListener("screenshot-ready", handler);
    }
  }, []);

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

  // Load permission status on startup (only for main window)
  useEffect(() => {
    if (!isOverlay) {
      refreshPermissions();
      loadCaptureShortcut();
    }
  }, [refreshPermissions, loadCaptureShortcut, isOverlay]);

  const handleCapture = useCallback(
    async (imageData: string) => {
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

  // Listen for open-main-view tray event (main window only)
  useEffect(() => {
    if (isOverlay) return;
    const unlistenOpen = listen("open-main-view", () => {
      setMode("idle");
    });

    return () => {
      unlistenOpen.then((f) => f());
    };
  }, [isOverlay, setMode]);

  // Overlay: handle cancel
  const handleOverlayCancel = useCallback(async () => {
    try {
      await invoke("close_overlay");
    } catch (err) {
      console.error("close_overlay failed:", err);
    }
  }, []);

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

  const saveRecordingBlob = useCallback((blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `clipper-recording-${formatSaveTimestamp(new Date())}.webm`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);

  const cleanupRecordingResources = useCallback(() => {
    if (renderLoopRef.current !== null) {
      cancelAnimationFrame(renderLoopRef.current);
      renderLoopRef.current = null;
    }

    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    displayStreamRef.current?.getTracks().forEach((track) => track.stop());
    webcamStreamRef.current?.getTracks().forEach((track) => track.stop());

    displayStreamRef.current = null;
    webcamStreamRef.current = null;
    mediaRecorderRef.current = null;
  }, []);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    if (recorder.state !== "inactive") {
      recorder.stop();
    }

    setIsRecording(false);
    setRecordingSeconds(0);
  }, []);

  const startRecording = useCallback(async () => {
    if (isStartingRecording || isRecordingRef.current) return;

    setIsStartingRecording(true);

    try {
      await invoke("show_main_window");

      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: 30,
        },
        audio: true,
      });
      displayStreamRef.current = displayStream;

      let webcamStream: MediaStream | null = null;
      if (webcamOverlayEnabledRef.current) {
        try {
          webcamStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 360 },
            audio: false,
          });
          webcamStreamRef.current = webcamStream;
        } catch (error) {
          console.warn("Webcam unavailable, continuing without overlay", error);
          setWebcamOverlayEnabled(false);
          showToast("Webcam unavailable — recording screen only", "error");
        }
      }

      const displayVideo = document.createElement("video");
      displayVideo.srcObject = displayStream;
      displayVideo.muted = true;
      await displayVideo.play();

      let outputStream: MediaStream;

      if (webcamStream && webcamStream.getVideoTracks().length > 0) {
        const webcamVideo = document.createElement("video");
        webcamVideo.srcObject = webcamStream;
        webcamVideo.muted = true;
        await webcamVideo.play();

        const canvas = document.createElement("canvas");
        canvas.width = displayVideo.videoWidth || 1920;
        canvas.height = displayVideo.videoHeight || 1080;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Failed to initialize recording canvas");

        const draw = () => {
          ctx.drawImage(displayVideo, 0, 0, canvas.width, canvas.height);

          const bubbleSize = Math.round(Math.min(canvas.width, canvas.height) * 0.2);
          const margin = 24;
          const x = canvas.width - bubbleSize - margin;
          const y = canvas.height - bubbleSize - margin;

          ctx.save();
          ctx.beginPath();
          ctx.arc(x + bubbleSize / 2, y + bubbleSize / 2, bubbleSize / 2, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(webcamVideo, x, y, bubbleSize, bubbleSize);
          ctx.restore();

          ctx.strokeStyle = "rgba(255,255,255,0.9)";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(x + bubbleSize / 2, y + bubbleSize / 2, bubbleSize / 2, 0, Math.PI * 2);
          ctx.stroke();

          renderLoopRef.current = requestAnimationFrame(draw);
        };

        draw();
        outputStream = canvas.captureStream(30);
      } else {
        outputStream = displayStream;
      }

      displayStream
        .getAudioTracks()
        .forEach((audioTrack) => outputStream.addTrack(audioTrack.clone()));

      const chunks: BlobPart[] = [];
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm";

      const recorder = new MediaRecorder(outputStream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        cleanupRecordingResources();
        if (chunks.length > 0) {
          saveRecordingBlob(new Blob(chunks, { type: "video/webm" }));
          showToast("Recording saved to Downloads");
        }
      };

      recorder.start(1000);
      setIsRecording(true);
      recordingStartTimeRef.current = Date.now();
      timerRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
        setRecordingSeconds(elapsed);
      }, 1000);

      const [displayTrack] = displayStream.getVideoTracks();
      if (displayTrack) {
        displayTrack.onended = () => {
          if (isRecordingRef.current) {
            stopRecording();
          }
        };
      }

      showToast("Recording started");
    } catch (err) {
      console.error("Failed to start recording:", err);
      showToast(
        "Unable to start recording. Grant Screen Recording permission in System Settings.",
        "error"
      );
    } finally {
      setIsStartingRecording(false);
    }
  }, [cleanupRecordingResources, isStartingRecording, saveRecordingBlob, showToast, stopRecording]);

  const toggleRecording = useCallback(() => {
    if (isRecordingRef.current) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [startRecording, stopRecording]);

  useEffect(() => {
    if (isOverlay) return;

    const unlistenRecordingToggle = listen("toggle-recording-request", () => {
      toggleRecording();
    });
    const unlistenWebcamToggle = listen("toggle-webcam-overlay-request", () => {
      setWebcamOverlayEnabled((prev) => {
        const next = !prev;
        showToast(`Webcam overlay ${next ? "enabled" : "disabled"}`);
        return next;
      });
    });

    return () => {
      unlistenRecordingToggle.then((f) => f());
      unlistenWebcamToggle.then((f) => f());
    };
  }, [isOverlay, showToast, toggleRecording]);

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
      const defaultPath = `~/Downloads/clipper-${formatSaveTimestamp(new Date())}.${ext}`;

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

  useEffect(() => {
    return () => {
      cleanupRecordingResources();
    };
  }, [cleanupRecordingResources]);

  useEffect(() => {
    if (!isListeningForShortcut) return;
    const handleShortcutCapture = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const shortcut = shortcutFromKeyboardEvent(event);
      if (!shortcut) {
        setShortcutStatus({
          variant: "error",
          message: "Use Command/Ctrl + modifier + A-Z key.",
        });
        return;
      }
      setPendingCaptureShortcut(shortcut);
      setShortcutStatus(null);
      setIsListeningForShortcut(false);
    };
    window.addEventListener("keydown", handleShortcutCapture, true);
    return () => window.removeEventListener("keydown", handleShortcutCapture, true);
  }, [isListeningForShortcut]);

  const updateCaptureShortcut = useCallback(
    async (shortcut: string) => {
      try {
        const result = await invoke<HotkeyMutationResult>("set_capture_shortcut", {
          shortcut,
        });

        if (result.status === "ok") {
          setCaptureShortcut(result.shortcut);
          setPendingCaptureShortcut(result.shortcut);
          setShortcutStatus({ variant: "success", message: result.message });
          return;
        }

        setShortcutStatus({ variant: "error", message: result.message });
      } catch (err) {
        console.error("Failed to set capture shortcut:", err);
        setShortcutStatus({
          variant: "error",
          message: "Failed to update shortcut.",
        });
      }
    },
    []
  );

  useEffect(() => {
    if (!isSettingsOpen || isListeningForShortcut) return;

    const nextShortcut = pendingCaptureShortcut.trim();
    if (!nextShortcut || nextShortcut === captureShortcut) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void updateCaptureShortcut(nextShortcut);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [
    captureShortcut,
    isListeningForShortcut,
    isSettingsOpen,
    pendingCaptureShortcut,
    updateCaptureShortcut,
  ]);

  // Keyboard shortcuts for undo/redo/escape/OCR
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isListeningForShortcut) return;
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
  }, [mode, undo, redo, handleOcr, setMode, hideMainWindow, isListeningForShortcut]);

  useEffect(() => {
    if (isOverlay) return;

    const unlistenSettings = listen("open-settings", () => {
      setIsSettingsOpen(true);
      setPendingCaptureShortcut(captureShortcut);
      setIsListeningForShortcut(false);
      setShortcutStatus(null);
    });

    return () => {
      unlistenSettings.then((f) => f());
    };
  }, [captureShortcut, isOverlay]);

  // Early return for pin windows - must be after all hooks
  if (isPinWindow) {
    return <PinWindow />;
  }

  // Overlay mode — only render the capture overlay
  if (isOverlay) {
    if (!overlayScreenshot) {
      return null;
    }
    return (
      <CaptureOverlay
        screenshotData={overlayScreenshot}
        onCancel={handleOverlayCancel}
      />
    );
  }

  return (
    <div className="min-h-screen bg-transparent">
      {mode === "idle" && (
        <div className="flex min-h-screen items-center justify-center">
          <div className="max-w-xl rounded-2xl bg-white/95 p-8 text-center shadow-xl backdrop-blur-sm">
            <h1 className="mb-2 text-4xl font-bold text-gray-900">Clipper</h1>
            <p className="mb-6 text-gray-600">
              Press <kbd className="rounded bg-gray-100 px-2 py-1 font-mono text-sm">⌘⇧A</kbd> to
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
              <div className="space-y-4">
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => {
                      invoke("trigger_capture");
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

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-left">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-semibold text-gray-900">Screen Recording (MVP)</p>
                    {isRecording && (
                      <span className="inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
                        <span className="h-2 w-2 rounded-full bg-red-500" />
                        REC {formatRecordingDuration(recordingSeconds)}
                      </span>
                    )}
                  </div>
                  <p className="mb-3 text-sm text-gray-600">
                    Tray shortcut: <kbd className="rounded bg-white px-2 py-1 font-mono">⌘⇧R</kbd>
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={toggleRecording}
                      disabled={isStartingRecording}
                      className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${
                        isRecording
                          ? "bg-red-500 hover:bg-red-600"
                          : "bg-emerald-500 hover:bg-emerald-600"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      {isRecording
                        ? "Stop Recording"
                        : isStartingRecording
                          ? "Starting..."
                          : "Start Recording"}
                    </button>

                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={webcamOverlayEnabled}
                        onChange={(e) => setWebcamOverlayEnabled(e.target.checked)}
                        disabled={isRecording}
                      />
                      Webcam bubble overlay
                    </label>
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
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

      {isSettingsOpen && (
        <SettingsPanel
          captureShortcut={captureShortcut}
          pendingCaptureShortcut={pendingCaptureShortcut}
          isListeningForShortcut={isListeningForShortcut}
          shortcutStatus={shortcutStatus}
          onClose={() => {
            setIsSettingsOpen(false);
            setIsListeningForShortcut(false);
            setPendingCaptureShortcut(captureShortcut);
            setShortcutStatus(null);
          }}
          onPendingCaptureShortcutChange={(value) => {
            setPendingCaptureShortcut(value);
            setShortcutStatus(null);
          }}
          onStartListening={() => {
            setShortcutStatus(null);
            setIsListeningForShortcut(true);
          }}
          onReset={() => {
            setShortcutStatus(null);
            void invoke<HotkeyMutationResult>("reset_capture_shortcut")
              .then((result) => {
                setCaptureShortcut(result.shortcut);
                setPendingCaptureShortcut(result.shortcut);
                setShortcutStatus({
                  variant: result.status === "ok" ? "success" : "error",
                  message: result.message,
                });
              })
              .catch((err) => {
                console.error("Failed to reset capture shortcut:", err);
                setShortcutStatus({
                  variant: "error",
                  message: "Failed to reset shortcut.",
                });
              });
          }}
          formatShortcutForDisplay={formatShortcutForDisplay}
        />
      )}
    </div>
  );
}

export default App;
