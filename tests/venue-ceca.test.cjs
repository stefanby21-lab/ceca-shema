const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const base = path.join(__dirname, '..');
const CECA = path.join(base, 'venue-data-ceca.js');
const GENERATOR = path.join(base, 'tools', 'ceca-to-venue.py');
const CONTRACT = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'venue-contract.json'), 'utf8'));

function load(file) {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(file, 'utf8'), context);
  // JSON кръгът изважда обектите от vm контекста, иначе deepStrictEqual се чупи на прототипите.
  return JSON.parse(JSON.stringify(context.window.VENUE));
}
const V = load(CECA);
const seats = V.seats.features.map(f => f.properties);
const tables = V.tables.features.map(f => f.properties);
// Както в seatfinder.js и app.js: мястото се продава само ако не е sold/offsale и има цена.
const sellable = p => p.sold !== true && p.offsale !== true && Number.isFinite(p.eur) && p.eur > 0;
const keySet = fc => [...new Set(fc.features.flatMap(f => Object.keys(f.properties)))].sort();
const rowPrices = (sector, row) => [...new Set(seats.filter(p => p.s === sector && p.r === String(row)).map(p => (sellable(p) ? p.eur : 'off')))];

const BLOCKED_TABLES = [7, 8, 9, 21, 22, 23, 24, 25, 37, 38, 39, 40, 47, 48, 49, 50, 69, 70, 71, 72, 80, 81, 82, 96, 97, 98, 99,
  110, 111, 112, 113, 114, 121, 122, 123, 124, 125, 139, 140, 141, 142, 143, 157, 158, 159, 160];
const OFF_SECTORS = ['A.1.1', 'A.2.1', 'A.3.1', 'C.1.6', 'C.2.6', 'C.3.6', 'V.I.P',
  '200', '201', '202', '203', '204', '205', '206', '207', '209', '210', '211', '212', '213', '214'];

test('meta describes the Ceca event with the assumed table size', () => {
  assert.equal(V.meta.event, 'Цеца');
  assert.equal(V.meta.date, '2026-11-07');
  assert.equal(V.meta.venue, 'Арена 8888');
  assert.equal(V.meta.availabilitySource, 'demo');
  assert.equal(V.meta.sourceFile, 'ceca shema.html');
  assert.equal(V.meta.organizer, "C'est La Vie Restaurant & Club");
  assert.equal(V.meta.vipTableIncludes.length, 6);
  assert.equal(V.meta.sections, V.sections.features.length);
  assert.equal(V.meta.seats, seats.length);
  assert.equal(V.meta.tables, 180);
  assert.equal(V.meta.runs, V.adjacency.runs.length);
});

test('data contract: committed fixture of required keys', () => {
  assert.deepEqual(Object.keys(V).sort(), CONTRACT.topLevel);
  for (const key of CONTRACT.meta) assert.ok(key in V.meta, 'meta.' + key);
  for (const key of Object.keys(CONTRACT.properties)) assert.deepEqual(keySet(V[key]), CONTRACT.properties[key], key);
  assert.deepEqual(Object.keys(V.tiers[0]).sort(), CONTRACT.tierKeys);
  assert.deepEqual(Object.keys(V.meta.tableLevels[0]).sort(), CONTRACT.tableLevelKeys);
});

test('the fixture holds key names only, never data values', () => {
  const walk = node => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === 'object') return Object.values(node).forEach(walk);
    assert.equal(typeof node, 'string');
    assert.match(node, /^[A-Za-z][A-Za-z0-9_]*$|^Key names only/);
  };
  walk(CONTRACT);
});

