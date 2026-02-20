/**
 * Canvas utility functions for annotation rendering.
 */

import type { Annotation, BlurSize } from "../stores/captureStore";

export function drawArrow(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  color: string,
  width: number
) {
  const headLength = Math.max(15, width * 4);
  const angle = Math.atan2(toY - fromY, toX - fromX);

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();

  // Arrowhead
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headLength * Math.cos(angle - Math.PI / 6),
    toY - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    toX - headLength * Math.cos(angle + Math.PI / 6),
    toY - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();
}

export function drawRectangle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  lineWidth: number
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = "round";
  ctx.strokeRect(x, y, w, h);
}

export function drawEllipse(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  lineWidth: number
) {
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const rx = Math.abs(x2 - x1) / 2;
  const ry = Math.abs(y2 - y1) / 2;

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
}

export function drawLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  lineWidth: number
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  color: string,
  fontSize: number
) {
  ctx.fillStyle = color;
  ctx.font = `${fontSize}px sans-serif`;
  ctx.textBaseline = "top";
  ctx.fillText(text, x, y);
}

export function drawNumber(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  num: number,
  color: string,
  size: number
) {
  const radius = Math.max(12, size);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${radius}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(num), x, y);

  // Reset
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
}

const BLUR_BLOCK_SIZES: Record<BlurSize, number> = {
  small: 6,
  medium: 12,
  large: 20,
};

export function applyMosaic(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  blurSize: BlurSize = "medium",
  sourceCanvas?: HTMLCanvasElement
) {
  if (w === 0 || h === 0) return;
  const blockSize = BLUR_BLOCK_SIZES[blurSize];

  // Read from source canvas (the background image) if available
  const sourceCtx = sourceCanvas ? sourceCanvas.getContext("2d") : ctx;
  if (!sourceCtx) return;

  const safeX = Math.max(0, Math.round(x));
  const safeY = Math.max(0, Math.round(y));
  const safeW = Math.min(Math.round(w), (sourceCanvas || ctx.canvas).width - safeX);
  const safeH = Math.min(Math.round(h), (sourceCanvas || ctx.canvas).height - safeY);
  if (safeW <= 0 || safeH <= 0) return;

  const imageData = sourceCtx.getImageData(safeX, safeY, safeW, safeH);
  const { data } = imageData;

  for (let py = 0; py < safeH; py += blockSize) {
    for (let px = 0; px < safeW; px += blockSize) {
      // Average the block
      let r = 0, g = 0, b = 0, count = 0;
      for (let by = 0; by < blockSize && py + by < safeH; by++) {
        for (let bx = 0; bx < blockSize && px + bx < safeW; bx++) {
          const i = ((py + by) * safeW + (px + bx)) * 4;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }
      }
      r = Math.round(r / count);
      g = Math.round(g / count);
      b = Math.round(b / count);

      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(
        safeX + px,
        safeY + py,
        Math.min(blockSize, safeW - px),
        Math.min(blockSize, safeH - py)
      );
    }
  }
}

/** Render a single annotation onto the canvas */
export function renderAnnotation(
  ctx: CanvasRenderingContext2D,
  ann: Annotation,
  sourceCanvas?: HTMLCanvasElement
) {
  switch (ann.tool) {
    case "arrow":
      drawArrow(ctx, ann.startX, ann.startY, ann.endX, ann.endY, ann.color, ann.strokeWidth);
      break;
    case "rectangle": {
      const w = ann.endX - ann.startX;
      const h = ann.endY - ann.startY;
      drawRectangle(ctx, ann.startX, ann.startY, w, h, ann.color, ann.strokeWidth);
      break;
    }
    case "circle":
      drawEllipse(ctx, ann.startX, ann.startY, ann.endX, ann.endY, ann.color, ann.strokeWidth);
      break;
    case "line":
      drawLine(ctx, ann.startX, ann.startY, ann.endX, ann.endY, ann.color, ann.strokeWidth);
      break;
    case "text":
      if (ann.text) {
        drawText(ctx, ann.startX, ann.startY, ann.text, ann.color, ann.fontSize || 16);
      }
      break;
    case "number":
      drawNumber(ctx, ann.startX, ann.startY, ann.number || 1, ann.color, ann.strokeWidth * 6);
      break;
    case "blur": {
      const bx = Math.min(ann.startX, ann.endX);
      const by = Math.min(ann.startY, ann.endY);
      const bw = Math.abs(ann.endX - ann.startX);
      const bh = Math.abs(ann.endY - ann.startY);
      applyMosaic(ctx, bx, by, bw, bh, ann.blurSize || "medium", sourceCanvas);
      break;
    }
  }
}

/** Render all annotations */
export function renderAllAnnotations(
  ctx: CanvasRenderingContext2D,
  annotations: Annotation[],
  sourceCanvas?: HTMLCanvasElement
) {
  for (const ann of annotations) {
    ctx.save();
    renderAnnotation(ctx, ann, sourceCanvas);
    ctx.restore();
  }
}

/** Export the final composited image as a data URL */
export function exportCanvas(
  bgCanvas: HTMLCanvasElement,
  annotations: Annotation[],
  format: "png" | "jpg" = "png",
  quality = 0.92
): string {
  const w = bgCanvas.width;
  const h = bgCanvas.height;
  const offscreen = document.createElement("canvas");
  offscreen.width = w;
  offscreen.height = h;
  const ctx = offscreen.getContext("2d")!;

  // Draw background
  ctx.drawImage(bgCanvas, 0, 0);

  // Draw annotations
  renderAllAnnotations(ctx, annotations, bgCanvas);

  const mimeType = format === "jpg" ? "image/jpeg" : "image/png";
  return offscreen.toDataURL(mimeType, quality);
}
