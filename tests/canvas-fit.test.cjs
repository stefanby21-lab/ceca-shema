const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'arena-geometry.js'), 'utf8'), context);
const { fitCanvas } = context.window.ArenaGeometry;
const ratioOff = (size, w, h) => Math.abs(size.w - (w / h) * size.h);

test('the canvas keeps the plane aspect within one pixel, with and without clamping', () => {
  for (const [w, h, preferred, max] of [[24.4, 10.8, 1024, 4096], [24.4, 10.8, 1024, 2048], [24.4, 10.8, 1024, 1024],
    [47.3, 21.7, 1536, 4096], [47.3, 21.7, 1536, 2048], [47.3, 21.7, 1800, 1024], [3.6, 4.6, 1280, 2048], [3.6, 4.6, 1280, 512], [1, 1, 64, 16]]) {
    const size = fitCanvas(w, h, preferred, max);
    assert.ok(size.w <= max && size.h <= max, JSON.stringify(size));
    assert.ok(ratioOff(size, w, h) <= 1, [w, h, preferred, max, JSON.stringify(size)].join(' '));
  }
});

test('an unclamped canvas uses the preferred height; a clamped one shrinks both sides by one factor', () => {
  const free = fitCanvas(24.4, 10.8, 1024, 4096);
  assert.ok(Math.abs(free.h - 1024) <= 3 && ratioOff(free, 24.4, 10.8) <= 1, JSON.stringify(free));
  const clamped = fitCanvas(24.4, 10.8, 1024, 2048);
  assert.ok(clamped.w <= 2048 && clamped.w >= 2045, JSON.stringify(clamped));
  assert.ok(clamped.h < 1024 && ratioOff(clamped, 24.4, 10.8) <= 1);
});