// Ожидания за масите, написани независимо от генератора: цена по номер и затворените номера.
function checkTables(list) {
  assert.equal(list.length, 180);
  assert.equal(BLOCKED_TABLES.length, 46);
  const byNumber = new Map(list.map(p => [Number(p.token.replace('Masa_', '')), p]));
  assert.deepEqual([...byNumber.keys()].sort((a, b) => a - b), Array.from({ length: 180 }, (_, i) => i + 1));
  for (const [n, p] of byNumber) {
    const price = n <= 75 ? 1300 : n <= 150 ? 1100 : 900;
    assert.equal(p.name, 'Маса ' + n);
    assert.equal(p.mk, 't:Masa_' + n);
    assert.equal(p.seats, 6);
    if (BLOCKED_TABLES.includes(n)) {
      assert.equal(p.sold, true, 'table ' + n);
      assert.equal(p.offsale, true, 'table ' + n);
      assert.equal(p.eur, null, 'table ' + n);
      assert.equal(p.tableLevel, null, 'table ' + n);
    } else {
      assert.equal(p.sold, false, 'table ' + n);
      assert.equal(p.offsale, undefined, 'table ' + n);
      assert.equal(p.eur, price, 'table ' + n);
      assert.equal(p.eurAll, price + 1.02, 'table ' + n);
      assert.equal(p.eurPerSeat, Math.round((price / 6) * 100) / 100, 'table ' + n);
      assert.equal(p.tableLevel, n <= 75 ? 0 : n <= 150 ? 1 : 2, 'table ' + n);
    }
  }
  assert.equal(list.filter(p => p.offsale).length, BLOCKED_TABLES.length);
}

