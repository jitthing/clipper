import { useEffect, useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { SelectionHandles } from "./SelectionHandles";
import { InlineCaptureToolbar } from "./InlineCaptureToolbar";
import { useCaptureStore, genId, type Annotation } from "../stores/captureStore";
import { renderAllAnnotations, renderAnnotation } from "../utils/canvas";

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

  // Annotation canvas state
  const annotationCanvasRef = useRef<HTMLCanvasElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [bgReady, setBgReady] = useState(false);

  const {
    activeTool,
    color,
    strokeWidth,
    fontSize,
    blurSize,
    annotations,
    addAnnotation,
    clearAnnotations,
    nextNumber,
  } = useCaptureStore();

  const [isAnnotDrawing, setIsAnnotDrawing] = useState(false);
  const [annotStartPos, setAnnotStartPos] = useState<{ x: number; y: number } | null>(null);
  const [annotCurrentPos, setAnnotCurrentPos] = useState<{ x: number; y: number } | null>(null);
  const [penPoints, setPenPoints] = useState<{ x: number; y: number }[]>([]);

  // Fetch window list on mount
  useEffect(() => {
    invoke<WindowInfo[]>("list_windows")
      .then(setWindows)
      .catch(console.error);
  }, []);

  // Initialize bgCanvasRef when region is selected
  useEffect(() => {
    if (phase !== "selected" || !selectedRegion) {
      setBgReady(false);
      return;
    }
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = selectedRegion.width;
      canvas.height = selectedRegion.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(
        img,
        selectedRegion.x, selectedRegion.y, selectedRegion.width, selectedRegion.height,
        0, 0, selectedRegion.width, selectedRegion.height
      );
      bgCanvasRef.current = canvas;
      setBgReady(true);
    };
    img.src = screenshotData;
  }, [phase, selectedRegion, screenshotData]);

  const exportWithAnnotations = useCallback(() => {
    const region = selectedRegion!;
    const offscreen = document.createElement("canvas");
    offscreen.width = region.width;
    offscreen.height = region.height;
    const ctx = offscreen.getContext("2d")!;

    if (bgCanvasRef.current) {
      ctx.drawImage(bgCanvasRef.current, 0, 0);
    }

    renderAllAnnotations(ctx, annotations, bgCanvasRef.current || undefined);

    return offscreen.toDataURL("image/png");
  }, [selectedRegion, annotations]);

  const handleConfirm = useCallback(() => {
    const dataUrl = exportWithAnnotations();
    onCapture(dataUrl);
  }, [exportWithAnnotations, onCapture]);

  const handleCopy = useCallback(async () => {
    try {
      const dataUrl = exportWithAnnotations();
      const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
      await invoke("copy_to_clipboard", { imageData: base64 });
      onCancel();
    } catch (err) {
      console.error("Copy failed:", err);
    }
  }, [exportWithAnnotations, onCancel]);

  const handleSave = useCallback(async () => {
    try {
      const dataUrl = exportWithAnnotations();
      const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
      const path = await save({
        filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg"] }],
        defaultPath: `snaplark-${Date.now()}.png`,
      });
      if (path) {
        const format = path.toLowerCase().endsWith(".jpg") || path.toLowerCase().endsWith(".jpeg") ? "jpg" : "png";
        await invoke("save_to_file", { imageData: base64, path, format });
        onCancel();
      }
    } catch (err) {
      console.error("Save failed:", err);
    }
  }, [exportWithAnnotations, onCancel]);

  // ESC to cancel/back, Enter to confirm
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (phase === "selected") {
          setPhase("selecting");
          setSelectedRegion(null);
          clearAnnotations();
        } else {
          onCancel();
        }
      }
      if (e.key === "Enter" && phase === "selected" && selectedRegion) {
        handleConfirm();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel, phase, selectedRegion, handleConfirm, clearAnnotations]);

  // Focus overlay on mount
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

  // --- Annotation mouse handlers ---
  const getAnnotPos = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!selectedRegion) return { x: 0, y: 0 };
      return {
        x: e.clientX - selectedRegion.x,
        y: e.clientY - selectedRegion.y,
      };
    },
    [selectedRegion]
  );

  const handleAnnotationMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.stopPropagation();

      if (activeTool === "text") {
        const pos = getAnnotPos(e);
        const text = prompt("Enter text:");
        if (text) {
          addAnnotation({
            id: genId(),
            tool: "text",
            startX: pos.x, startY: pos.y,
            endX: pos.x, endY: pos.y,
            color, strokeWidth,
            text, fontSize,
          });
        }
        return;
      }
      if (activeTool === "number") {
        const pos = getAnnotPos(e);
        addAnnotation({
          id: genId(),
          tool: "number",
          startX: pos.x, startY: pos.y,
          endX: pos.x, endY: pos.y,
          color, strokeWidth,
          number: nextNumber,
        });
        return;
      }

      setIsAnnotDrawing(true);
      const pos = getAnnotPos(e);
      setAnnotStartPos(pos);
      setAnnotCurrentPos(pos);
      if (activeTool === "pen") {
        setPenPoints([pos]);
      }
    },
    [activeTool, getAnnotPos, color, strokeWidth, fontSize, nextNumber, addAnnotation]
  );

  const handleAnnotationMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isAnnotDrawing) return;
      const pos = getAnnotPos(e);
      setAnnotCurrentPos(pos);
      if (activeTool === "pen") {
        setPenPoints((prev) => [...prev, pos]);
      }
    },
    [isAnnotDrawing, getAnnotPos, activeTool]
  );

  const handleAnnotationMouseUp = useCallback(() => {
    if (!isAnnotDrawing || !annotStartPos || !annotCurrentPos) return;
    setIsAnnotDrawing(false);

    if (activeTool !== "pen") {
      const dx = Math.abs(annotCurrentPos.x - annotStartPos.x);
      const dy = Math.abs(annotCurrentPos.y - annotStartPos.y);
      if (dx < 2 && dy < 2) {
        setAnnotStartPos(null);
        setAnnotCurrentPos(null);
        setPenPoints([]);
        return;
      }
    }

    addAnnotation({
      id: genId(),
      tool: activeTool,
      startX: annotStartPos.x, startY: annotStartPos.y,
      endX: annotCurrentPos.x, endY: annotCurrentPos.y,
      color, strokeWidth,
      blurSize: activeTool === "blur" ? blurSize : undefined,
      points: activeTool === "pen" ? penPoints : undefined,
    });

    setAnnotStartPos(null);
    setAnnotCurrentPos(null);
    setPenPoints([]);
  }, [isAnnotDrawing, annotStartPos, annotCurrentPos, activeTool, color, strokeWidth, blurSize, penPoints, addAnnotation]);

  // Re-render annotations when store changes or during drawing
  useEffect(() => {
    if (!annotationCanvasRef.current || phase !== "selected" || !selectedRegion) return;
    const ctx = annotationCanvasRef.current.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, selectedRegion.width, selectedRegion.height);

    const source = bgReady ? bgCanvasRef.current || undefined : undefined;
    renderAllAnnotations(ctx, annotations, source);

    if (isAnnotDrawing && annotStartPos && annotCurrentPos) {
      const preview: Annotation = {
        id: "preview",
        tool: activeTool,
        startX: annotStartPos.x, startY: annotStartPos.y,
        endX: annotCurrentPos.x, endY: annotCurrentPos.y,
        color, strokeWidth,
        blurSize: activeTool === "blur" ? blurSize : undefined,
        points: activeTool === "pen" ? penPoints : undefined,
      };
      renderAnnotation(ctx, preview, source);
    }
  }, [annotations, phase, selectedRegion, isAnnotDrawing, annotStartPos, annotCurrentPos, activeTool, color, strokeWidth, blurSize, penPoints, bgReady]);

  // --- Selection phase mouse handlers ---
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (phase === "selected" && resizeHandle && initialRegion && resizeDragStart) {
        const dx = e.clientX - resizeDragStart.x;
        const dy = e.clientY - resizeDragStart.y;
        let { x, y, width, height } = initialRegion;

        if (resizeHandle.includes("w")) { x += dx; width -= dx; }
        if (resizeHandle.includes("e")) { width += dx; }
        if (resizeHandle.includes("n")) { y += dy; height -= dy; }
        if (resizeHandle.includes("s")) { height += dy; }

        if (width < 0) { x += width; width = Math.abs(width); }
        if (height < 0) { y += height; height = Math.abs(height); }

        setSelectedRegion({
          x: Math.round(x), y: Math.round(y),
          width: Math.max(10, Math.round(width)),
          height: Math.max(10, Math.round(height)),
        });
        return;
      }

      if (phase === "selected") return;

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
        if (selectedRegion) {
          const { x, y, width, height } = selectedRegion;
          const inSelection =
            e.clientX >= x && e.clientX <= x + width && e.clientY >= y && e.clientY <= y + height;
          if (!inSelection) {
            setPhase("selecting");
            setSelectedRegion(null);
            clearAnnotations();
            setDragStart({ x: e.clientX, y: e.clientY });
            setDragCurrent({ x: e.clientX, y: e.clientY });
          }
        }
        return;
      }
      setDragStart({ x: e.clientX, y: e.clientY });
      setDragCurrent({ x: e.clientX, y: e.clientY });
    },
    [phase, selectedRegion, clearAnnotations]
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
    if (phase === "selected" && resizeHandle) {
      setResizeHandle(null);
      setResizeDragStart(null);
      setInitialRegion(null);
      return;
    }

    if (phase === "selected") return;

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
        <div className="absolute inset-0 pointer-events-none" style={{ background: "rgba(0,0,0,0.3)" }} />
      )}

      {/* Instructions */}
      {phase === "selecting" && !isDragging && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-lg text-sm pointer-events-none z-10">
          Click and drag to select region · Click a window to capture it · <span className="opacity-70">ESC to cancel</span>
        </div>
      )}

      {/* Hovered window highlight */}
      {hoveredWindow && !isDragging && phase === "selecting" && (
        <div
          className="absolute border-2 border-blue-400 bg-blue-400/10 pointer-events-none"
          style={{ left: hoveredWindow.x, top: hoveredWindow.y, width: hoveredWindow.width, height: hoveredWindow.height }}
        >
          <div className="absolute -top-6 left-0 bg-blue-500 text-white text-xs px-2 py-0.5 rounded whitespace-nowrap">
            {hoveredWindow.app_name}
            {hoveredWindow.title ? ` — ${hoveredWindow.title}` : ""} ({Math.round(hoveredWindow.width)}×{Math.round(hoveredWindow.height)})
          </div>
        </div>
      )}

      {/* Selection rectangle */}
      {currentSelection && currentSelection.width > 0 && currentSelection.height > 0 && (
        <>
          <div
            className={`absolute pointer-events-none ${phase === "selected" ? "border-2 border-blue-400" : "border-2 border-white/80"}`}
            style={{
              left: currentSelection.x, top: currentSelection.y,
              width: currentSelection.width, height: currentSelection.height,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.3)",
              background: "transparent",
            }}
          />
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

      {/* Selected phase: annotation canvas + handles + toolbar */}
      {phase === "selected" && selectedRegion && (
        <>
          <canvas
            ref={annotationCanvasRef}
            width={selectedRegion.width}
            height={selectedRegion.height}
            className="absolute"
            style={{
              left: selectedRegion.x, top: selectedRegion.y,
              width: selectedRegion.width, height: selectedRegion.height,
              cursor: "crosshair",
              zIndex: 45,
            }}
            onMouseDown={handleAnnotationMouseDown}
            onMouseMove={handleAnnotationMouseMove}
            onMouseUp={handleAnnotationMouseUp}
          />
          <SelectionHandles region={selectedRegion} onMouseDownHandle={handleMouseDownHandle} />
          <InlineCaptureToolbar
            region={selectedRegion}
            screenshotData={screenshotData}
            onConfirm={handleConfirm}
            onCancel={onCancel}
            onSave={handleSave}
            onCopy={handleCopy}
          />
        </>
      )}
    </div>
  );
}
