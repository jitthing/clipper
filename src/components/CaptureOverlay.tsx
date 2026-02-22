import { useEffect, useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SelectionHandles } from "./SelectionHandles";
import { InlineCaptureToolbar } from "./InlineCaptureToolbar";

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

type OverlayPhase = "selecting" | "selected";

interface CaptureOverlayProps {
  screenshotData: string;
  onCapture: (imageData: string) => void;
  onCancel: () => void;
}

export function CaptureOverlay({ screenshotData, onCapture, onCancel }: CaptureOverlayProps) {
  const [phase, setPhase] = useState<OverlayPhase>("selecting");
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [initialRegion, setInitialRegion] = useState<Region | null>(null);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [resizeDragStart, setResizeDragStart] = useState<{ x: number; y: number } | null>(null);

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

  const cropAndReturn = useCallback(
    async (region: Region) => {
      try {
        const base64 = screenshotData.replace(/^data:image\/png;base64,/, "");
        const croppedBase64 = await invoke<string>("crop_image", {
          imageData: base64,
          region,
        });
        onCapture(`data:image/png;base64,${croppedBase64}`);
      } catch (err) {
        console.error("Crop failed:", err);
        onCancel();
      }
    },
    [screenshotData, onCapture, onCancel]
  );

  // ESC to cancel, Enter to confirm
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (phase === "selected") {
          // Go back to selecting
          setPhase("selecting");
          setSelectedRegion(null);
        } else {
          onCancel();
        }
      }
      if (e.key === "Enter" && phase === "selected" && selectedRegion) {
        cropAndReturn(selectedRegion);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel, phase, selectedRegion, cropAndReturn]);

  // Focus the overlay on mount
  useEffect(() => {
    overlayRef.current?.focus();
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
      // Handle resize in selected phase
      if (phase === "selected" && resizeHandle && initialRegion && resizeDragStart) {
        const dx = e.clientX - resizeDragStart.x;
        const dy = e.clientY - resizeDragStart.y;
        let { x, y, width, height } = initialRegion;

        if (resizeHandle.includes("w")) { x += dx; width -= dx; }
        if (resizeHandle.includes("e")) { width += dx; }
        if (resizeHandle.includes("n")) { y += dy; height -= dy; }
        if (resizeHandle.includes("s")) { height += dy; }

        // Flip if dragged past opposite edge
        if (width < 0) { x += width; width = Math.abs(width); }
        if (height < 0) { y += height; height = Math.abs(height); }

        setSelectedRegion({
          x: Math.round(x),
          y: Math.round(y),
          width: Math.max(10, Math.round(width)),
          height: Math.max(10, Math.round(height)),
        });
        return;
      }

      if (phase === "selected") return;

      // Selecting phase
      if (dragStart) {
        const dx = Math.abs(e.clientX - dragStart.x);
        const dy = Math.abs(e.clientY - dragStart.y);
        if (!isDragging && (dx > 3 || dy > 3)) {
          setIsDragging(true);
          setHoveredWindow(null);
        }
        if (isDragging || dx > 3 || dy > 3) {
          setDragCurrent({ x: e.clientX, y: e.clientY });
        }
      } else {
        setHoveredWindow(findWindowAt(e.clientX, e.clientY));
      }
    },
    [phase, resizeHandle, initialRegion, resizeDragStart, dragStart, isDragging, findWindowAt]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (phase === "selected") {
        // Click outside selection → restart
        if (selectedRegion) {
          const { x, y, width, height } = selectedRegion;
          const inSelection =
            e.clientX >= x && e.clientX <= x + width && e.clientY >= y && e.clientY <= y + height;
          if (!inSelection) {
            setPhase("selecting");
            setSelectedRegion(null);
            setDragStart({ x: e.clientX, y: e.clientY });
            setDragCurrent({ x: e.clientX, y: e.clientY });
          }
        }
        return;
      }
      setDragStart({ x: e.clientX, y: e.clientY });
      setDragCurrent({ x: e.clientX, y: e.clientY });
    },
    [phase, selectedRegion]
  );

  const handleMouseDownHandle = useCallback(
    (e: React.MouseEvent, handle: string) => {
      e.stopPropagation();
      setResizeHandle(handle);
      setResizeDragStart({ x: e.clientX, y: e.clientY });
      setInitialRegion(selectedRegion ? { ...selectedRegion } : null);
    },
    [selectedRegion]
  );

  const getSelectionRegion = useCallback((): Region | null => {
    if (!dragStart || !dragCurrent) return null;
    const x = Math.min(dragStart.x, dragCurrent.x);
    const y = Math.min(dragStart.y, dragCurrent.y);
    const width = Math.abs(dragCurrent.x - dragStart.x);
    const height = Math.abs(dragCurrent.y - dragStart.y);
    return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
  }, [dragStart, dragCurrent]);

  const handleMouseUp = useCallback(async () => {
    // End resize
    if (phase === "selected" && resizeHandle) {
      setResizeHandle(null);
      setResizeDragStart(null);
      setInitialRegion(null);
      return;
    }

    if (phase === "selected") return;

    // End drag selection → transition to selected
    if (isDragging && dragStart && dragCurrent) {
      const region = getSelectionRegion();
      if (region && region.width > 5 && region.height > 5) {
        setSelectedRegion(region);
        setPhase("selected");
        setIsDragging(false);
        setDragStart(null);
        setDragCurrent(null);
        return;
      }
    }

    // Click on window → select that window
    if (hoveredWindow) {
      setSelectedRegion({
        x: Math.round(hoveredWindow.x),
        y: Math.round(hoveredWindow.y),
        width: Math.round(hoveredWindow.width),
        height: Math.round(hoveredWindow.height),
      });
      setPhase("selected");
      setIsDragging(false);
      setDragStart(null);
      setDragCurrent(null);
      return;
    }

    setIsDragging(false);
    setDragStart(null);
    setDragCurrent(null);
  }, [phase, resizeHandle, isDragging, dragStart, dragCurrent, hoveredWindow, getSelectionRegion]);

  const currentSelection = phase === "selected" ? selectedRegion : getSelectionRegion();

  return (
    <div
      ref={overlayRef}
      className={`fixed inset-0 z-[9999] ${phase === "selected" ? "cursor-default" : "cursor-crosshair"} select-none`}
      style={{ overflow: "hidden" }}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      tabIndex={0}
      autoFocus
    >
      {/* Full desktop screenshot as background */}
      <img
        src={screenshotData}
        alt=""
        className="absolute inset-0 w-full h-full"
        style={{ objectFit: "fill", pointerEvents: "none" }}
        draggable={false}
      />

      {/* Semi-transparent dark overlay when no selection */}
      {!currentSelection && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "rgba(0,0,0,0.3)" }}
        />
      )}

      {/* Instructions */}
      {phase === "selecting" && !isDragging && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-lg text-sm pointer-events-none z-10">
          Click and drag to select region · Click a window to capture it ·{" "}
          <span className="opacity-70">ESC to cancel</span>
        </div>
      )}

      {/* Hovered window highlight */}
      {hoveredWindow && !isDragging && phase === "selecting" && (
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

      {/* Selection rectangle — cuts through the dark overlay */}
      {currentSelection && currentSelection.width > 0 && currentSelection.height > 0 && (
        <>
          <div
            className={`absolute pointer-events-none ${phase === "selected" ? "border-2 border-blue-400" : "border-2 border-white/80"}`}
            style={{
              left: currentSelection.x,
              top: currentSelection.y,
              width: currentSelection.width,
              height: currentSelection.height,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.3)",
              background: "transparent",
            }}
          />
          {/* Dimensions label */}
          <div
            className="absolute bg-black/80 text-white text-xs px-2 py-1 rounded pointer-events-none z-50"
            style={{
              left: currentSelection.x,
              top: currentSelection.y - 28 > 0 ? currentSelection.y - 28 : currentSelection.y + 4,
            }}
          >
            {currentSelection.width} × {currentSelection.height}
          </div>
        </>
      )}

      {/* Selected phase: handles + inline toolbar */}
      {phase === "selected" && selectedRegion && (
        <>
          <SelectionHandles region={selectedRegion} onMouseDownHandle={handleMouseDownHandle} />
          <InlineCaptureToolbar
            region={selectedRegion}
            screenshotData={screenshotData}
            onConfirm={() => cropAndReturn(selectedRegion)}
            onCancel={onCancel}
            onSave={() => {
              /* TODO: wire save */
            }}
            onCopy={() => {
              /* TODO: wire copy */
            }}
          />
        </>
      )}
    </div>
  );
}
