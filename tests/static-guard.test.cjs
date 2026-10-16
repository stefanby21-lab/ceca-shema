// Пазачът на пътищата на локалния сървър за картинките (tools/static-guard.cjs).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { publicRelative } = require('../tools/static-guard.cjs');

test('the files the site ships are served', () => {
  for (const [url, rel] of [['/', 'index.html'], ['/index.html', 'index.html'], ['/startup.js?v=1', 'startup.js'], ['/venue-data-ceca.js', 'venue-data-ceca.js'],
    ['/assets/preview-map-mobile.webp?v=ab', 'assets/preview-map-mobile.webp'], ['/vendor/maplibre-gl.js', 'vendor/maplibre-gl.js'],
    ['/font/a%20b.woff2', 'font/a b.woff2'], ['/checkout/', 'checkout/index.html'], ['/checkout/checkout.js', 'checkout/checkout.js']])
    assert.equal(publicRelative(url), rel, url);
});

test('private data, dotfiles and anything outside the allowlist are refused, however the path is spelled', () => {
  const refused = [
    '/venue-data-arena.js', '/venue-data-arena.js?x=1', '/x%2f..%2fvenue-data-arena.js', '/assets/..%2fvenue-data-arena.js', '/assets/%2e%2e/venue-data-arena.js',
    '/assets/../venue-data-arena.js', '/%2e%2e/etc/passwd', '/../../etc/passwd', '//etc/passwd', '/assets/..%5cvenue-data-arena.js', '/assets/%00.webp',
    '/.env', '/.env.local', '/.git/config', '/.vercel/project.json', '/assets/.hidden', '/vendor/.env', '/%2eenv', '/assets/%2e%2e/.env',
    '/README.md', '/task_plan.md', '/vercel.json', '/tests/startup.test.cjs', '/tools/render-previews.cjs', '/tools/stamp.sh', '/node_modules/x', '/package.json',
    '/venue-data-other.js', '/%', '/assets/%E0%A4%A', '',
  ];
  for (const url of refused) assert.equal(publicRelative(url), null, url);
  assert.equal(publicRelative(undefined), null);
});

test('every file the page loads is allowed, and nothing in the allowlist is the private file', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const loaded = [...html.matchAll(/(?:data-src|src|href|data-fallback)="([a-z0-9-]+\.(?:js|css))(?:\?[^"]*)?"/g)].map((m) => m[1]);
  assert.ok(loaded.length > 10);
  for (const file of loaded) assert.equal(publicRelative('/' + file), file, file);
  assert.equal(publicRelative('/venue-data-arena.js'), null);
});
