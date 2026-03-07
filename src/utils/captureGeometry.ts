export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export function clamp(value: number, min: number, max: number): number {
  if (max < min) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

export function clampPointToViewport(point: Point, viewport: Size): Point {
  return {
    x: clamp(point.x, 0, viewport.width),
    y: clamp(point.y, 0, viewport.height),
  };
}

export function clampRegionToViewport(region: Region, viewport: Size, minSize = 10): Region {
  if (viewport.width <= 0 || viewport.height <= 0) {
    return { x: 0, y: 0, width: minSize, height: minSize };
  }

  const x = clamp(Math.round(region.x), 0, viewport.width - 1);
  const y = clamp(Math.round(region.y), 0, viewport.height - 1);

  const maxWidth = Math.max(1, viewport.width - x);
  const maxHeight = Math.max(1, viewport.height - y);

  const width = clamp(Math.round(region.width), Math.min(minSize, maxWidth), maxWidth);
  const height = clamp(Math.round(region.height), Math.min(minSize, maxHeight), maxHeight);

  return { x, y, width, height };
}

export function mapRegionToImagePixels(region: Region, viewport: Size, image: Size): Region {
  if (
    viewport.width <= 0 ||
    viewport.height <= 0 ||
    image.width <= 0 ||
    image.height <= 0
  ) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }

  const scaleX = image.width / viewport.width;
  const scaleY = image.height / viewport.height;

  const startX = clamp(Math.round(region.x * scaleX), 0, image.width - 1);
  const startY = clamp(Math.round(region.y * scaleY), 0, image.height - 1);
  const endX = clamp(Math.round((region.x + region.width) * scaleX), startX + 1, image.width);
  const endY = clamp(Math.round((region.y + region.height) * scaleY), startY + 1, image.height);

  return {
    x: startX,
    y: startY,
    width: Math.max(1, endX - startX),
    height: Math.max(1, endY - startY),
  };
}

export function computeToolbarPosition(
  region: Region,
  viewport: Size,
  toolbar: Size,
  margin = 8
): { left: number; top: number } {
  const safeWidth = Math.max(1, viewport.width);
  const safeHeight = Math.max(1, viewport.height);
  const toolbarWidth = Math.max(1, toolbar.width);
  const toolbarHeight = Math.max(1, toolbar.height);

  const maxLeft = Math.max(margin, safeWidth - toolbarWidth - margin);
  const left = clamp(region.x, margin, maxLeft);

  const belowTop = region.y + region.height + margin;
  const aboveTop = region.y - toolbarHeight - margin;
  const fitsBelow = belowTop + toolbarHeight <= safeHeight - margin;
  const fitsAbove = aboveTop >= margin;

  if (fitsBelow) {
    return { left, top: belowTop };
  }

  if (fitsAbove) {
    return { left, top: aboveTop };
  }

  const maxTop = Math.max(margin, safeHeight - toolbarHeight - margin);
  return {
    left,
    top: clamp(belowTop, margin, maxTop),
  };
}
