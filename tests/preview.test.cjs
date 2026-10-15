// Моменталните картинки на залата: файловете, размерите им в index.html и атрибутите,
// от които зависи, че не мърдат нищо и не хващат докосвания.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(base, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(base, 'styles.css'), 'utf8');
const NAMES = ['map-desktop', 'map-mobile', 'plan-desktop', 'plan-mobile'];

function webpSize(file) {
  const d = fs.readFileSync(file);
  assert.equal(d.toString('latin1', 0, 4), 'RIFF'); assert.equal(d.toString('latin1', 8, 12), 'WEBP');
  const kind = d.toString('latin1', 12, 16);
  if (kind === 'VP8 ') return { w: d.readUInt16LE(26) & 0x3fff, h: d.readUInt16LE(28) & 0x3fff };
  if (kind === 'VP8X') return { w: 1 + d.readUIntLE(24, 3), h: 1 + d.readUIntLE(27, 3) };
  if (kind === 'VP8L') { const b = d.readUInt32LE(21); return { w: 1 + (b & 0x3fff), h: 1 + ((b >> 14) & 0x3fff) }; }
  throw new Error('unknown webp ' + kind);
}

test('the four preview files exist, are WebP and stay under 80 KB', () => {
  for (const name of NAMES) {
    const file = path.join(base, 'assets', `preview-${name}.webp`);
    assert.ok(fs.existsSync(file), name);
    assert.ok(fs.statSync(file).size <= 80 * 1024, `${name}: ${fs.statSync(file).size} B`);
    webpSize(file);
  }
});

test('index.html carries the real pixel size of every preview and a current content stamp', () => {
  const crypto = require('node:crypto');
  const sizes = {
    'map-desktop': /<img[^>]*src="assets\/preview-map-desktop\.webp\?v=([0-9a-f]+)"[^>]*width="(\d+)"[^>]*height="(\d+)"/,
    'map-mobile': /<source[^>]*srcset="assets\/preview-map-mobile\.webp\?v=([0-9a-f]+)"[^>]*width="(\d+)"[^>]*height="(\d+)"/,
    'plan-desktop': /data-plan-desktop="assets\/preview-plan-desktop\.webp\?v=([0-9a-f]+)"\s+data-plan-desktop-size="(\d+)x(\d+)"/,
    'plan-mobile': /data-plan-mobile="assets\/preview-plan-mobile\.webp\?v=([0-9a-f]+)"\s+data-plan-mobile-size="(\d+)x(\d+)"/,
  };
  for (const name of NAMES) {
    const m = sizes[name].exec(html);
    assert.ok(m, name + ' is wired into index.html');
    const file = path.join(base, 'assets', `preview-${name}.webp`);
    const actual = webpSize(file);
    assert.deepEqual([Number(m[2]), Number(m[3])], [actual.w, actual.h], name + ' size');
    const stamp = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 10);
    assert.equal(m[1], stamp, name + ' stamp (run bash tools/stamp.sh)');
  }
});

test('the preview is aria-hidden, decorative, high priority, async-decoded and not lazy', () => {
  const block = /<div\s+id="map-boot"[\s\S]*?<\/picture>\s*<\/div>/.exec(html);
  assert.ok(block, 'map-boot block');
  assert.match(block[0], /class="map-boot"/); assert.match(block[0], /aria-hidden="true"/);
  assert.match(block[0], /<img[\s\S]*alt=""/); assert.match(block[0], /fetchpriority="high"/);
  assert.match(block[0], /decoding="async"/); assert.doesNotMatch(block[0], /loading="lazy"/);
  assert.match(block[0], /media="\(max-width: 880px\)"/);
  // Стои в картата, преди която и да е скрипт (скриптовете са след body съдържанието).
  assert.ok(html.indexOf('id="map-boot"') > html.indexOf('id="map"') && html.indexOf('id="map-boot"') < html.indexOf('<script'));
});

test('the preview never intercepts taps, covers the pane without moving it and respects reduced motion', () => {
  const rule = /\.map-boot \{([^}]*)\}/.exec(css);
  assert.ok(rule, '.map-boot rule');
  assert.match(rule[1], /position:\s*absolute/); assert.match(rule[1], /inset:\s*0/);
  assert.match(rule[1], /pointer-events:\s*none/); assert.match(rule[1], /transition:\s*opacity\s*\.2s/);
  assert.match(css, /\.map-boot img \{[^}]*pointer-events:\s*none/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.map-boot \{ transition:\s*none; \} \}/);
});
