// Изглед от мястото като готови картинки: търсенето (seatviews.js), описът и файловете
// (assets/seatviews, рисувани от tools/render-seatviews.cjs) и свързването на двата пътя.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const SeatViews = require('../seatviews.js');
const { plan, onSale, tableNumber } = require('../tools/seatview-plan.cjs');

const base = path.join(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(base, name), 'utf8');
const context = { window: {} };
vm.createContext(context);
vm.runInContext(read('venue-data-ceca.js'), context);
const venue = context.window.VENUE;
const manifest = JSON.parse(read('assets/seatviews/manifest.json'));
const byId = new Map(manifest.views.map((v) => [v.id, v]));

function webpSize(file) {
  const d = fs.readFileSync(file);
  assert.equal(d.toString('latin1', 0, 4), 'RIFF');
  assert.equal(d.toString('latin1', 8, 12), 'WEBP');
  const kind = d.toString('latin1', 12, 16);
  if (kind === 'VP8 ') return { w: d.readUInt16LE(26) & 0x3fff, h: d.readUInt16LE(28) & 0x3fff };
  if (kind === 'VP8X') return { w: 1 + d.readUIntLE(24, 3), h: 1 + d.readUIntLE(27, 3) };
  if (kind === 'VP8L') { const b = d.readUInt32LE(21); return { w: 1 + (b & 0x3fff), h: 1 + ((b >> 14) & 0x3fff) }; }
  throw new Error('unknown webp ' + kind);
}

// ---- чистото търсене, върху малка зала ----
const mini = {
  tables: { features: [
    { properties: { mk: 't:Masa_1' }, geometry: { coordinates: [0, 0] } },
    { properties: { mk: 't:Masa_2' }, geometry: { coordinates: [10, 0] } },
    { properties: { mk: 't:Masa_3' }, geometry: { coordinates: [4, 1] } },
  ] },
};
const miniManifest = { views: [
  { id: 'a-r2', kind: 'tribune', sector: 'A.1', row: '2', mk: 's:A.1 r:2 t:1' },
  { id: 'a-r8', kind: 'tribune', sector: 'A.1', row: '8', mk: 's:A.1 r:8 t:1' },
  { id: 't1', kind: 'table', mk: 't:Masa_1' },
  { id: 't2', kind: 'table', mk: 't:Masa_2' },
  { id: 'standing', kind: 'standing', mk: 'z:Standing' },
] };

test('a tribune seat takes the nearest row of its own sector, ties go to the lower row', () => {
  const pick = (mk) => SeatViews.nearest(mini, mk, miniManifest);
  assert.equal(pick('s:A.1 r:3 t:9').id, 'a-r2');
  assert.equal(pick('s:A.1 r:7 t:9').id, 'a-r8');
  assert.equal(pick('s:A.1 r:5 t:9').id, 'a-r2');
  assert.equal(pick('s:A.1 r:20 t:9').id, 'a-r8');
  assert.equal(pick('s:Z.9 r:3 t:9'), null, 'a sector without views resolves to nothing');
});

test('a table takes the nearest view by position and standing takes its single view', () => {
  const pick = (mk) => SeatViews.nearest(mini, mk, miniManifest);
  assert.equal(pick('t:Masa_3').id, 't1');
  assert.equal(pick('t:Masa_2').id, 't2');
  assert.equal(pick('t:Masa_404'), null);
  assert.equal(pick('z:Standing').id, 'standing');
  assert.equal(SeatViews.nearest(mini, '', miniManifest), null);
  assert.equal(SeatViews.nearest(mini, 's:A.1 r:3 t:1', null), null);
});

// ---- описът и файловете ----
test('the manifest is exactly the plan for this venue (re-run tools/render-seatviews.cjs when it drifts)', () => {
  const wanted = plan(venue);
  assert.deepEqual(manifest.views.map(({ file, bytes, ...rest }) => rest), wanted);
  assert.equal(manifest.views.length, wanted.length);
  const kinds = {};
  for (const v of manifest.views) kinds[v.kind] = (kinds[v.kind] || 0) + 1;
  assert.equal(kinds.standing, 1);
  assert.equal(kinds.table, 36, 'twelve table rows, left, centre and right');
  assert.ok(kinds.tribune >= 40);
});

test('every view has a WebP of the stated size, named by a content hash, and the total stays under 9 MB', () => {
  let total = 0;
  for (const v of manifest.views) {
    const file = path.join(base, 'assets', 'seatviews', v.file);
    assert.ok(fs.existsSync(file), v.file);
    const data = fs.readFileSync(file);
    assert.equal(data.length, v.bytes, v.id);
    assert.equal(v.file, v.id + '.' + crypto.createHash('sha256').update(data).digest('hex').slice(0, 8) + '.webp');
    const { w, h } = webpSize(file);
    assert.deepEqual([w, h], [manifest.width, manifest.height], v.id);
    total += data.length;
  }
  assert.ok(total < 9 * 1024 * 1024, 'total ' + total);
  const onDisk = fs.readdirSync(path.join(base, 'assets', 'seatviews')).filter((n) => n.endsWith('.webp'));
  assert.equal(onDisk.length, manifest.views.length, 'no stale files in assets/seatviews');
});

test('every on-sale seat, every table and standing resolve to an existing view', () => {
  let seats = 0;
  for (const f of venue.seats.features) {
    if (!onSale(f.properties)) continue;
    const view = SeatViews.nearest(venue, f.properties.mk, manifest);
    assert.ok(view && byId.get(view.id) === view, f.properties.mk);
    assert.equal(view.kind, 'tribune');
    assert.equal(view.sector, f.properties.s, 'the view comes from the seat\'s own sector');
    assert.ok(Number(f.properties.r) >= view.rows[0] && Number(f.properties.r) <= view.rows[1], f.properties.mk + ' row inside the stated range');
    seats++;
  }
  assert.ok(seats > 5000);
  const covered = new Set();
  for (const f of venue.tables.features) {
    const view = SeatViews.nearest(venue, f.properties.mk, manifest);
    assert.ok(view && view.kind === 'table', f.properties.mk);
    assert.ok(view.tables.includes(tableNumber(f.properties)), f.properties.mk + ' is listed by its view');
    covered.add(tableNumber(f.properties));
  }
  assert.equal(covered.size, 180);
  const standing = SeatViews.nearest(venue, 'z:Standing', manifest);
  assert.equal(standing.kind, 'standing');
});

test('every representative resolves to its own view', () => {
  for (const v of manifest.views) assert.equal(SeatViews.nearest(venue, v.mk, manifest).id, v.id, v.id);
});

test('sectors with more than 12 rows on sale get three views, the others one', () => {
  const rows = new Map();
  for (const f of venue.seats.features) {
    if (!onSale(f.properties)) continue;
    if (!rows.has(f.properties.s)) rows.set(f.properties.s, new Set());
    rows.get(f.properties.s).add(f.properties.r);
  }
  for (const [sector, set] of rows) {
    const n = manifest.views.filter((v) => v.kind === 'tribune' && v.sector === sector).length;
    assert.equal(n, set.size > 12 ? 3 : 1, sector);
  }
  for (const v of manifest.views) if (v.kind === 'tribune') assert.ok(rows.has(v.sector), 'closed sector ' + v.sector + ' has no view');
});

// ---- свързване и качване ----
test('both paths load the lookup, only the SVG path loads the dialog, and the images ship', () => {
  const html = read('index.html');
  assert.match(html, /<script type="application\/json" data-src="seatviews\.js\?v=[0-9a-f]{10}"><\/script>/);
  assert.match(html, /<script type="application\/json" data-svg="true" data-src="seatview-image\.js\?v=[0-9a-f]{10}"><\/script>/);
  const { publicRelative } = require('../tools/static-guard.cjs');
  assert.equal(publicRelative('/assets/seatviews/manifest.json'), 'assets/seatviews/manifest.json');
  assert.equal(publicRelative('/' + 'assets/seatviews/' + manifest.views[0].file), 'assets/seatviews/' + manifest.views[0].file);
  const ignore = read('.vercelignore').split('\n').map((l) => l.trim());
  for (const line of ignore) assert.ok(!/^\/?(assets|seatviews\.js|seatview-image\.js)\/?$/.test(line), '.vercelignore would drop ' + line);
  assert.ok(ignore.includes('tools') && ignore.includes('tests'));
  const headers = JSON.parse(read('vercel.json')).headers;
  const rule = headers.find((h) => /seatviews\/\(\.\*\)\\\.webp/.test(h.source));
  assert.ok(rule && /immutable/.test(rule.headers[0].value));
  assert.ok(new RegExp('^' + rule.source + '$').test('/assets/seatviews/' + manifest.views[0].file));
});

test('the 2D dialog is a labelled modal that closes on Escape, moves focus in and gives it back', () => {
  const src = read('seatview-image.js');
  assert.match(src, /setAttribute\('role', 'dialog'\)/);
  assert.match(src, /setAttribute\('aria-modal', 'true'\)/);
  assert.match(src, /setAttribute\('aria-label', 'Изглед от мястото: ' \+ place\)/);
  assert.match(src, /event\.key === 'Escape'/);
  assert.match(src, /exit\.focus\(/);
  assert.match(src, /previous\.focus\(/);
  assert.match(src, /node\.inert = true/);
  assert.match(src, /'Ориентировъчен изглед'/);
  const css = read('styles.css');
  const block = css.slice(css.indexOf('.svi {'));
  assert.ok(!/\b\d+(?:\.\d+)?(?:vh|svh|lvh|dvh)\b/.test(block), 'no viewport-height units in the dialog styles');
});

test('the 3D poster never takes input, shows nothing under #render and is dropped on errors', () => {
  const css = read('styles.css');
  assert.match(css, /\.arena-view__poster \{[^}]*pointer-events:none/);
  assert.match(css, /\.arena-view__poster\.is-leaving \{ opacity:0; \}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.arena-view__poster \{ transition:none; \} \}/);
  const src = read('arena-seatview.js');
  assert.match(src, /location\.hash !== "#render"/);
  assert.match(src, /const SLOW_SWITCH_MS = 300/);
  assert.match(src, /\} catch \(error\) \{\s*hidePoster\(\);/);
  assert.match(src, /renderer\.render\(scene, camera\);\s*afterFrame\(\);/);
  assert.match(src, /posterToken\+\+;\s*clearTimeout\(posterTimer\);\s*cancelAnimationFrame\(raf\)/);
});
