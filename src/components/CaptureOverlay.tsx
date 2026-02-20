import { useEffect, useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow, LogicalSize, LogicalPosition } from "@tauri-apps/api/window";

interface WindowInfo {
  id: number;
  title: string;
  app_name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CaptureOverlayProps {
  onCapture: (imageDataUrl: string) => void;
  onCancel: () => void;
}

export function CaptureOverlay({ onCapture, onCancel }: CaptureOverlayProps) {
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [hoveredWindow, setHoveredWindow] = useState<WindowInfo | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    invoke<WindowInfo[]>("list_windows")
      .then(setWindows)
      .catch(console.error);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  // Make window fullscreen, transparent, frameless, always-on-top for capture
  useEffect(() => {
    const win = getCurrentWindow();
    let savedPos: { x: number; y: number } | null = null;
    let savedSize: { width: number; height: number } | null = null;

    const setup = async () => {
      const pos = await win.outerPosition();
      const size = await win.outerSize();
      const scaleFactor = await win.scaleFactor();
      savedPos = { x: pos.x / scaleFactor, y: pos.y / scaleFactor };
      savedSize = { width: size.width / scaleFactor, height: size.height / scaleFactor };

      await win.setDecorations(false);
      await win.setAlwaysOnTop(true);
      await win.setPosition(new LogicalPosition(0, 0));
      // Use screen dimensions
      const screenW = window.screen.width;
      const screenH = window.screen.height;
      await win.setSize(new LogicalSize(screenW, screenH));
    };
    setup();

    return () => {
      const restore = async () => {
        await win.setAlwaysOnTop(false);
        await win.setDecorations(true);
        if (savedSize) await win.setSize(new LogicalSize(savedSize.width, savedSize.height));
        if (savedPos) await win.setPosition(new LogicalPosition(savedPos.x, savedPos.y));
      };
      restore();
    };
  }, []);

  const findWindowAt = useCallback(
    (x: number, y: number): WindowInfo | null => {
      let best: WindowInfo | null = null;
      let bestArea = Infinity;
      for (const w of windows) {
        if (x >= w.x && x <= w.x + w.width && y >= w.y && y <= w.y + w.height) {
          const area = w.width * w.height;
          if (area < bestArea) {
            bestArea = area;
            best = w;
          }
        }
      }
      return best;
    },
    [windows]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragStart) {
        const dx = Math.abs(e.clientX - dragStart.x);
        const dy = Math.abs(e.clientY - dragStart.y);
        if (!isDragging && (dx > 3 || dy > 3)) {
          setIsDragging(true);
          setHoveredWindow(null);
        }
        if (isDragging) {
          setDragCurrent({ x: e.clientX, y: e.clientY });
        }
      } else {
        setHoveredWindow(findWindowAt(e.screenX, e.screenY));
      }
    },
    [isDragging, dragStart, findWindowAt]
  );

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setDragStart({ x: e.clientX, y: e.clientY });
    setDragCurrent({ x: e.clientX, y: e.clientY });
  }, []);

  const getSelectionRegion = useCallback((): Region | null => {
    if (!dragStart || !dragCurrent) return null;
    return {
      x: Math.round(Math.min(dragStart.x, dragCurrent.x)),
      y: Math.round(Math.min(dragStart.y, dragCurrent.y)),
      width: Math.round(Math.abs(dragCurrent.x - dragStart.x)),
      height: Math.round(Math.abs(dragCurrent.y - dragStart.y)),
    };
  }, [dragStart, dragCurrent]);

  const clientToScreen = useCallback(async (cx: number, cy: number) => {
    const win = getCurrentWindow();
    const pos = await win.outerPosition();
    const scaleFactor = await win.scaleFactor();
    return {
      x: Math.round(pos.x / scaleFactor + cx),
      y: Math.round(pos.y / scaleFactor + cy),
    };
  }, []);

  const captureRegion = useCallback(
    async (region: Region) => {
      try {
        const base64 = await invoke<string>("capture_region", { region });
        onCapture(`data:image/png;base64,${base64}`);
      } catch (err) {
        console.error("Capture failed:", err);
        onCancel();
      }
    },
    [onCapture, onCancel]
  );

  const handleMouseUp = useCallback(async () => {
    if (isDragging && dragStart && dragCurrent) {
      const region = getSelectionRegion();
      if (region && region.width > 5 && region.height > 5) {
        const topLeft = await clientToScreen(region.x, region.y);
        const screenRegion = {
          x: topLeft.x,
          y: topLeft.y,
          width: region.width,
          height: region.height,
        };
        await captureRegion(screenRegion);
        return;
      }
    }
    if (hoveredWindow) {
      await captureRegion({
        x: Math.round(hoveredWindow.x),
        y: Math.round(hoveredWindow.y),
        width: Math.round(hoveredWindow.width),
        height: Math.round(hoveredWindow.height),
      });
      return;
    }
    setIsDragging(false);
    setDragStart(null);
    setDragCurrent(null);
  }, [isDragging, dragStart, dragCurrent, hoveredWindow, getSelectionRegion, captureRegion, clientToScreen]);

  const selection = getSelectionRegion();

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] cursor-crosshair select-none"
      style={{ background: "rgba(0,0,0,0.3)" }}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      tabIndex={0}
      autoFocus
    >
      {/* Instructions */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-lg text-sm pointer-events-none z-10">
        Click and drag to select · Click a window to capture ·{" "}
        <span className="opacity-70">ESC to cancel</span>
      </div>

      {/* Hovered window highlight */}
      {hoveredWindow && !isDragging && (
        <div
          className="absolute border-2 border-blue-400 bg-blue-400/10 pointer-events-none"
          style={{
            left: hoveredWindow.x,
            top: hoveredWindow.y,
            width: hoveredWindow.width,
            height: hoveredWindow.height,
          }}
        >
          <div className="absolute -top-6 left-0 bg-blue-500 text-white text-xs px-2 py-0.5 rounded whitespace-nowrap">
            {hoveredWindow.app_name}
            {hoveredWindow.title ? ` — ${hoveredWindow.title}` : ""} (
            {Math.round(hoveredWindow.width)}×{Math.round(hoveredWindow.height)})
          </div>
        </div>
      )}

      {/* Selection rectangle */}
      {isDragging && selection && selection.width > 0 && selection.height > 0 && (
        <>
          <div
            className="absolute border-2 border-white/80 pointer-events-none"
            style={{
              left: selection.x,
              top: selection.y,
              width: selection.width,
              height: selection.height,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.3)",
              background: "transparent",
            }}
          />
          <div
            className="absolute bg-black/80 text-white text-xs px-2 py-1 rounded pointer-events-none"
            style={{
              left: selection.x + selection.width / 2 - 30,
              top: selection.y + selection.height + 8,
            }}
          >
            {selection.width} × {selection.height}
          </div>
        </>
      )}
    </div>
  );
}
