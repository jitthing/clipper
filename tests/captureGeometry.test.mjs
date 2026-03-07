import assert from 'node:assert/strict';
import {
  clampPointToViewport,
  clampRegionToViewport,
  computeToolbarPosition,
  mapRegionToImagePixels,
} from '../.tmp-tests/src/utils/captureGeometry.js';

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

test('maps viewport region to scaled image pixels', () => {
  const mapped = mapRegionToImagePixels(
    { x: 100, y: 50, width: 300, height: 200 },
    { width: 1000, height: 500 },
    { width: 2000, height: 1000 }
  );

  assert.deepEqual(mapped, { x: 200, y: 100, width: 600, height: 400 });
});

test('clamps region to viewport bounds with minimum size', () => {
  const clamped = clampRegionToViewport(
    { x: -20, y: 580, width: 1200, height: 300 },
    { width: 800, height: 600 },
    10
  );

  assert.deepEqual(clamped, { x: 0, y: 580, width: 800, height: 20 });
});

test('clamps points to viewport extents', () => {
  const point = clampPointToViewport({ x: 999, y: -10 }, { width: 500, height: 300 });
  assert.deepEqual(point, { x: 500, y: 0 });
});

test('keeps toolbar on-screen for full-screen region', () => {
  const position = computeToolbarPosition(
    { x: 0, y: 0, width: 1920, height: 1080 },
    { width: 1920, height: 1080 },
    { width: 640, height: 44 },
    8
  );

  assert.equal(position.left, 8);
  assert.equal(position.top, 1028);
});

test('falls back to clamped top when neither above nor below fit', () => {
  const position = computeToolbarPosition(
    { x: 5, y: 10, width: 100, height: 40 },
    { width: 320, height: 120 },
    { width: 280, height: 100 },
    8
  );

  assert.equal(position.left, 8);
  assert.equal(position.top, 12);
});
