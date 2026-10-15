// Правостоящите (z:Standing): покупка на брой билети без място.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const base = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(base, file), 'utf8');
const MK = 'z:Standing';

// Същата рамка като в manual-selection.test.cjs: app.js върху фалшив DOM.
function app(options = {}) {
  const state = { rows: [], notices: [] };
  const storage = new Map(Object.entries(options.storage || {}));
  const noop = () => {};
  const context = { console, URLSearchParams, setTimeout, matchMedia: () => ({ matches: false }),
    location: { hostname: 'test', search: options.search || '', pathname: '/', hash: options.hash || '' },
    history: { replaceState: options.replaceState || noop }, sessionStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) },
    document: { readyState: 'complete', getElementById: () => null, querySelector: () => null },
    MutationObserver: class { observe() {} disconnect() {} },
    CustomEvent: class { constructor(name, options) { this.type = name; this.detail = options.detail; } },
  };
  context.window = { SeatMapStartup: options.startup, location: context.location, matchMedia: context.matchMedia, addEventListener: noop, dispatchEvent: noop };
  vm.createContext(context);
  for (const file of ['venue-data-ceca.js', 'seatfinder.js']) vm.runInContext(read(file), context);
  const ui = { openGate: options => state.gate = options, renderFilterBar: (_, handlers) => state.filters = handlers,
    showPicks: (rows, handlers) => { state.rows = Array.from(rows); state.handlers = handlers; },
    notify: notice => state.notices.push(notice) };
  context.window.UI = new Proxy(ui, { get: (obj, key) => obj[key] || noop });
  const selections = [];
  context.window.SeatMap = new Proxy({ init: options.mapInit || (init => { state.map = init; return { getZoom: () => 20 }; }),
    selectStanding: on => selections.push(!!on) }, { get: (obj, key) => obj[key] || noop });
  vm.runInContext(read('app.js'), context);
  state.selections = selections;
  return { state, window: context.window, storage };
}
const standingRow = (state) => state.rows.find(r => r.mk === MK);
const freeTable = (window) => window.VENUE.tables.features.find(f => !f.properties.sold && !f.properties.offsale);

test('the venue has one bookable standing zone', () => {
  const { window } = app();
  const zone = window.VENUE.standing.features[0].properties;
  assert.equal(zone.mk, MK);
  assert.equal(zone.eur, 50);
  assert.equal(zone.offsale, false);
});

test('tapping the zone adds as many tickets as the party size, as one list row', () => {
  const { state } = app();
  state.filters.onQuantityPick(3);
  state.map.onStandingClick(MK);
  const row = standingRow(state);
  assert.ok(row, 'standing row is listed');
  assert.equal(state.rows.length, 1);
  assert.equal(row.kind, 'standing');
  assert.equal(row.qty, 3);
  assert.equal(row.eur, 150);
  assert.match(row.seat, /3 билета · 50 € \/ билет/);
  assert.equal(state.selections.at(-1), true);
});

test('a second tap on the zone removes it, and so does the remove button', () => {
  const { state } = app();
  state.filters.onQuantityPick(2);
  state.map.onStandingClick(MK);
  state.map.onStandingClick(MK);
  assert.equal(state.rows.length, 0);
  assert.equal(state.selections.at(-1), false);
  state.map.onStandingClick(MK);
  assert.equal(standingRow(state).qty, 2);
  state.handlers.onRemove(MK);
  assert.equal(state.rows.length, 0);
  assert.equal(state.selections.at(-1), false);
});

test('with a table of six selected the party is clamped to four: six plus four is ten', () => {
  const { state, window } = app();
  state.map.onTableClick(freeTable(window).properties.mk);
  state.filters.onQuantityPick(8);
  state.map.onStandingClick(MK);
  const row = standingRow(state);
  assert.equal(row.qty, 4);
  assert.equal(row.max, 4);
  assert.match(state.notices.at(-1).text, /най-много 10/);
  // Десетият билет е последният: нито място, нито още маса влизат.
  state.filters.onQuantityPick(1);
  const seat = window.VENUE.seats.features.find(f => !f.properties.sold && !f.properties.offsale && f.properties.eur > 0);
  const before = state.rows.length;
  state.map.onSeatClick(seat.properties.mk);
  assert.equal(state.rows.length, before);
  assert.match(state.notices.at(-1).text, /най-много 10/);
});

test('the zone cannot be added when the order is already full', () => {
  const { state, window } = app();
  state.gate.onApply({ quantity: 10 });
  assert.equal(state.rows.length, 10);
  state.map.onStandingClick(MK);
  assert.equal(standingRow(state), undefined);
  assert.match(state.notices.at(-1).text, /най-много 10/);
  assert.ok(window.__standingOnly() === false);
});

test('the stepper stays within 1 and the ten-ticket limit', () => {
  const { state } = app();
  state.filters.onQuantityPick(2);
  state.map.onStandingClick(MK);
  state.handlers.onQuantity(MK, 3);
  assert.equal(standingRow(state).qty, 3);
  state.handlers.onQuantity(MK, 10);
  assert.equal(standingRow(state).qty, 10);
  assert.equal(standingRow(state).max, 10);
  // Единадесетият се отказва със същото предупреждение, броят не се мени.
  state.handlers.onQuantity(MK, 11);
  assert.equal(standingRow(state).qty, 10);
  assert.match(state.notices.at(-1).text, /най-много 10/);
  // Под 1 няма: махането е хиксът.
  state.handlers.onQuantity(MK, 1);
  state.handlers.onQuantity(MK, 0);
  assert.equal(standingRow(state).qty, 1);
  assert.match(standingRow(state).seat, /1 билет · 50 € \/ билет/);
});

test('the stepper cannot push past ten when a table is in the order', () => {
  const { state, window } = app();
  state.map.onTableClick(freeTable(window).properties.mk);
  state.filters.onQuantityPick(1);
  state.map.onStandingClick(MK);
  state.handlers.onQuantity(MK, 4);
  assert.equal(standingRow(state).qty, 4);
  state.handlers.onQuantity(MK, 5);
  assert.equal(standingRow(state).qty, 4);
});

test('the cart handed to checkout carries one standing item with totals', () => {
  const { state, window, storage } = app();
  state.filters.onQuantityPick(3);
  state.map.onStandingClick(MK);
  window.__onBuy();
  const cart = JSON.parse(storage.get('arena8888.checkout.cart.v1'));
  assert.equal(cart.ticketCount, 3);
  assert.equal(cart.subtotal, 150);
  const [item] = cart.items;
  assert.deepEqual({ type: item.type, mk: item.mk, name: item.name, quantity: item.quantity, eur: item.eur, eurAll: item.eurAll, lineTotal: item.lineTotal },
    { type: 'standing', mk: MK, name: 'Правостоящи', quantity: 3, eur: 50, eurAll: 51.02, lineTotal: 150 });
});

test('standing is restored after coming back from checkout, with a table, within ten tickets', () => {
  const first = app();
  first.state.map.onTableClick(freeTable(first.window).properties.mk);
  first.state.filters.onQuantityPick(4);
  first.state.map.onStandingClick(MK);
  first.window.__onBuy();
  const saved = first.storage.get('arena8888.checkout.cart.v1');
  assert.equal(JSON.parse(saved).ticketCount, 10);
  // „Назад" от чекаута: ?restore=1 връща и масата, и правостоящите.
  const again = app({ search: '?restore=1', storage: { 'arena8888.checkout.cart.v1': saved } });
  assert.equal(standingRow(again.state).qty, 4);
  assert.equal(again.state.rows.length, 2);
  assert.equal(again.window.__standingOnly(), false);
  // Развален запис над лимита се реже до 10 и не пада.
  const huge = JSON.parse(saved);
  huge.items.find(i => i.type === 'standing').quantity = 9;
  const clipped = app({ search: '?restore=1', storage: { 'arena8888.checkout.cart.v1': JSON.stringify(huge) } });
  assert.equal(standingRow(clipped.state).qty, 4);
});

