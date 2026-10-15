// Завесите не бива да крият сцената и екрана от продаваемите места и трябва да
// крият затворените блокове до сцената. Чиста геометрия: сегмент срещу триъгълник.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const context = { window: {}, structuredClone };
vm.createContext(context);
for (const file of ['venue-data-ceca.js', 'arena-geometry.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
const G = context.window.ArenaGeometry;
const venue = G.forView(context.window.VENUE);
const S = G.SCALE;
const panels = G.curtainPanels(venue, { scale: S });
const free = (p) => !p.sold && !p.offsale && p.eur > 0;
const seats = venue.seats.features.map((f) => ({ mk: f.properties.mk, s: f.properties.s, r: f.properties.r, t: f.properties.t, free: free(f.properties),
  x: f.geometry.coordinates[0] * S, z: -f.geometry.coordinates[1] * S, el: (f.properties.el || 0) * S }));

// Möller-Trumbore за отсечка p -> q.
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
// Групи триъгълници с кутия за бърз отсев.
const groups = [{ tris: panels.triangles.slice(0, 2) }].concat(panels.hoods.map((h) => ({ tris: h.tris })));
for (const g of groups) { const pts = g.tris.flat(); g.min = [0, 1, 2].map((i) => Math.min(...pts.map((v) => v[i]))); g.max = [0, 1, 2].map((i) => Math.max(...pts.map((v) => v[i]))); }
function blocked(p, q) {
  for (const g of groups) {
    // Отсечката пресича ли кутията (slab метод)?
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
// Мишени: предният ръб на сцената (~30 точки) и главният екран (6 x 4 точки).
const st = venue.stage.geometry.coordinates[0], sx0 = Math.min(...st.map((p) => p[0])) * S, sx1 = Math.max(...st.map((p) => p[0])) * S;
const stageTargets = Array.from({ length: 30 }, (_, i) => [sx0 + (sx1 - sx0) * (i + .5) / 30, 0.4, panels.stageFront]);
const screenZ = panels.stageBack + .27, screenTargets = [];
for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) screenTargets.push([sx0 + (sx1 - sx0) * (i + .5) / 6, 1.35 + 10.8 * (j + .5) / 4, screenZ]);
const share = (eye, targets) => targets.filter((t) => !blocked(eye, t)).length / targets.length;
const eyeOf = (q) => [q.x, q.el + 1.15, q.z];

const onSale = seats.filter((q) => q.free);
// Всички места на продаваемите блокове до сцената + разреден ред от останалите.
const nearStage = (q) => q.z < panels.stageFront + 12;
const sample = onSale.filter((q, i) => nearStage(q) || i % 7 === 0);
const results = sample.map((q) => ({ q, screen: share(eyeOf(q), screenTargets), stage: share(eyeOf(q), stageTargets) }));

test('negative control: a full-height wall in front of the closed blocks would block open seats', () => {
  // Така изглеждаха завесите преди (права стена по лицето на затворените блокове):
  // тестът трябва да го хване, иначе проверката е безполезна.
  const H = 25, zA = -44.5, zB = panels.stageFront + 1.5, wall = [];
  for (const sign of [-1, 1]) wall.push([[sign * 25, 0, zA], [sign * 25, 0, zB], [sign * 25, H, zB]], [[sign * 25, 0, zA], [sign * 25, H, zB], [sign * 25, H, zA]]);
  const seesBlocked = (eye, targets) => targets.filter((t) => !wall.some((tri) => hits(eye, t, tri)) && !blocked(eye, t)).length / targets.length;
  const probe = onSale.filter((q) => nearStage(q) && Math.abs(q.x) > 26).slice(0, 400);
  const bad = probe.filter((q) => seesBlocked(eyeOf(q), screenTargets) < .7 || seesBlocked(eyeOf(q), stageTargets) < .5);
  assert.ok(bad.length > 20, 'the control wall should fail for many seats, failed for ' + bad.length);
});

test('every sampled on-sale seat sees at least 70% of the screen and 50% of the stage front', () => {
  const worst = results.slice().sort((a, b) => (a.screen + a.stage) - (b.screen + b.stage)).slice(0, 5);
  console.log('seats tested:', results.length, '\nworst 5:\n' + worst.map((r) => `  ${r.q.s} r${r.q.r} t${r.q.t}  screen ${(r.screen * 100).toFixed(0)}%  stage ${(r.stage * 100).toFixed(0)}%`).join('\n'));
  console.log('min screen', Math.min(...results.map((r) => r.screen)), 'min stage', Math.min(...results.map((r) => r.stage)));
  const bad = results.filter((r) => r.screen < .7 || r.stage < .5);
  assert.equal(bad.length, 0, bad.slice(0, 5).map((r) => `${r.q.s} r${r.q.r} t${r.q.t} screen ${(r.screen * 100).toFixed(0)}% stage ${(r.stage * 100).toFixed(0)}%`).join('; '));
});

test('regression: C.2.5 row 27 seat 21 and its A.2.5 mirror see the screen and the stage', () => {
  for (const sector of ['C.2.5', 'A.2.5']) {
    const q = seats.find((x) => x.s === sector && String(x.r) === '27' && String(x.t) === '21') || seats.filter((x) => x.s === sector && x.free).sort((a, b) => b.z - a.z)[0];
    assert.ok(q && q.free, sector);
    assert.ok(share(eyeOf(q), screenTargets) >= .7, sector + ' screen');
    assert.ok(share(eyeOf(q), stageTargets) >= .5, sector + ' stage');
  }
});

test('closed near-stage seats are not visible from on-sale seats (rays hit a drape)', () => {
  const closed = seats.filter((q) => !q.free && q.z < panels.stageFront + 3 && q.z > panels.rear.z + .5 && Math.abs(q.x) > 24);
  assert.ok(closed.length > 100, 'closed near-stage seats: ' + closed.length);
  const viewers = onSale.filter((q, i) => i % 40 === 0 && q.z < panels.stageFront + 20);
  let visible = 0, total = 0; const sample2 = [];
  for (const v of viewers) for (let k = 0; k < closed.length; k += 9) {
    const c = closed[k]; total++;
    if (!blocked(eyeOf(v), [c.x, c.el + .55, c.z])) { visible++; if (sample2.length < 5) sample2.push(`${v.s}->${c.s}`); }
  }
  console.log(`closed-seat rays: ${total}, visible ${visible} (${(100 * visible / total).toFixed(2)}%)`, sample2.join(' '));
  assert.ok(visible / total < .02, 'visible share ' + (visible / total) + ' ' + sample2.join(' '));
});

test('the rear drape spans the whole arena and reaches the roof line', () => {
  assert.ok(panels.rear.x1 - panels.rear.x0 > 2 * Math.max(...seats.map((q) => Math.abs(q.x))));
  assert.ok(panels.rear.height >= 20);
  assert.ok(panels.rear.z < panels.stageBack);
});
