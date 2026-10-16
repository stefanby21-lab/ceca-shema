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
     PLAYWRIGHT_CORE    път до пакета playwright-core (иначе се търси в node_modules и в ~/.npm/_npx)
     HEADLESS_SHELL     път до chrome-headless-shell (иначе се търси в кеша на Playwright)
     PREVIEW_MAX_KB     таван на файла, по подразбиране 80
   Браузърът е обикновен, без постоянен профил: Playwright си прави временен и го трие при затваряне.
   След пускане: bash tools/stamp.sh (отпечатъците на картинките са в index.html). */
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const { publicRelative } = require('./static-guard.cjs');

const ROOT = path.resolve(__dirname, '..');
const HOME = os.homedir();
const MAX_BYTES = (Number(process.env.PREVIEW_MAX_KB) || 80) * 1024;
const START_QUALITY = 75;
const MIN_QUALITY = 40;

// Първият съществуващ път от списък шаблони с една звездичка в папка (най-новата версия първа).
function newestMatch(parent, pattern, tail) {
  let names = [];
  try { names = fs.readdirSync(parent); } catch (_) { return null; }
  const hits = names.filter((name) => pattern.test(name)).sort().reverse();
  for (const name of hits) {
    const candidate = path.join(parent, name, ...tail);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}
function findPlaywrightCore() {
  if (process.env.PLAYWRIGHT_CORE) return process.env.PLAYWRIGHT_CORE;
  try { return require.resolve('playwright-core', { paths: [ROOT, process.cwd()] }); } catch (_) { /* няма в проекта */ }
  return newestMatch(path.join(HOME, '.npm', '_npx'), /^[0-9a-f]+$/, ['node_modules', 'playwright-core']);
}
function findHeadlessShell() {
  if (process.env.HEADLESS_SHELL) return process.env.HEADLESS_SHELL;
  for (const cache of [path.join(HOME, 'Library', 'Caches', 'ms-playwright'), path.join(HOME, '.cache', 'ms-playwright')]) {
    for (const dir of ['chrome-headless-shell-mac-arm64', 'chrome-headless-shell-mac-x64', 'chrome-headless-shell-linux64']) {
      const hit = newestMatch(cache, /^chromium_headless_shell-\d+$/, [dir, 'chrome-headless-shell']);
      if (hit) return hit;
    }
  }
  return null;
}

const TARGETS = {
  'map-desktop': { out: 'preview-map-desktop.webp', width: 1440, height: 900, scale: 1, mobile: false, query: '?restore=1' },
  'map-mobile': { out: 'preview-map-mobile.webp', width: 390, height: 844, scale: 2, mobile: true, query: '?restore=1' },
  'plan-desktop': { out: 'preview-plan-desktop.webp', width: 1440, height: 900, scale: 1, mobile: false, query: '?restore=1&view=2d' },
  'plan-mobile': { out: 'preview-plan-mobile.webp', width: 390, height: 844, scale: 2, mobile: true, query: '?restore=1&view=2d' },
};

// Само файловете, които сайтът наистина качва (tools/static-guard.cjs); частните данни на друга
// зала, точковите файлове и всичко извън корена никога не се сервират.
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.json': 'application/json', '.pbf': 'application/x-protobuf' };

function serve() {
  let realRoot;
  try { realRoot = fs.realpathSync(ROOT); } catch (_) { realRoot = ROOT; }
  const server = http.createServer((req, res) => {
    const rel = publicRelative(req.url || '/');
    let file = null;
    if (rel) {
      try {
        // Символна връзка не може да изведе навън: окончателният път трябва да е под корена.
        const real = fs.realpathSync(path.join(ROOT, rel));
        if (real.startsWith(realRoot + path.sep) && fs.statSync(real).isFile()) file = real;
      } catch (_) { file = null; }
    }
    if (!file) { res.writeHead(404); res.end('not found'); return; }
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
  const core = findPlaywrightCore();
  if (!core) throw new Error('playwright-core not found: set PLAYWRIGHT_CORE or install it');
  const shell = findHeadlessShell();
  if (!shell || !fs.existsSync(shell)) throw new Error('chrome-headless-shell not found: run "npx playwright install chromium-headless-shell" or set HEADLESS_SHELL');
  const { chromium } = require(core);
  const server = await serve();
  const base = 'http://127.0.0.1:' + server.address().port;
  let browser = null;
  let closing = null;
  // Един затварящ път за край, грешка и сигнал: браузърът се затваря и се изчаква да излезе
  // (Playwright трие временния си профил), после спира и сървърът.
  const cleanup = () => {
    if (closing) return closing;
    closing = (async () => {
      const child = browser && browser.process ? browser.process() : null;
      try {
        if (browser) await Promise.race([browser.close(), new Promise((_, reject) => setTimeout(() => reject(new Error('close timeout')), 8000))]);
      } catch (_) {
        if (child && child.exitCode === null) { try { child.kill('SIGKILL'); } catch (__) { /* вече го няма */ } }
      }
      await new Promise((resolve) => server.close(resolve));
      if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
    })();
    return closing;
  };
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { cleanup().finally(() => process.exit(130)); });
  const results = [];
  try {
    browser = await chromium.launch({ executablePath: shell, headless: true, args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
    for (const name of names) {
      const spec = TARGETS[name];
      const context = await browser.newContext({
        viewport: { width: spec.width, height: spec.height },
        deviceScaleFactor: spec.scale,
        isMobile: spec.mobile,
        hasTouch: spec.mobile,
      });
      try { results.push(await renderOne(context, base, name, spec)); } finally { await context.close().catch(() => {}); }
    }
  } finally {
    await cleanup();
  }
  console.log(JSON.stringify(results));
}

main().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });
