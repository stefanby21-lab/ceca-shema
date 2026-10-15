// Барове, FOH и завеси заедно: от всяко продаваемо място лъчите към сцената и екрана
// минават през същите кутии, които рисува изгледът (ArenaGeometry.floorProps).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { stageSurfaceTargets } = require('./sightline-targets.cjs');
const context = { window: {}, structuredClone };
vm.createContext(context);
for (const file of ['venue-data-ceca.js', 'arena-geometry.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
const G = context.window.ArenaGeometry, RAW = context.window.VENUE, S = G.SCALE;
const venue = G.forView(RAW);
const curtains = G.curtainPanels(venue, { scale: S });
const props = G.floorProps(RAW, { scale: S });
const free = (p) => !p.sold && !p.offsale && p.eur > 0;
const seats = venue.seats.features.map((f) => ({ s: f.properties.s, r: String(f.properties.r), t: String(f.properties.t), free: free(f.properties), x: f.geometry.coordinates[0] * S, z: -f.geometry.coordinates[1] * S, el: (f.properties.el || 0) * S }));

function hits(p, q, tri) {
  const [a, b, c] = tri, d = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
  const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const h = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]];
  const det = e1[0] * h[0] + e1[1] * h[1] + e1[2] * h[2];
  if (Math.abs(det) < 1e-12) return false;
  const f = 1 / det, s = [p[0] - a[0], p[1] - a[1], p[2] - a[2]], u = f * (s[0] * h[0] + s[1] * h[1] + s[2] * h[2]);
  if (u < 0 || u > 1) return false;
  const qv = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]];
  const v = f * (d[0] * qv[0] + d[1] * qv[1] + d[2] * qv[2]);
  if (v < 0 || u + v > 1) return false;
  const t = f * (e2[0] * qv[0] + e2[1] * qv[1] + e2[2] * qv[2]);
  return t > 1e-4 && t < 1 - 1e-4;
}
function boxTris(b) {
  const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, y0 = b.y - b.h / 2, y1 = b.y + b.h / 2, z0 = b.z - b.d / 2, z1 = b.z + b.d / 2;
  const v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
  return [[0, 1, 2], [0, 2, 3], [4, 6, 5], [4, 7, 6], [0, 4, 5], [0, 5, 1], [3, 2, 6], [3, 6, 7], [0, 3, 7], [0, 7, 4], [1, 5, 6], [1, 6, 2]].map((i) => i.map((k) => v[k]));
}
const groups = [{ tris: curtains.triangles.slice(0, 2) }].concat(curtains.hoods.map((h) => ({ tris: h.tris })));
// Всяка кутия на плота е своя група: бърз отсев по самата кутия.
for (const b of props.boxes) groups.push({ tris: boxTris(b) });
for (const g of groups) { const pts = g.tris.flat(); g.min = [0, 1, 2].map((i) => Math.min(...pts.map((v) => v[i]))); g.max = [0, 1, 2].map((i) => Math.max(...pts.map((v) => v[i]))); }
function blocked(p, q) {
  for (const g of groups) {
    let t0 = 0, t1 = 1, ok = true;
    for (let i = 0; i < 3 && ok; i++) {
      const dv = q[i] - p[i];
      if (Math.abs(dv) < 1e-9) { if (p[i] < g.min[i] || p[i] > g.max[i]) ok = false; }
      else { let a = (g.min[i] - p[i]) / dv, b = (g.max[i] - p[i]) / dv; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) ok = false; }
    }
    if (!ok) continue;
    for (const tri of g.tris) if (hits(p, q, tri)) return true;
  }
  return false;
}
const st = venue.stage.geometry.coordinates[0], sx0 = Math.min(...st.map((p) => p[0])) * S, sx1 = Math.max(...st.map((p) => p[0])) * S;
// Мишените са мрежа по ПОВЪРХНОСТТА на сцената (на височината, която рисува изгледът), не само предният ръб.
const stageTargets = stageSurfaceTargets(G, venue, 1.5);
const screenTargets = [];
for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) screenTargets.push([sx0 + (sx1 - sx0) * (i + .5) / 6, 1.35 + 10.8 * (j + .5) / 4, curtains.stageBack + .27]);
const share = (eye, targets) => targets.filter((t) => !blocked(eye, t)).length / targets.length;
const eyeOf = (q) => [q.x, q.el + 1.15, q.z];
const onSale = seats.filter((q) => q.free);
// Всички B.1.x и B.2.x (до баровете и FOH) + всичко близо до сцената + разреден ред от останалите.
const sample = onSale.filter((q, i) => /^B\.[12]\./.test(q.s) || q.z < curtains.stageFront + 12 || i % 9 === 0);
const results = sample.map((q) => ({ q, screen: share(eyeOf(q), screenTargets), stage: share(eyeOf(q), stageTargets) }));

