import { useRef, useEffect, useState, useCallback } from "react";
import { useCaptureStore, genId, type Annotation } from "../stores/captureStore";
import { renderAllAnnotations, renderAnnotation } from "../utils/canvas";

interface AnnotationCanvasProps {
  backgroundImage: HTMLImageElement | null;
  width: number;
  height: number;
}

function distanceToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) {
    return Math.hypot(px - x1, py - y1);
  }
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  const sx = x1 + t * dx;
  const sy = y1 + t * dy;
  return Math.hypot(px - sx, py - sy);
}

function getBounds(ann: Annotation): { x: number; y: number; w: number; h: number } {
  if (ann.tool === "pen" && ann.points && ann.points.length > 0) {
    const xs = ann.points.map((p) => p.x);
    const ys = ann.points.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const pad = ann.strokeWidth + 6;
    return { x: minX - pad, y: minY - pad, w: Math.max(1, maxX - minX + pad * 2), h: Math.max(1, maxY - minY + pad * 2) };
  }

  const x = Math.min(ann.startX, ann.endX);
  const y = Math.min(ann.startY, ann.endY);
  const w = Math.max(1, Math.abs(ann.endX - ann.startX));
  const h = Math.max(1, Math.abs(ann.endY - ann.startY));

  if (ann.tool === "text") {
    const fontSize = ann.fontSize || 16;
    const textWidth = Math.max(40, (ann.text?.length || 1) * fontSize * 0.6);
    return { x: ann.startX - 4, y: ann.startY - 4, w: textWidth + 8, h: fontSize + 8 };
  }

  if (ann.tool === "number") {
    const radius = Math.max(12, ann.strokeWidth * 6);
    return {
      x: ann.startX - radius,
      y: ann.startY - radius,
      w: radius * 2,
      h: radius * 2,
    };
  }

  const pad = ann.strokeWidth + 4;
  return { x: x - pad, y: y - pad, w: w + pad * 2, h: h + pad * 2 };
}

function hitTestAnnotation(ann: Annotation, x: number, y: number): boolean {
  if (ann.tool === "line" || ann.tool === "arrow") {
    const threshold = Math.max(8, ann.strokeWidth * 3);
    return distanceToSegment(x, y, ann.startX, ann.startY, ann.endX, ann.endY) <= threshold;
  }

  if (ann.tool === "pen" && ann.points && ann.points.length > 1) {
    const threshold = Math.max(8, ann.strokeWidth * 3);
    for (let i = 0; i < ann.points.length - 1; i++) {
      const p1 = ann.points[i];
      const p2 = ann.points[i + 1];
      if (distanceToSegment(x, y, p1.x, p1.y, p2.x, p2.y) <= threshold) return true;
    }
    return false;
  }

  if (ann.tool === "circle") {
    const cx = (ann.startX + ann.endX) / 2;
    const cy = (ann.startY + ann.endY) / 2;
    const rx = Math.abs(ann.endX - ann.startX) / 2;
    const ry = Math.abs(ann.endY - ann.startY) / 2;
    if (rx < 1 || ry < 1) return false;
    const norm = ((x - cx) * (x - cx)) / (rx * rx) + ((y - cy) * (y - cy)) / (ry * ry);
    return norm <= 1.2;
  }

  const bounds = getBounds(ann);
  return x >= bounds.x && x <= bounds.x + bounds.w && y >= bounds.y && y <= bounds.y + bounds.h;
}

function drawSelectionOutline(ctx: CanvasRenderingContext2D, ann: Annotation) {
  const { x, y, w, h } = getBounds(ann);
  const handle = 6;

  ctx.save();
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#60a5fa";
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);
  ctx.fillStyle = "#60a5fa";
  ctx.fillRect(x - handle / 2, y - handle / 2, handle, handle);
  ctx.fillRect(x + w - handle / 2, y - handle / 2, handle, handle);
  ctx.fillRect(x - handle / 2, y + h - handle / 2, handle, handle);
  ctx.fillRect(x + w - handle / 2, y + h - handle / 2, handle, handle);
  ctx.restore();
}

export function AnnotationCanvas({ backgroundImage, width, height }: AnnotationCanvasProps) {
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    activeTool,
    color,
    strokeWidth,
    fontSize,
    blurSize,
    annotations,
    addAnnotation,
    nextNumber,
    selectedAnnotationId,
    setSelectedAnnotation,
    deleteSelected,
  } = useCaptureStore();

  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });
  const [penPoints, setPenPoints] = useState<{ x: number; y: number }[]>([]);
  const [textInput, setTextInput] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });
  const [textValue, setTextValue] = useState("");
  const textInputRef = useRef<HTMLInputElement>(null);

  const renderScene = useCallback(
    (preview?: Annotation) => {
      const canvas = drawCanvasRef.current;
      const bgCanvas = bgCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, width, height);
      renderAllAnnotations(ctx, annotations, bgCanvas || undefined);

      if (preview) {
        ctx.save();
        renderAnnotation(ctx, preview, bgCanvas || undefined);
        ctx.restore();
      }

      if (selectedAnnotationId) {
        const selected = annotations.find((ann) => ann.id === selectedAnnotationId);
        if (selected) {
          drawSelectionOutline(ctx, selected);
        }
      }
    },
    [annotations, selectedAnnotationId, width, height]
  );

  // Draw background image
  useEffect(() => {
    const canvas = bgCanvasRef.current;
    if (!canvas || !backgroundImage) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(backgroundImage, 0, 0, width, height);
  }, [backgroundImage, width, height]);

  useEffect(() => {
    renderScene();
  }, [renderScene]);

  // Delete selected annotation with keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (textInput.visible) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedAnnotationId) {
        e.preventDefault();
        deleteSelected();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteSelected, selectedAnnotationId, textInput.visible]);

  // Get mouse position relative to canvas
  const getPos = (e: React.MouseEvent) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const getTopHit = useCallback(
    (x: number, y: number): Annotation | null => {
      for (let i = annotations.length - 1; i >= 0; i--) {
        if (hitTestAnnotation(annotations[i], x, y)) {
          return annotations[i];
        }
      }
      return null;
    },
    [annotations]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    if (textInput.visible) return;
    const pos = getPos(e);

    if (activeTool === "text") {
      setSelectedAnnotation(null);
      setTextInput({ x: pos.x, y: pos.y, visible: true });
      setTextValue("");
      setTimeout(() => textInputRef.current?.focus(), 0);
      return;
    }

    if (activeTool === "number") {
      const ann: Annotation = {
        id: genId(),
        tool: "number",
        startX: pos.x,
        startY: pos.y,
        endX: pos.x,
        endY: pos.y,
        color,
        strokeWidth,
        number: nextNumber,
      };
      addAnnotation(ann);
      return;
    }

    setIsDrawing(true);
    setStartPos(pos);
    setCurrentPos(pos);

    if (activeTool === "pen") {
      setPenPoints([pos]);
      const preview: Annotation = {
        id: "preview",
        tool: "pen",
        startX: pos.x,
        startY: pos.y,
        endX: pos.x,
        endY: pos.y,
        color,
        strokeWidth,
        points: [pos],
      };
      renderScene(preview);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    const pos = getPos(e);
    setCurrentPos(pos);

    if (activeTool === "pen") {
      setPenPoints((prev) => {
        const next = [...prev, pos];
        const preview: Annotation = {
          id: "preview",
          tool: "pen",
          startX: next[0].x,
          startY: next[0].y,
          endX: pos.x,
          endY: pos.y,
          color,
          strokeWidth,
          points: next,
        };
        renderScene(preview);
        return next;
      });
      return;
    }

    const preview: Annotation = {
      id: "preview",
      tool: activeTool,
      startX: startPos.x,
      startY: startPos.y,
      endX: pos.x,
      endY: pos.y,
      color,
      strokeWidth,
      blurSize,
    };
    renderScene(preview);
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (activeTool === "pen") {
      const first = penPoints[0];
      const last = penPoints[penPoints.length - 1];
      if (first && last && Math.hypot(last.x - first.x, last.y - first.y) < 3) {
        const hit = getTopHit(last.x, last.y);
        setSelectedAnnotation(hit?.id || null);
        setPenPoints([]);
        renderScene();
        return;
      }

      if (penPoints.length > 0 && first && last) {
        const ann: Annotation = {
          id: genId(),
          tool: "pen",
          startX: first.x,
          startY: first.y,
          endX: last.x,
          endY: last.y,
          color,
          strokeWidth,
          points: penPoints,
        };
        addAnnotation(ann);
      }
      setPenPoints([]);
      return;
    }

    const dx = currentPos.x - startPos.x;
    const dy = currentPos.y - startPos.y;
    if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
      const hit = getTopHit(currentPos.x, currentPos.y);
      setSelectedAnnotation(hit?.id || null);
      renderScene();
      return;
    }

    const ann: Annotation = {
      id: genId(),
      tool: activeTool,
      startX: startPos.x,
      startY: startPos.y,
      endX: currentPos.x,
      endY: currentPos.y,
      color,
      strokeWidth,
      blurSize: activeTool === "blur" ? blurSize : undefined,
    };
    addAnnotation(ann);
  };

  const handleTextSubmit = () => {
    if (textValue.trim()) {
      const ann: Annotation = {
        id: genId(),
        tool: "text",
        startX: textInput.x,
        startY: textInput.y,
        endX: textInput.x,
        endY: textInput.y,
        color,
        strokeWidth,
        text: textValue,
        fontSize,
      };
      addAnnotation(ann);
    }
    setTextInput({ x: 0, y: 0, visible: false });
    setTextValue("");
  };

  const handleTextKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleTextSubmit();
    } else if (e.key === "Escape") {
      setTextInput({ x: 0, y: 0, visible: false });
      setTextValue("");
    }
  };

  // Compute display size (fit within viewport)
  const maxW = typeof window !== "undefined" ? window.innerWidth - 48 : width;
  const maxH = typeof window !== "undefined" ? window.innerHeight - 144 : height;
  const scale = Math.min(1, maxW / width, maxH / height);
  const displayW = width * scale;
  const displayH = height * scale;

  return (
    <div
      ref={containerRef}
      className="relative inline-block"
      style={{ width: displayW, height: displayH }}
    >
      <canvas
        ref={bgCanvasRef}
        width={width}
        height={height}
        className="absolute top-0 left-0 w-full h-full"
        style={{ imageRendering: "auto" }}
      />
      <canvas
        ref={drawCanvasRef}
        width={width}
        height={height}
        className="absolute top-0 left-0 h-full w-full cursor-crosshair"
        style={{ imageRendering: "auto" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          if (isDrawing) handleMouseUp();
        }}
      />
      {textInput.visible && (
        <input
          ref={textInputRef}
          type="text"
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          onKeyDown={handleTextKeyDown}
          onBlur={handleTextSubmit}
          className="absolute z-10 min-w-24 border-b-2 border-current bg-transparent outline-none"
          style={{
            left: (textInput.x / width) * displayW,
            top: (textInput.y / height) * displayH,
            color,
            fontSize: `${fontSize * scale}px`,
            fontFamily: "sans-serif",
          }}
          autoFocus
        />
      )}
    </div>
  );
}
