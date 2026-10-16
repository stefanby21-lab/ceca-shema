#!/usr/bin/env node
'use strict';
/* Рисува готовите картинки на изгледа от мястото (assets/seatviews/*.webp + manifest.json) от
   ИСТИНСКАТА 3D сцена (arena-seatview.js) в chromium-headless-shell през софтуерен WebGL
   (SwiftShader). Те дават изглед от мястото на хората без WebGL и показват веднага правилната
   картинка, докато три.js строи сцената.

   Кои гледни точки: tools/seatview-plan.cjs (за всеки сектор в продажба средния ред и място,
   при над 12 реда още предна и задна третина; маси - лява, средна и дясна на всеки ред; правостоящи).
   Снима се само платното (1200x675), без шапка и подвал, с погледа към сцената по подразбиране.

     node tools/render-seatviews.cjs                        # всички, записва в assets/seatviews
     node tools/render-seatviews.cjs --quality 64           # по-малки файлове (по подразбиране 68)
     node tools/render-seatviews.cjs --budget-mb 7          # таван на сбора (по подразбиране 9)
     node tools/render-seatviews.cjs --only s-B.2.2-r20,standing --out /път/до/папка   # проба, без запис в assets

   Ако сборът надхвърли тавана, качеството пада стъпка по стъпка, а после и размерът (кадрите не се
   рисуват наново). Файловете носят отпечатък на съдържанието в името (<id>.<хеш>.webp) и се кешират
   завинаги; папката се подрежда така, че да останат само файловете от описа. Повторно пускане с
   непроменена сцена дава същите байтове. След пускане: bash tools/stamp.sh и node --test.
   Браузърът, сървърът и чистенето при край/грешка/сигнал са в tools/headless.cjs. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { ROOT, serve, closeServer, hasCwebp, launchSession } = require('./headless.cjs');
const { plan } = require('./seatview-plan.cjs');

const WIDTH = 1200;
const HEIGHT = 675;
const START_QUALITY = 68;
const MIN_QUALITY = 40;
const SIZES = [[1200, 675], [1080, 608], [960, 540]];
const OUT_DIR = path.join(ROOT, 'assets', 'seatviews');

function parseArgs(argv) {
  const opts = { quality: START_QUALITY, budgetMb: 9, only: null, out: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--quality') opts.quality = Number(argv[++i]);
    else if (a === '--budget-mb') opts.budgetMb = Number(argv[++i]);
    else if (a === '--only') opts.only = String(argv[++i]).split(',').filter(Boolean);
    else if (a === '--out') opts.out = path.resolve(argv[++i]);
    else throw new Error('unknown argument ' + a);
  }
  if (!(opts.quality >= MIN_QUALITY && opts.quality <= 95)) throw new Error('--quality must be ' + MIN_QUALITY + '-95');
  if (!(opts.budgetMb > 0)) throw new Error('--budget-mb must be positive');
  if (opts.only && !opts.out) throw new Error('--only needs --out <folder>: a partial run never touches assets/seatviews');
  return opts;
}

function loadVenue() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'venue-data-ceca.js'), 'utf8'), context, { timeout: 20000 });
  return context.window.VENUE;
}

function encode(pngFile, webpFile, quality, size) {
  const args = ['-quiet', '-q', String(quality), '-m', '6', '-pass', '6'];
  if (size[0] !== WIDTH) args.push('-resize', String(size[0]), String(size[1]));
  const run = cp.spawnSync('cwebp', [...args, pngFile, '-o', webpFile], { timeout: 120000 });
  if (run.status !== 0) throw new Error('cwebp failed for ' + path.basename(pngFile) + ': ' + String(run.stderr));
  return fs.statSync(webpFile).size;
}

// Снима всички гледни точки в един браузър и една сцена; PNG-тата отиват във временна папка.
async function renderAll(views, base, pngDir) {
  const errors = [];
  const session = await launchSession({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
  });
  try {
    const page = await session.context.newPage();
    page.setDefaultTimeout(180000);
    page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message || e)));
    // Описът на картинките може още да го няма (първо пускане): само той е позволен 404.
    page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('/assets/seatviews/manifest.json')) errors.push('http ' + r.status() + ': ' + r.url()); });
    page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push('console: ' + m.text()); });
    await page.goto(base + '/#render', { waitUntil: 'load' });
    await page.waitForFunction(() => {
      const status = document.getElementById('startup-status');
      const failure = document.getElementById('startup-failure');
      return (failure && !failure.hidden) || (status && status.hidden);
    }, null, { timeout: 120000 });
    if (await page.evaluate(() => !document.getElementById('startup-failure').hidden)) {
      throw new Error('the page reported a startup failure: ' + errors.join('; '));
    }
    await page.addStyleTag({ content: '.arena-view__head,.arena-view__foot,.arena-view__status{display:none!important}' });
    await page.evaluate(async (mk) => {
      await window.ArenaSeatView.open({ venue: window.VENUE, mk, title: 'render', selected: [] });
    }, views[0].mk);
    await page.waitForFunction(() => !!window.arenaViewDebug, null, { timeout: 180000 });
    const seen = new Map();
    let n = 0;
    for (const view of views) {
      await page.evaluate(async (mk) => {
        window.arenaViewDebug.goTo(mk);
        // Три кадъра: рисуването е в rAF, който goTo е поискал преди нашия.
        for (let i = 0; i < 3; i++) await new Promise((resolve) => requestAnimationFrame(resolve));
      }, view.mk);
      const png = await page.locator('.arena-view canvas').screenshot({ type: 'png', animations: 'disabled' });
      const sum = crypto.createHash('sha256').update(png).digest('hex');
      if (seen.has(sum)) throw new Error(view.id + ' is pixel-identical to ' + seen.get(sum) + ': the viewpoint did not change');
      seen.set(sum, view.id);
      fs.writeFileSync(path.join(pngDir, view.id + '.png'), png);
      n++;
      if (n % 10 === 0 || n === views.length) console.log(`rendered ${n}/${views.length}`);
    }
  } finally {
    await session.close();
  }
  if (errors.length) throw new Error('browser errors during rendering:\n' + errors.join('\n'));
}

// Кодира с най-доброто качество и размер, при които сборът влиза в тавана.
function encodeAll(views, pngDir, webpDir, opts) {
  const budget = opts.budgetMb * 1024 * 1024;
  const tries = [];
  for (const size of SIZES) for (let q = opts.quality; q >= MIN_QUALITY; q -= 4) tries.push([q, size]);
  let last = null;
  for (const [q, size] of tries) {
    let total = 0;
    const sizes = new Map();
    for (const view of views) {
      sizes.set(view.id, encode(path.join(pngDir, view.id + '.png'), path.join(webpDir, view.id + '.webp'), q, size));
      total += sizes.get(view.id);
    }
    last = { q, size, total, sizes };
    console.log(`q${q} ${size[0]}x${size[1]}: ${(total / 1048576).toFixed(2)} MB`);
    if (total <= budget || opts.only) return last;
  }
  console.warn('WARNING: still over the budget at the lowest quality and size');
  return last;
}

function publish(views, webpDir, result) {
  const manifestViews = [];
  const keep = new Set(['manifest.json']);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const view of views) {
    const data = fs.readFileSync(path.join(webpDir, view.id + '.webp'));
    const hash = crypto.createHash('sha256').update(data).digest('hex').slice(0, 8);
    const file = view.id + '.' + hash + '.webp';
    fs.writeFileSync(path.join(OUT_DIR, file), data);
    keep.add(file);
    manifestViews.push({ ...view, file, bytes: data.length });
  }
  const manifest = { version: 1, width: result.size[0], height: result.size[1], quality: result.q, views: manifestViews };
  const tmp = path.join(OUT_DIR, 'manifest.json.tmp');
  fs.writeFileSync(tmp, JSON.stringify(manifest, null, 1) + '\n');
  fs.renameSync(tmp, path.join(OUT_DIR, 'manifest.json'));
  for (const name of fs.readdirSync(OUT_DIR)) if (!keep.has(name)) fs.rmSync(path.join(OUT_DIR, name), { force: true });
  return manifest;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!hasCwebp()) throw new Error('cwebp not found (brew install webp)');
  const all = plan(loadVenue());
  const views = opts.only ? all.filter((v) => opts.only.includes(v.id)) : all;
  if (opts.only && views.length !== opts.only.length) throw new Error('unknown view id in --only (known: ' + all.length + ' views, e.g. ' + all[0].id + ')');
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'ceca-seatviews-'));
  const pngDir = path.join(work, 'png');
  const webpDir = path.join(work, 'webp');
  fs.mkdirSync(pngDir);
  fs.mkdirSync(webpDir);
  // process.exit при сигнал не пуска finally: временната папка се трие и на 'exit'.
  process.on('exit', () => fs.rmSync(work, { recursive: true, force: true }));
  const server = await serve();
  try {
    await renderAll(views, 'http://127.0.0.1:' + server.address().port, pngDir);
    const result = encodeAll(views, pngDir, webpDir, opts);
    if (opts.only) {
      fs.mkdirSync(opts.out, { recursive: true });
      for (const view of views) fs.copyFileSync(path.join(webpDir, view.id + '.webp'), path.join(opts.out, view.id + '.webp'));
      console.log(`wrote ${views.length} views to ${opts.out} (${(result.total / 1024).toFixed(0)} KB)`);
    } else {
      const manifest = publish(views, webpDir, result);
      const counts = {};
      for (const v of manifest.views) counts[v.kind] = (counts[v.kind] || 0) + 1;
      console.log(`wrote ${manifest.views.length} views ${JSON.stringify(counts)}: ${(result.total / 1048576).toFixed(2)} MB, q${result.q}, ${result.size[0]}x${result.size[1]}`);
    }
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
    await closeServer(server);
  }
}

main().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });
