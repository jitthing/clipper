import { useRef, useEffect } from "react";

interface AnnotationCanvasProps {
  imageData?: ImageData;
  width: number;
  height: number;
}

export function AnnotationCanvas({ width, height }: AnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // TODO: Draw captured screenshot as background
    // TODO: Handle annotation drawing events
    ctx.fillStyle = "#f3f4f6";
    ctx.fillRect(0, 0, width, height);
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="border border-gray-200 shadow-lg"
    />
  );
}