test('"other seats" and the recommendation replace standing, like they replace tables', () => {
  const { state } = app();
  state.filters.onQuantityPick(3);
  state.map.onStandingClick(MK);
  state.gate.onApply({ quantity: 2 });
  assert.equal(standingRow(state), undefined);
  assert.equal(state.rows.length, 2);
});

const { checkout } = require('./checkout-harness.cjs');
const standingCart = (quantity, extra = {}) => ({ items: [Object.assign({ id: MK, type: 'standing', mk: MK, quantity }, extra)] });

test('checkout accepts a standing item: summary line, ticket count and total', () => {
  const { html } = checkout(standingCart(3));
  const summary = html['order-summary'];
  assert.match(summary, /Правостоящи × 3/);
  assert.match(summary, /summary-count">3</);
  assert.match(summary, /Билети \(3\)/);
  assert.match(summary, /150[.,]00\s*€/);
  assert.match(summary, /на билет/);
  // Таксата за обслужване е отделно: общата сума е 150 + 1,60.
  assert.match(summary, /151[.,]60\s*€/);
});

test('checkout rejects a standing item that is not the venue zone, an eleventh ticket, or two standing rows', () => {
  assert.equal(checkout(standingCart(3, { mk: 'z:Other' })).html['order-summary'] || '', '');
  assert.equal(checkout(standingCart(11)).html['order-summary'] || '', '');
  const twice = standingCart(3);
  twice.items.push(Object.assign({}, twice.items[0], { id: 'z:Standing-2' }));
  assert.equal(checkout(twice).html['order-summary'] || '', '');
});

test('the SVG plan exposes the standing zone as a keyboard-reachable button with its label', () => {
  const source = read('map-svg.js');
  const label = source.match(/function zoneLabel\(p\) \{[\s\S]*?\n  \}/)[0];
  const price = source.match(/function zonePrice\(p\) \{[^\n]*\}/)[0];
  const context = { fees: false, available: p => !p.sold && !p.offsale && Number.isFinite(p.eur) };
  vm.createContext(context);
  vm.runInContext(price + label, context);
  const zone = vm.runInContext('zoneLabel({name:"Правостоящи",eur:50,eurAll:51.02})', context);
  assert.equal(zone, 'Правостоящи, 50 € на билет');
  assert.match(source, /kind === 'standing'\) \{[\s\S]{0,300}node\.setAttribute\('tabindex', '0'\)/);
  assert.match(source, /if \(kind === 'standing'\) options\.onStandingClick\?\.\(key\)/);
  const plan = (() => { const c = { window: {} }; vm.createContext(c); vm.runInContext(read('ceca-plan-svg.js'), c); return c.window.CecaPlanSVG; })();
  assert.equal([...plan.matchAll(/<g\b[^>]*data-kind="standing"/g)].length, 1);
  assert.match(plan, /data-key="z:Standing"/);
});

test('coming back from checkout removes only the restore parameter, keeping view, event and the hash', () => {
  const calls = [];
  app({ search: '?view=2d&event=concert&restore=1', hash: '#selection', replaceState: (_s, _t, url) => calls.push(url) });
  assert.deepEqual(calls, ['/?view=2d&event=concert#selection']);
  const only = [];
  app({ search: '?restore=1', replaceState: (_s, _t, url) => only.push(url) });
  assert.deepEqual(only, ['/']);
});

test('an exception while the app starts goes explicitly to the startup failure screen, whatever its shape', () => {
  for (const reason of [{ code: 3 }, 'plain', undefined, new Error('boom')]) {
    const failures = [];
    assert.doesNotThrow(() => app({ startup: { fail: r => failures.push(r) }, mapInit: () => { throw reason; } }));
    assert.equal(failures.length, 1);
    assert.equal(failures[0], reason);
  }
  // Без startup.js грешката не се поглъща.
  assert.throws(() => app({ mapInit: () => { throw new Error('boom'); } }), /boom/);
});
