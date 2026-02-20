import { useEffect, useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

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
  onCapture: (imageData: string) => void;
  onCancel: () => void;
}

export function CaptureOverlay({ onCapture, onCancel }: CaptureOverlayProps) {
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [hoveredWindow, setHoveredWindow] = useState<WindowInfo | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Fetch window list on mount
  useEffect(() => {
    invoke<WindowInfo[]>("list_windows")
      .then(setWindows)
      .catch(console.error);
  }, []);

  // ESC to cancel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  const findWindowAt = useCallback(
    (x: number, y: number): WindowInfo | null => {
      // Find smallest window containing the point (most specific)
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
        const dx = Math.abs(e.screenX - dragStart.x);
        const dy = Math.abs(e.screenY - dragStart.y);
        if (!isDragging && (dx > 3 || dy > 3)) {
          setIsDragging(true);
          setHoveredWindow(null);
        }
        if (isDragging) {
          setDragCurrent({ x: e.screenX, y: e.screenY });
        }
      } else {
        setHoveredWindow(findWindowAt(e.screenX, e.screenY));
      }
    },
    [isDragging, dragStart, findWindowAt]
  );

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setDragStart({ x: e.screenX, y: e.screenY });
    setDragCurrent({ x: e.screenX, y: e.screenY });
  }, []);

  const handleMouseUp = useCallback(async () => {
    if (isDragging && dragStart && dragCurrent) {
      const region = getSelectionRegion();
      if (region && region.width > 5 && region.height > 5) {
        await captureRegion(region);
        return;
      }
    }
    // If no drag or tiny drag, check for window click
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
  }, [isDragging, dragStart, dragCurrent, hoveredWindow]);

  const [hidden, setHidden] = useState(false);

  const captureRegion = async (region: Region) => {
    try {
      setHidden(true);
      await new Promise((r) => setTimeout(r, 100));
      const base64 = await invoke<string>("capture_region", { region });
      onCapture(`data:image/png;base64,${base64}`);
    } catch (err) {
      console.error("Capture failed:", err);
      setHidden(false);
      onCancel();
    }
  };

  const getSelectionRegion = (): Region | null => {
    if (!dragStart || !dragCurrent) return null;
    const x = Math.min(dragStart.x, dragCurrent.x);
    const y = Math.min(dragStart.y, dragCurrent.y);
    const width = Math.abs(dragCurrent.x - dragStart.x);
    const height = Math.abs(dragCurrent.y - dragStart.y);
    return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
  };

    const selection = getSelectionRegion();

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] cursor-crosshair select-none"
      style={{ background: "rgba(0,0,0,0.3)", visibility: hidden ? "hidden" : "visible" }}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      tabIndex={0}
      autoFocus
    >
      {/* Instructions */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-lg text-sm pointer-events-none z-10">
        Click and drag to select region · Click a window to capture it ·{" "}
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
            {hoveredWindow.title ? ` — ${hoveredWindow.title}` : ""} ({Math.round(hoveredWindow.width)}×
            {Math.round(hoveredWindow.height)})
          </div>
        </div>
      )}

      {/* Selection rectangle */}
      {isDragging && selection && selection.width > 0 && selection.height > 0 && (
        <>
          {/* Clear area inside selection (remove overlay tint) */}
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
          {/* Dimensions label */}
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