test('180 tables of 6 seats: price by number, blocked numbers from the sheet', () => {
  checkTables(tables);
  const levels = V.meta.tableLevels;
  assert.deepEqual(levels.map(l => l.eurTable), [1300, 1100, 900]);
  assert.deepEqual(levels.map(l => l.perSeat), ['217 € на място', '183 € на място', '150 € на място']);
  assert.equal(new Set(levels.map(l => l.color)).size, 3);
  for (const l of levels) assert.match(l.pill, /^#[0-9A-F]{6}$/i);
});

test('off-sale sectors cannot be sold', () => {
  const offSections = V.sections.features.filter(f => f.properties.offsale).map(f => f.properties.token);
  for (const token of OFF_SECTORS) assert.ok(offSections.includes(token), token + ' must be off sale');
  for (const token of offSections) {
    const mine = seats.filter(p => p.s === token);
    assert.ok(mine.length > 0);
    assert.ok(mine.every(p => !sellable(p) && p.sold === true && p.offsale === true), token);
  }
  // Секторите извън листа с цените (D.2.x) също не се продават.
  assert.ok(seats.filter(p => p.s.startsWith('D.')).every(p => !sellable(p)));
});

// Ценоразписът по сектори, изписан ръчно и независимо от генератора.
// eur - основна цена; from - първият ред за продажба (по-ниските са затворени);
// blocked - затворени редове по средата; tail - по-евтини редове от даден ред нататък.
const T40_30 = { eur: 40, from: 1, blocked: [], tail: { from: 14, eur: 30 } };
const SECTOR_RULES = {
  'A.1.2': { eur: 80, from: 4, blocked: [6] },
  'A.1.3': { eur: 70, from: 4, blocked: [6] },
  'A.1.4': { eur: 60, from: 4, blocked: [6] },
  'A.1.5': { eur: 50, from: 4, blocked: [] },
  'A.1.6': { eur: 50, from: 4, blocked: [] },
  'C.1.1': { eur: 50, from: 4, blocked: [] },
  'C.1.2': { eur: 50, from: 4, blocked: [] },
  'C.1.3': { eur: 60, from: 4, blocked: [6] },
  'C.1.4': { eur: 70, from: 4, blocked: [6] },
  'C.1.5': { eur: 80, from: 4, blocked: [6] },
  'A.2.2': { eur: 60, from: 1, blocked: [] },
  'A.2.3': { eur: 60, from: 1, blocked: [] },
  'A.2.4': { eur: 60, from: 1, blocked: [] },
  'A.2.5': { eur: 50, from: 1, blocked: [] },
  'A.2.6': { eur: 50, from: 1, blocked: [] },
  'C.2.1': { eur: 50, from: 1, blocked: [] },
  'C.2.2': { eur: 50, from: 1, blocked: [] },
  'C.2.3': { eur: 60, from: 1, blocked: [] },
  'C.2.4': { eur: 60, from: 1, blocked: [] },
  'C.2.5': { eur: 60, from: 1, blocked: [] },
  'B.1.1': { eur: 60, from: 5, blocked: [7] },
  'B.1.2': { eur: 60, from: 5, blocked: [7] },
  'B.1.3': { eur: 60, from: 5, blocked: [7] },
  'B.1.4': { eur: 60, from: 5, blocked: [7] },
  'B.2.1': { eur: 50, from: 1, blocked: [] },
  'B.2.2': { eur: 50, from: 1, blocked: [] },
  'B.2.3': { eur: 50, from: 1, blocked: [] },
  'B.2.4': { eur: 50, from: 1, blocked: [] },
  'B.2.5': { eur: 50, from: 1, blocked: [] },
  'B.2.6': { eur: 50, from: 1, blocked: [] },
  'B.2.7': { eur: 50, from: 1, blocked: [] },
  'B.2.8': { eur: 50, from: 1, blocked: [] },
  'A.3.2': T40_30,
  'A.3.3': T40_30,
  'A.3.4': { ...T40_30, blocked: [1] },
  'A.3.5': { ...T40_30, blocked: [1] },
  'A.3.6': T40_30,
  'C.3.1': T40_30,
  'C.3.2': T40_30,
  'C.3.3': T40_30,
  'C.3.4': { ...T40_30, blocked: [1] },
  'C.3.5': { ...T40_30, blocked: [1] },
};
const WHOLLY_OFF = ['A.1.1', 'A.2.1', 'A.3.1', 'C.1.6', 'C.2.6', 'C.3.6', 'V.I.P',
  'D.2.1', 'D.2.2', 'D.2.3', 'D.2.4', 'D.2.5', 'D.2.6', 'D.2.7', 'D.2.8',
  '200', '201', '202', '203', '204', '205', '206', '207', '209', '210', '211', '212', '213', '214'];

// Цената, която мястото трябва да има, или null ако не се продава.
function expectedEur(sector, row) {
  const rule = SECTOR_RULES[sector];
  if (!rule) return null;
  if (row < rule.from || rule.blocked.includes(row)) return null;
  return rule.tail && row >= rule.tail.from ? rule.tail.eur : rule.eur;
}

function checkSeatPrices(list, sections) {
  const known = new Set([...Object.keys(SECTOR_RULES), ...WHOLLY_OFF]);
  for (const p of list) {
    assert.ok(known.has(p.s), 'unexpected sector ' + p.s);
    const want = expectedEur(p.s, Number(p.r));
    const where = p.s + ' ред ' + p.r;
    if (want === null) {
      assert.equal(p.sold, true, where);
      assert.equal(p.offsale, true, where);
      assert.equal(p.eur, null, where);
      assert.equal(sellable(p), false, where);
    } else {
      assert.equal(p.sold, false, where);
      assert.equal(p.offsale, undefined, where);
      assert.equal(p.eur, want, where);
      assert.equal(p.eurAll, Math.round((want + 1.02) * 100) / 100, where);
      assert.equal(sellable(p), true, where);
    }
  }
  // Всеки сектор от таблицата съществува, а изцяло затворените нямат продаваемо място.
  const present = new Set(list.map(p => p.s));
  for (const token of known) assert.ok(present.has(token), 'no seats in ' + token);
  for (const token of WHOLLY_OFF) assert.ok(list.filter(p => p.s === token).every(p => !sellable(p)), token);
  const offSections = sections.filter(f => f.properties.offsale).map(f => f.properties.token).sort();
  assert.deepEqual(offSections, [...WHOLLY_OFF].sort());
}

test('every sector: price per row, first sellable row, blocked rows, off-sale sectors', () => {
  assert.equal(Object.keys(SECTOR_RULES).length, 42);
  assert.equal(WHOLLY_OFF.length, 29);
  checkSeatPrices(seats, V.sections.features);
  // Всеки ред е само с една цена (или изцяло затворен): без смесване в ред.
  for (const [sector, rule] of Object.entries(SECTOR_RULES)) {
    const rows = [...new Set(seats.filter(p => p.s === sector).map(p => p.r))];
    for (const r of rows) assert.equal(rowPrices(sector, r).length, 1, sector + ' ред ' + r);
    assert.ok(rows.some(r => expectedEur(sector, Number(r)) !== null), sector);
    for (const b of rule.blocked) assert.deepEqual(rowPrices(sector, b), ['off'], sector + ' блокиран ред ' + b);
  }
});

test('the price check catches a wrong rule (mutations on in-memory copies)', () => {
  const copy = () => JSON.parse(JSON.stringify(seats));
  const sectionFeatures = V.sections.features;
  const mutate = (fn) => { const c = copy(); fn(c); return c; };
  // C.2.3 от 60 на 50 евро.
  assert.throws(() => checkSeatPrices(mutate(c => c.filter(p => p.s === 'C.2.3').forEach(p => { p.eur = 50; p.eurAll = 51.02; })), sectionFeatures));
  // Затворен ред става свободен: B.1.1 ред 7.
  assert.throws(() => checkSeatPrices(mutate(c => c.filter(p => p.s === 'B.1.1' && p.r === '7').forEach(p => { p.sold = false; delete p.offsale; p.eur = 60; p.eurAll = 61.02; })), sectionFeatures));
  // Опашката на A.3.2 вдига цената от 30 на 40.
  assert.throws(() => checkSeatPrices(mutate(c => c.filter(p => p.s === 'A.3.2' && p.r === '14').forEach(p => { p.eur = 40; p.eurAll = 41.02; })), sectionFeatures));
  // Изцяло затворен сектор се отваря: C.1.6.
  assert.throws(() => checkSeatPrices(mutate(c => c.filter(p => p.s === 'C.1.6').forEach(p => { p.sold = false; delete p.offsale; p.eur = 50; p.eurAll = 51.02; })), sectionFeatures));
  // Масите: цена и затворен номер.
  const tableCopy = () => JSON.parse(JSON.stringify(tables));
  const t1 = tableCopy(); t1.find(p => p.token === 'Masa_76').eur = 1300;
  assert.throws(() => checkTables(t1));
  const t2 = tableCopy(); const t = t2.find(p => p.token === 'Masa_7'); t.sold = false; delete t.offsale; t.eur = 1300; t.tableLevel = 0;
  assert.throws(() => checkTables(t2));
});

test('tiers: one per distinct seat price, seats and pins point at them', () => {
  assert.deepEqual(V.tiers.map(t => t.label), ['30 €', '40 €', '50 €', '60 €', '70 €', '80 €']);
  for (const p of seats.filter(sellable)) {
    assert.equal(V.tiers[p.tier].label, p.eur + ' €');
    assert.equal(p.eurAll, Math.round((p.eur + 1.02) * 100) / 100);
  }
  for (const f of V.pins.features) {
    assert.equal(V.tiers[f.properties.tier].label, f.properties.priceFrom + ' €');
    assert.ok(!OFF_SECTORS.includes(f.properties.mk.slice(2)));
  }
});

test('standing zone', () => {
  assert.equal(V.standing.features.length, 1);
  const f = V.standing.features[0];
  assert.deepEqual(f.properties, { mk: 'z:Standing', name: 'Правостоящи', token: 'Standing', eur: 50, eurAll: 51.02, capacity: 738, offsale: false });
  assert.equal(f.geometry.type, 'Polygon');
  const ring = f.geometry.coordinates[0];
  assert.deepEqual(ring[0], ring[ring.length - 1]);
  assert.equal(ring.length, 5);
});

test('stage and floor labels come from the SVG rectangles', () => {
  const ring = V.stage.geometry.coordinates[0];
  assert.equal(ring.length, 5);
  const cx = (Math.min(...ring.map(p => p[0])) + Math.max(...ring.map(p => p[0]))) / 2;
  assert.ok(Math.abs(cx - V.focus[0]) < 0.001);
  assert.deepEqual(V.objectLabels.features.map(f => f.properties.label), ['СЦЕНА', 'FOH', 'BAR', 'BAR']);
});

test('adjacency runs cover every seat exactly once and run = free segment length', () => {
  const seen = new Uint8Array(seats.length);
  for (const run of V.adjacency.runs) {
    let segment = [];
    const flush = () => { segment.forEach(i => { assert.equal(seats[i].run, segment.length); }); segment = []; };
    for (const i of run) {
      seen[i]++;
      if (sellable(seats[i])) segment.push(i); else { assert.equal(seats[i].run, undefined); flush(); }
    }
    flush();
  }
  assert.ok(seen.every(n => n === 1));
  assert.equal(V.adjacency.runs.length, V.rowLabels.features.length);
});

// Частната админ страница не е в репото. Ако я има на машината, от нея се вадят в движение
// името на администратора и всичко извън SVG схемата; нищо от това не се записва тук.
const PRIVATE_PAGE = path.join(process.env.HOME || '', 'Downloads', 'ceca shema', 'ceca shema.html');
function adminChromeText() {
  const html = fs.readFileSync(PRIVATE_PAGE, 'utf8');
  return html
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');
}
function adminNameTokens(chrome) {
  const m = chrome.match(/Администратор:\s*(.+?)\s*Изход/);
  assert.ok(m, 'the admin name was not found next to the label');
  return m[1].split(/\s+/).filter(t => t.length >= 3);
}
function repoFiles() {
  const run = args => spawnSync('git', args, { cwd: base, encoding: 'utf8', timeout: 20000 });
  const tracked = run(['ls-files', '-z']);
  const others = run(['ls-files', '-z', '--others', '--exclude-standard']);
  assert.equal(tracked.status, 0, tracked.stderr);
  const names = new Set([...tracked.stdout.split('\0'), ...(others.stdout || '').split('\0')].filter(Boolean));
  names.add('venue-data-ceca.js');
  return [...names];
}

test('no administrator text or sales words leak into the data', () => {
  const text = fs.readFileSync(CECA, 'utf8');
  assert.ok(!text.includes('Администратор'));
  for (const word of ['Пуснати', 'Продадени', 'Резервирани']) assert.ok(!text.includes(word), word);
  assert.ok(!/продад|sold out|Продажби|revenue/i.test(text.replace(/"sold"/g, '')));
  assert.ok(!/@[a-z0-9-]+\.[a-z]{2,}/i.test(text));
  // Нито една свободна седалка не носи продажбен брой.
  const allowed = new Set(['mk', 's', 'r', 't', 'obstructed', 'sold', 'eur', 'eurAll', 'tier', 'view', 'run', 'offsale']);
  for (const p of seats) for (const k of Object.keys(p)) assert.ok(allowed.has(k), k);
});

test('the administrator name from the private page is in no repo file', { skip: !fs.existsSync(PRIVATE_PAGE) }, () => {
  const tokens = adminNameTokens(adminChromeText()).map(t => t.toLowerCase());
  assert.ok(tokens.length >= 1);
  let scanned = 0;
  for (const name of repoFiles()) {
    let buf;
    try { buf = fs.readFileSync(path.join(base, name)); } catch (e) { continue; } // изтрит в работното дърво
    if (buf.includes(0)) continue; // двоичен файл
    scanned++;
    const lower = buf.toString('utf8').toLowerCase();
    for (const token of tokens) assert.ok(!lower.includes(token), 'admin name token found in ' + name);
  }
  assert.ok(scanned > 10);
});

const SOURCES = [
  path.join(process.env.HOME || '', 'Downloads', 'ceca shema', 'ceca shema.html'),
  path.join(process.env.HOME || '', 'Downloads', 'Spreadsheets', 'CECA Tickets & VIP Tables Price.xlsx'),
];
test('generator output is byte-identical on a second run', { skip: !SOURCES.every(f => fs.existsSync(f)) }, () => {
  const out = path.join(require('node:os').tmpdir(), 'venue-ceca-rerun-' + process.pid + '.js');
  try {
    // Празен низ за вход значи "по подразбиране" (файловете в ~/Downloads).
    const r = spawnSync('python3', [GENERATOR, '', '', out, '--date', V.meta.availabilityDate], { encoding: 'utf8', timeout: 120000 });
    assert.equal(r.status, 0, r.stderr);
    assert.ok(Buffer.compare(fs.readFileSync(out), fs.readFileSync(CECA)) === 0);
  } finally {
    fs.rmSync(out, { force: true });
  }
});
