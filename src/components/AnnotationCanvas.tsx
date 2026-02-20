import { useRef, useEffect, useState, useCallback } from "react";
import { useCaptureStore, genId, type Annotation } from "../stores/captureStore";
import { renderAllAnnotations, renderAnnotation } from "../utils/canvas";

interface AnnotationCanvasProps {
  backgroundImage: HTMLImageElement | null;
  width: number;
  height: number;
}

export function AnnotationCanvas({ backgroundImage, width, height }: AnnotationCanvasProps) {
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    activeTool, color, strokeWidth, fontSize, blurSize,
    annotations, addAnnotation, nextNumber,
  } = useCaptureStore();

  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });
  const [textInput, setTextInput] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0, y: 0, visible: false,
  });
  const [textValue, setTextValue] = useState("");
  const textInputRef = useRef<HTMLInputElement>(null);

  // Draw background image
  useEffect(() => {
    const canvas = bgCanvasRef.current;
    if (!canvas || !backgroundImage) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(backgroundImage, 0, 0, width, height);
  }, [backgroundImage, width, height]);

  // Redraw annotations layer
  const redrawAnnotations = useCallback(() => {
    const canvas = drawCanvasRef.current;
    const bgCanvas = bgCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    renderAllAnnotations(ctx, annotations, bgCanvas || undefined);
  }, [annotations, width, height]);

  useEffect(() => {
    redrawAnnotations();
  }, [redrawAnnotations]);

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

  const handleMouseDown = (e: React.MouseEvent) => {
    if (textInput.visible) return;
    const pos = getPos(e);

    if (activeTool === "text") {
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
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    const pos = getPos(e);
    setCurrentPos(pos);

    // Draw preview
    const canvas = drawCanvasRef.current;
    const bgCanvas = bgCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    renderAllAnnotations(ctx, annotations, bgCanvas || undefined);

    // Preview current shape
    ctx.save();
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
    renderAnnotation(ctx, preview, bgCanvas || undefined);
    ctx.restore();
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const dx = currentPos.x - startPos.x;
    const dy = currentPos.y - startPos.y;
    if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
      redrawAnnotations();
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
  const maxH = typeof window !== "undefined" ? window.innerHeight - 120 : height;
  const scale = Math.min(1, maxW / width, maxH / height);
  const displayW = width * scale;
  const displayH = height * scale;

  return (
    <div
      ref={containerRef}
      className="relative inline-block"
      style={{ width: displayW, height: displayH }}
    >
      {/* Background layer */}
      <canvas
        ref={bgCanvasRef}
        width={width}
        height={height}
        className="absolute top-0 left-0 w-full h-full"
        style={{ imageRendering: "auto" }}
      />
      {/* Annotation drawing layer */}
      <canvas
        ref={drawCanvasRef}
        width={width}
        height={height}
        className="absolute top-0 left-0 w-full h-full cursor-crosshair"
        style={{ imageRendering: "auto" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          if (isDrawing) handleMouseUp();
        }}
      />
      {/* Text input overlay */}
      {textInput.visible && (
        <input
          ref={textInputRef}
          type="text"
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          onKeyDown={handleTextKeyDown}
          onBlur={handleTextSubmit}
          className="absolute z-10 bg-transparent border-b-2 border-current outline-none"
          style={{
            left: (textInput.x / width) * displayW,
            top: (textInput.y / height) * displayH,
            color,
            fontSize: `${fontSize * scale}px`,
            fontFamily: "sans-serif",
            minWidth: 100,
          }}
          autoFocus
        />
      )}
    </div>
  );
}