test('floorProps: two bars and an FOH from the data, no canopy, FOH sign at most 1.3 m up', () => {
  assert.equal(props.barSigns.length, 2);
  assert.ok(props.fohSigns.length === 2 && props.fohSigns.every((q) => q.y + q.h / 2 <= 1.3));
  const maxFoh = Math.max(...props.boxes.filter((b) => b.k !== 'lightbox' && b.k !== 'chrome' && b.x > -5 && b.x < 5).map((b) => b.y + b.h / 2));
  assert.ok(maxFoh <= 1.9, 'FOH has nothing hanging above the desk: ' + maxFoh);
  assert.ok(props.boxes.every((b) => b.w > 0 && b.h > 0 && b.d > 0));
});

test('every sampled on-sale seat, B.1.1-B.1.4 and B.2.x included, keeps 70% of the screen and 50% of the stage surface', () => {
  const worst = results.slice().sort((a, b) => (a.screen + a.stage) - (b.screen + b.stage)).slice(0, 5);
  console.log('seats tested:', results.length, '\nworst 5:\n' + worst.map((r) => `  ${r.q.s} r${r.q.r} t${r.q.t}  screen ${(r.screen * 100).toFixed(0)}%  stage ${(r.stage * 100).toFixed(0)}%`).join('\n'));
  const bad = results.filter((r) => r.screen < .7 || r.stage < .5);
  assert.equal(bad.length, 0, bad.slice(0, 6).map((r) => `${r.q.s} r${r.q.r} t${r.q.t} screen ${(r.screen * 100).toFixed(0)}% stage ${(r.stage * 100).toFixed(0)}%`).join('; '));
});

test('regression: B.1.3 row 5 seat 1 and every seat of B.1.1-B.1.4 see the stage and the screen', () => {
  const q = seats.find((x) => x.s === 'B.1.3' && x.r === '5' && x.t === '1');
  assert.ok(q && q.free, 'B.1.3 r5 s1 is on sale');
  assert.ok(share(eyeOf(q), stageTargets) >= .9, 'stage ' + share(eyeOf(q), stageTargets));
  assert.ok(share(eyeOf(q), screenTargets) >= .9, 'screen ' + share(eyeOf(q), screenTargets));
  for (const sector of ['B.1.1', 'B.1.2', 'B.1.3', 'B.1.4']) {
    const list = onSale.filter((x) => x.s === sector);
    assert.ok(list.length > 0, sector);
    for (const x of list) { assert.ok(share(eyeOf(x), stageTargets) >= .5 && share(eyeOf(x), screenTargets) >= .7, sector + ' r' + x.r + ' t' + x.t); }
  }
});

test('negative control: a hanging fascia like the old FOH canopy (3 m up, 8.4 m wide) would block B.1.3 r5 s1', () => {
  const fo = props.boxes.find((b) => b.k === 'riser' && b.w > 4);
  const canopy = boxTris({ x: fo.x, y: 2.8, z: fo.z, w: fo.w + .6, h: .7, d: 2.9 });
  const q = seats.find((x) => x.s === 'B.1.3' && x.r === '5' && x.t === '1');
  const open = (t) => !blocked(eyeOf(q), t) && !canopy.some((tri) => hits(eyeOf(q), t, tri));
  assert.ok(stageTargets.filter(open).length / stageTargets.length < .5, 'the control canopy should block the stage rays');
});

test('negative control: a panel standing on the stage hides its rear half from the floor, which a front-edge-only sample would miss', () => {
  const q = seats.find((x) => x.s === 'B.1.3' && x.r === '5' && x.t === '1');
  // Панел на сцената, 3 м зад предния ѝ ръб, по цялата ѝ ширина, по-висок от очите на гледащия.
  const panel = boxTris({ x: (sx0 + sx1) / 2, y: 2.5, z: curtains.stageFront - 3, w: sx1 - sx0, h: 5, d: .4 });
  const eye = eyeOf(q);
  const seen = (targets) => targets.filter((t) => !blocked(eye, t) && !panel.some((tri) => hits(eye, t, tri))).length / targets.length;
  const frontEdge = Array.from({ length: 30 }, (_, i) => [sx0 + (sx1 - sx0) * (i + .5) / 30, G.STAGE_HEIGHT_M + .05, curtains.stageFront - .05]);
  assert.ok(seen(frontEdge) >= .9, 'a front-edge sample would still pass: ' + seen(frontEdge));
  assert.ok(seen(stageTargets) < .5, 'the surface grid must catch it: ' + seen(stageTargets));
  assert.ok(share(eye, stageTargets) >= .9, 'without the panel the seat sees the stage surface');
});

test('the stage surface the tests aim at is the height the view draws', () => {
  assert.equal(G.STAGE_HEIGHT_M, G.STAGE_RISE * S);
  assert.ok(stageTargets.length >= 100 && stageTargets.every((t) => Math.abs(t[1] - (G.STAGE_HEIGHT_M + .05)) < 1e-9));
  const src = fs.readFileSync(path.join(__dirname, '..', 'arena-seatview.js'), 'utf8');
  assert.match(src, /extrude\(v\.stage\.geometry\.coordinates\[0\], G\.STAGE_RISE, 0, stageMat\)/);
});

test('the picker\'s original option carries the opened viewpoint id, so it resolves to the table, seat or zone', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'arena-seatview.js'), 'utf8');
  assert.match(src, /originalOption\.value = own\.properties\.mk/);
  assert.doesNotMatch(src, /originalOption\.value = ''/);
});
