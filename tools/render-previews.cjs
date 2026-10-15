#!/usr/bin/env node
'use strict';
/* Рисува моменталните картинки на залата (assets/preview-*.webp), които се показват,
   докато се зарежда интерактивната схема. Снима самата карта (#map) без шапка,
   панел, бутони и порта, на същата рамка, в която я рисува приложението.

   Не е част от сайта и не добавя зависимост: ползва playwright-core и chromium-headless-shell,
   които вече са на машината (никога инсталиран Chrome/Brave/Edge).

     node tools/render-previews.cjs            # и четирите
     node tools/render-previews.cjs map-mobile # само една

   Среда (по избор):
     PLAYWRIGHT_CORE    път до пакета playwright-core
     HEADLESS_SHELL     път до chrome-headless-shell
     PREVIEW_PROFILE    папка на профила (една и съща при всеки пуск)
     PREVIEW_MAX_KB     таван на файла, по подразбиране 80
   След пускане: bash tools/stamp.sh (отпечатъците на картинките са в index.html). */
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const HOME = os.homedir();
const PLAYWRIGHT_CORE = process.env.PLAYWRIGHT_CORE
  || (fs.existsSync(path.join(HOME, '.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core'))
    ? path.join(HOME, '.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core') : 'playwright-core');
const HEADLESS_SHELL = process.env.HEADLESS_SHELL
  || path.join(HOME, 'Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell');
const PROFILE = process.env.PREVIEW_PROFILE || path.join(os.tmpdir(), 'ceca-render-previews-profile');
const MAX_BYTES = (Number(process.env.PREVIEW_MAX_KB) || 80) * 1024;
const START_QUALITY = 75;
const MIN_QUALITY = 40;

const TARGETS = {
  'map-desktop': { out: 'preview-map-desktop.webp', width: 1440, height: 900, scale: 1, mobile: false, query: '?restore=1' },
  'map-mobile': { out: 'preview-map-mobile.webp', width: 390, height: 844, scale: 2, mobile: true, query: '?restore=1' },
  'plan-desktop': { out: 'preview-plan-desktop.webp', width: 1440, height: 900, scale: 1, mobile: false, query: '?restore=1&view=2d' },
  'plan-mobile': { out: 'preview-plan-mobile.webp', width: 390, height: 844, scale: 2, mobile: true, query: '?restore=1&view=2d' },
};

// Само нашите файлове; частните локални данни на друга зала никога не се сервират.
const BLOCKED = /^\/venue-data-(?!ceca\b)/;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.json': 'application/json', '.pbf': 'application/x-protobuf' };

