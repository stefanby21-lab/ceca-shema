// Жестовете на SVG плана: докато пръстът е върху картата, кадърът е CSS преобразуване на
// замразения чертеж. Тук е математиката му и пазачът срещу промяна на размера по средата.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'map-svg.js'), 'utf8');
const context = { window: {}, document: {} };
vm.createContext(context);
vm.runInContext(source, context);
const liveFrame = context.window.SeatMap._liveFrame;
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} vs ${b}`);

// Точка p на чертежа е на екрана при кадър c в ((p.x - c.x) / c.w * W, (p.y - c.y) / c.h * H).
const screenOf = (c, p, W, H) => [(p[0] - c.x) / c.w * W, (p[1] - c.y) / c.h * H];

test('the live transform puts every drawing point where the real camera would, for pan and zoom', () => {
  const W = 390, H = 650, ratio = H / W;
  const base = { x: 100, y: 200, w: 800, h: 800 * ratio };
  const cams = [
    { x: 100, y: 200, w: 800, h: 800 * ratio },
    { x: 340, y: -120, w: 800, h: 800 * ratio },
    { x: 366.6, y: 120, w: 200, h: 200 * ratio },
    { x: -50, y: 900, w: 55, h: 55 * ratio },
  ];
  for (const cam of cams) {
    const f = liveFrame(base, cam, W, H);
    for (const p of [[0, 0], [100, 200], [500, 700], [2500, 2500], [-300, 40]]) {
      const [sx, sy] = screenOf(base, p, W, H);
      const want = screenOf(cam, p, W, H);
      near(f.tx + f.k * sx, want[0], 'x');
      near(f.ty + f.k * sy, want[1], 'y');
    }
  }
});

test('the identity camera gives the identity transform', () => {
  const c = { x: 12, y: 34, w: 500, h: 800 };
  const f = liveFrame(c, c, 390, 624);
  near(f.k, 1, 'k'); near(f.tx, 0, 'tx'); near(f.ty, 0, 'ty');
});

test('the transform only holds for one aspect ratio: a base from another viewport is wrong, which is why resize commits first', () => {
  // Кадър за 390x650 и същият чертеж след завъртане до 650x390: съотношенията са различни и
  // преобразуването, смятано със стария отправен кадър, не съвпада с истинския кадър.
  const portrait = { x: 0, y: 0, w: 500, h: 500 * 650 / 390 };
  const cam = { x: 120, y: 80, w: 250, h: 250 * 390 / 650 };
  const f = liveFrame(portrait, cam, 650, 390);
  const [sx, sy] = screenOf(portrait, [300, 300], 650, 390);
  const want = screenOf(cam, [300, 300], 650, 390);
  assert.ok(Math.abs(f.tx + f.k * sx - want[0]) > 1 || Math.abs(f.ty + f.k * sy - want[1]) > 1);
});

test('resize() commits a running gesture before it re-fits the camera', () => {
  const resize = /resize\(\) \{\s*if \(!camera\) return;[\s\S]*?endLive\(\);[\s\S]*?const home = getZoom\(\) < 4\.01;/.exec(source);
  assert.ok(resize, 'resize() calls endLive() before it reads the camera and home zoom');
  // Мързеливо започване: следващото движение прави нов отправен кадър върху новия размер.
  assert.match(source, /function beginLive\(\) \{\s*if \(live\) return;\s*live = \{ base: \{ x: camera\.x/);
});
