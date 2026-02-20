/**
 * Canvas utility functions for annotation rendering.
 */

export function drawArrow(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  color: string,
  width: number
) {
  const headLength = 15;
  const angle = Math.atan2(toY - fromY, toX - fromX);

  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headLength * Math.cos(angle - Math.PI / 6),
    toY - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headLength * Math.cos(angle + Math.PI / 6),
    toY - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.stroke();
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
  ctx.strokeRect(x, y, w, h);
}

export function applyMosaic(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  blockSize: number = 10
) {
  const imageData = ctx.getImageData(x, y, w, h);
  const { data } = imageData;

  for (let py = 0; py < h; py += blockSize) {
    for (let px = 0; px < w; px += blockSize) {
      const i = (py * w + px) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];

      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x + px, y + py, blockSize, blockSize);
    }
  }
}