function serve() {
  const server = http.createServer((req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch (_) { pathname = '/'; }
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = path.join(ROOT, pathname);
    if (BLOCKED.test(pathname) || !file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function hasCwebp() {
  const probe = cp.spawnSync('cwebp', ['-version'], { timeout: 10000 });
  return probe.status === 0;
}

// cwebp, ако го има; иначе кодерът на платното в браузъра. Качеството пада стъпка по
// стъпка, докато файлът влезе в тавана - числото, с което е записан, се връща.
async function encode(png, page, outFile) {
  if (hasCwebp()) {
    const tmpPng = path.join(os.tmpdir(), 'ceca-preview-' + process.pid + '.png');
    fs.writeFileSync(tmpPng, png);
    try {
      for (let q = START_QUALITY; q >= MIN_QUALITY; q -= 5) {
        const run = cp.spawnSync('cwebp', ['-quiet', '-q', String(q), '-m', '6', '-pass', '10', tmpPng, '-o', outFile], { timeout: 60000 });
        if (run.status !== 0) throw new Error('cwebp: ' + String(run.stderr));
        if (fs.statSync(outFile).size <= MAX_BYTES) return { q, encoder: 'cwebp' };
      }
    } finally { fs.rmSync(tmpPng, { force: true }); }
    return { q: MIN_QUALITY, encoder: 'cwebp' };
  }
  const base64 = png.toString('base64');
  for (let q = START_QUALITY; q >= MIN_QUALITY; q -= 5) {
    const data = await page.evaluate(async ([b64, quality]) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      return canvas.toDataURL('image/webp', quality / 100).split(',')[1];
    }, [base64, q]);
    fs.writeFileSync(outFile, Buffer.from(data, 'base64'));
    if (fs.statSync(outFile).size <= MAX_BYTES) return { q, encoder: 'canvas' };
  }
  return { q: MIN_QUALITY, encoder: 'canvas' };
}

// Шапката остава в потока (само невидима), за да не се мести картата; всичко друго
// извън #map и неговите контроли се маха.
const HIDE_UI = [
  '.topbar{visibility:hidden!important}',
  '.workspace>:not(#map),body>:not(#app){display:none!important}',
  '.maplibregl-control-container,.svg-map-toolbar,.svg-map-tip,.map-boot{display:none!important}',
].join('\n');

async function renderOne(context, base, name, spec) {
  const page = await context.newPage();
  try {
    await page.setViewportSize({ width: spec.width, height: spec.height });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message || e)));
    await page.goto(base + '/' + spec.query, { waitUntil: 'load' });
    await page.waitForFunction(() => {
      const status = document.getElementById('startup-status');
      const failure = document.getElementById('startup-failure');
      return (failure && !failure.hidden) || (status && status.hidden);
    }, null, { timeout: 60000 });
    if (await page.evaluate(() => !document.getElementById('startup-failure').hidden)) {
      throw new Error(name + ': the page reported a startup failure ' + errors.join('; '));
    }
    await page.addStyleTag({ content: HIDE_UI });
    await page.waitForTimeout(1500);
    const png = await page.locator('#map').screenshot({ type: 'png', animations: 'disabled' });
    const outFile = path.join(ROOT, 'assets', spec.out);
    const info = await encode(png, page, outFile);
    const size = await page.locator('#map').boundingBox();
    const bytes = fs.statSync(outFile).size;
    console.log(`${spec.out}: ${bytes} B (${(bytes / 1024).toFixed(1)} KB), q${info.q} via ${info.encoder}, `
      + `pane ${Math.round(size.width)}x${Math.round(size.height)} css px @${spec.scale}x`);
    if (bytes > MAX_BYTES) console.warn('  WARNING: over the ' + (MAX_BYTES / 1024) + ' KB ceiling');
    return { name, width: Math.round(size.width * spec.scale), height: Math.round(size.height * spec.scale), bytes };
  } finally {
    await page.close().catch(() => {});
  }
}

async function main() {
  const wanted = process.argv.slice(2);
  const names = wanted.length ? wanted : Object.keys(TARGETS);
  for (const name of names) if (!TARGETS[name]) throw new Error('unknown target ' + name + ' (' + Object.keys(TARGETS).join(', ') + ')');
  if (!fs.existsSync(HEADLESS_SHELL)) throw new Error('chrome-headless-shell not found: ' + HEADLESS_SHELL);
  const { chromium } = require(PLAYWRIGHT_CORE);
  const server = await serve();
  const base = 'http://127.0.0.1:' + server.address().port;
  let context = null;
  let closing = false;
  const cleanup = async () => {
    if (closing) return; closing = true;
    try { if (context) await context.close(); } catch (_) { /* already gone */ }
    server.close();
  };
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { cleanup().finally(() => process.exit(130)); });
  const results = [];
  try {
    for (const name of names) {
      const spec = TARGETS[name];
      // Профилът е един и същ при всеки пуск; всяка цел е със свои размер и плътност.
      context = await chromium.launchPersistentContext(PROFILE, {
        executablePath: HEADLESS_SHELL,
        headless: true,
        viewport: { width: spec.width, height: spec.height },
        deviceScaleFactor: spec.scale,
        isMobile: spec.mobile,
        hasTouch: spec.mobile,
        args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
      });
      results.push(await renderOne(context, base, name, spec));
      await context.close();
      context = null;
    }
  } finally {
    await cleanup();
  }
  console.log(JSON.stringify(results));
}

main().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });
