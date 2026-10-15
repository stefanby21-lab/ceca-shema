const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'party-memory.js'), 'utf8');
function load(storage) {
  const context = { window: { localStorage: storage }, Date };
  context.window.window = context.window;
  vm.runInNewContext(source, context);
  return context.window.PartyMemory;
}
function memory() {
  const data = new Map();
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
  };
}
const HOUR = 60 * 60 * 1000;

test('a stored party size is returned within the hour and dropped after it', () => {
  const { parse, KEY } = load(memory());
  const t0 = 1_800_000_000_000;
  const raw = JSON.stringify({ n: 4, t: t0 });
  assert.equal(parse(raw, t0), 4);
  assert.equal(parse(raw, t0 + HOUR - 1), 4);
  assert.equal(parse(raw, t0 + HOUR), null);
  assert.equal(parse(raw, t0 + 5 * HOUR), null);
  assert.equal(typeof KEY, 'string');
});

test('invalid, foreign or future records behave as if nothing was stored', () => {
  const { parse } = load(memory());
  const now = 1_800_000_000_000;
  for (const raw of [null, undefined, '', 'x', '{', '[]', 'null', '7', '"4"',
    JSON.stringify({ n: 0, t: now }), JSON.stringify({ n: 11, t: now }), JSON.stringify({ n: 2.5, t: now }),
    JSON.stringify({ n: '3', t: now }), JSON.stringify({ n: 3 }), JSON.stringify({ n: 3, t: 'now' }),
    JSON.stringify({ n: 3, t: now + 1000 }), JSON.stringify({ n: null, t: now })])
    assert.equal(parse(raw, now), null, String(raw));
  assert.equal(parse(JSON.stringify({ n: 3, t: now }), NaN), null);
});

test('write then read round-trips through storage and expires with the clock', () => {
  const store = memory();
  const memo = load(store);
  const t0 = 1_800_000_000_000;
  assert.equal(memo.read(t0), null);
  assert.equal(memo.write(6, t0), true);
  assert.equal(memo.read(t0 + 30 * 60 * 1000), 6);
  assert.equal(memo.read(t0 + HOUR + 1), null);
  assert.equal(memo.write(0, t0), false);
  assert.equal(memo.write(11, t0), false);
  assert.equal(memo.write(2.5, t0), false);
  assert.equal(memo.read(t0 + 1000), 6, 'a rejected write must not clobber the stored value');
});

test('blocked or throwing storage never throws', () => {
  const throwing = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('quota'); },
  };
  const memo = load(throwing);
  assert.equal(memo.read(), null);
  assert.equal(memo.write(3), false);
  const noStorage = { window: {}, Date };
  noStorage.window.window = noStorage.window;
  Object.defineProperty(noStorage.window, 'localStorage', { get() { throw new Error('denied'); } });
  vm.runInNewContext(source, noStorage);
  assert.equal(noStorage.window.PartyMemory.read(), null);
  assert.equal(noStorage.window.PartyMemory.write(3), false);
});
