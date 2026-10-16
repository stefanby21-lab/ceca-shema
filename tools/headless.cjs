'use strict';
/* Общото за инструментите, които снимат сайта в chromium-headless-shell
   (tools/render-previews.cjs, tools/render-seatviews.cjs):

   - findPlaywrightCore / findHeadlessShell: намират пакета и браузъра (никога инсталиран Chrome);
   - serve(root): локален сървър, който дава само файловете на сайта (tools/static-guard.cjs);
   - launchSession(options): стартира браузъра с ИЗВЕСТЕН профил (os.tmpdir()/ceca-render-profile),
     който се чисти преди старт и след край. Затварянето е едно за край, грешка и сигнал:
       1. изчаква стартиране, което още тече (Playwright вече е направил профила, а браузърът
          още не е върнат) - иначе сигналът би го оставил;
       2. затваря контекста (с таван на изчакване);
       3. убива всичко, което още държи профила (процесите са намерени по --user-data-dir=<профил>
          с ps, затова работи и когато close() увисне или стартирането не е свършило) и изчаква да изчезнат;
       4. трие профила; чак тогава процесът излиза.
   Един профил значи, че два инструмента не се пускат едновременно. */
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const { publicRelative } = require('./static-guard.cjs');

const ROOT = path.resolve(__dirname, '..');
const HOME = os.homedir();
const PENDING_TIMEOUT_MS = 20000;
const KILL_TIMEOUT_MS = 6000;

const settings = { profile: path.join(os.tmpdir(), 'ceca-render-profile'), launcher: null, closeTimeoutMs: 8000 };
// За тестове: друг профил и друг стартер (без истински браузър).
function configure(next) { Object.assign(settings, next || {}); }

// Първият съществуващ път от шаблон за папка (най-новата версия първа).
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

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.json': 'application/json', '.pbf': 'application/x-protobuf' };

// Само файловете, които сайтът наистина качва; частните данни на друга зала, точковите файлове
// и всичко извън корена никога не се сервират.
function serve(root = ROOT) {
  let realRoot;
  try { realRoot = fs.realpathSync(root); } catch (_) { realRoot = root; }
  const server = http.createServer((req, res) => {
    const rel = publicRelative(req.url || '/');
    let file = null;
    if (rel) {
      try {
        // Символна връзка не може да изведе навън: окончателният път трябва да е под корена.
        const real = fs.realpathSync(path.join(root, rel));
        if (real.startsWith(realRoot + path.sep) && fs.statSync(real).isFile()) file = real;
      } catch (_) { file = null; }
    }
    if (!file) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}
function closeServer(server) {
  if (!server) return Promise.resolve();
  return new Promise((resolve) => {
    server.close(resolve);
    if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
  });
}

function hasCwebp() {
  return cp.spawnSync('cwebp', ['-version'], { timeout: 10000 }).status === 0;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function within(promise, ms) {
  return Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve('timeout'), ms))]);
}

// pid-овете на всичко, чиято команда носи профила (браузърът и неговите помощни процеси).
function profilePids() {
  let out = '';
  try { out = cp.execFileSync('ps', ['-axo', 'pid=,command='], { encoding: 'utf8', timeout: 10000, maxBuffer: 16 * 1024 * 1024 }); } catch (_) { return []; }
  const needle = '--user-data-dir=' + settings.profile;
  const pids = [];
  for (const line of out.split('\n')) {
    const m = /^\s*(\d+)\s+(.*)$/.exec(line);
    if (!m || Number(m[1]) === process.pid) continue;
    const at = m[2].indexOf(needle);
    // Следва край на реда или интервал: профил с общ префикс (…-2) не се хваща.
    if (at >= 0 && (at + needle.length === m[2].length || m[2][at + needle.length] === ' ')) pids.push(Number(m[1]));
  }
  return pids;
}
async function killProfileProcesses() {
  const deadline = Date.now() + KILL_TIMEOUT_MS;
  for (;;) {
    const pids = profilePids();
    if (!pids.length) return true;
    for (const pid of pids) { try { process.kill(pid, 'SIGKILL'); } catch (_) { /* вече го няма */ } }
    if (Date.now() > deadline) return false;
    await sleep(100);
  }
}
function removeProfile() {
  fs.rmSync(settings.profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

const live = new Set();
let handlersInstalled = false;

async function shutdown(rec) {
  if (rec.closing) return rec.closing;
  rec.closing = (async () => {
    // Стартиране, което още тече: Playwright вече е направил профила, но няма върнат контекст.
    if (rec.pending) await within(rec.pending.then(() => 0, () => 0), PENDING_TIMEOUT_MS);
    if (rec.context) {
      let closed;
      try { closed = await within(Promise.resolve(rec.context.close()).then(() => 'ok', () => 'ok'), settings.closeTimeoutMs); } catch (_) { closed = 'error'; }
      void closed;
    }
    await killProfileProcesses();
    try { removeProfile(); } catch (_) { /* вече го няма */ }
    live.delete(rec);
  })();
  return rec.closing;
}

function installHandlers() {
  if (handlersInstalled) return;
  handlersInstalled = true;
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(sig, () => {
      Promise.all([...live].map(shutdown)).catch(() => {}).finally(() => process.exit(130));
    });
  }
  // Последна защита при внезапен край: синхронно, без да се чака.
  process.on('exit', () => {
    for (const pid of profilePids()) { try { process.kill(pid, 'SIGKILL'); } catch (_) { /* вече го няма */ } }
    try { removeProfile(); } catch (_) { /* вече го няма */ }
  });
}

/* launchSession({ args, ...contextOptions }) -> { context, close() }
   contextOptions отиват към launchPersistentContext (viewport, deviceScaleFactor, isMobile, hasTouch ...).
   Всяко извикване започва с чист профил. Връща се и при грешка на стартирането - след почистване. */
async function launchSession(options = {}) {
  installHandlers();
  await killProfileProcesses();
  removeProfile();
  const rec = { pending: null, context: null, closing: null };
  live.add(rec);
  const { args = [], ...contextOptions } = options;
  const resolveLauncher = () => {
    if (settings.launcher) return settings.launcher;
    const core = findPlaywrightCore();
    if (!core) throw new Error('playwright-core not found: set PLAYWRIGHT_CORE or install it');
    const shell = findHeadlessShell();
    if (!shell || !fs.existsSync(shell)) throw new Error('chrome-headless-shell not found: run "npx playwright install chromium-headless-shell" or set HEADLESS_SHELL');
    const { chromium } = require(core);
    return (profile, launchOptions) => chromium.launchPersistentContext(profile, { executablePath: shell, headless: true, ...launchOptions });
  };
  try {
    const launcher = resolveLauncher();
    rec.pending = Promise.resolve().then(() => launcher(settings.profile, { args, ...contextOptions }));
    rec.context = await rec.pending;
  } catch (error) {
    await shutdown(rec);
    throw error;
  }
  return { context: rec.context, close: () => shutdown(rec) };
}

module.exports = { ROOT, findPlaywrightCore, findHeadlessShell, serve, closeServer, hasCwebp, launchSession, configure, profilePids };
