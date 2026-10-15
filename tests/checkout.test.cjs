// Чекаутът не вярва на цените в количката: всичко се смята наново от залата.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { checkout, read } = require('./checkout-harness.cjs');
const context = { window: {} };
vm.createContext(context);
vm.runInContext(read('venue-data-ceca.js'), context);
const VENUE = context.window.VENUE;
const freeSeats = VENUE.seats.features.filter(f => !f.properties.sold && !f.properties.offsale && f.properties.eur > 0);
const seat = freeSeats[0].properties, seat2 = freeSeats[1].properties;
const table = VENUE.tables.features.find(f => !f.properties.sold && !f.properties.offsale).properties;
const blocked = VENUE.tables.features.find(f => f.properties.sold || f.properties.offsale);
const MK = 'z:Standing';
const seatItem = (extra = {}) => Object.assign({ id: seat.mk, type: 'seat', quantity: 1 }, extra);
const tableItem = (extra = {}) => Object.assign({ id: table.mk, type: 'table', quantity: 6 }, extra);
const standingItem = (quantity, extra = {}) => Object.assign({ id: MK, type: 'standing', mk: MK, quantity }, extra);
const summary = (items) => checkout({ items }).html['order-summary'] || '';
const rejected = (items) => summary(items) === '';
const cents = (html) => { const m = html.match(/Билети \(\d+\)<\/span><strong>([\d.,\s]+)\s*€/); return m ? Math.round(parseFloat(m[1].replace(/\s/g, '').replace(',', '.')) * 100) : null; };

test('a valid cart is priced from the venue data, not from the cart', () => {
  const html = summary([seatItem({ lineTotal: 1, unitPrice: -5, eur: 0.01 }), standingItem(2, { lineTotal: 1 })]);
  assert.notEqual(html, '');
  assert.equal(cents(html), Math.round(seat.eur * 100) + 2 * 5000);
});

test('tampered prices are ignored: lineTotal 1, 1e308 and a negative unitPrice', () => {
  const honest = Math.round(seat.eur * 100);
  for (const forged of [{ lineTotal: 1 }, { lineTotal: 1e308 }, { unitPrice: -50, lineTotal: -50 }, { lineTotal: 'NaN', unitPrice: Infinity }]) {
    const html = summary([seatItem(forged)]);
    assert.notEqual(html, '', JSON.stringify(forged));
    assert.equal(cents(html), honest, JSON.stringify(forged));
    assert.doesNotMatch(html, /Infinity|NaN|e\+/);
  }
  assert.equal(cents(summary([standingItem(3, { lineTotal: 1, unitPrice: 0.01, eur: 0.01 })])), 15000);
});

test('a table is six admissions: a forged quantity 1 plus nine standing is rejected', () => {
  assert.ok(rejected([tableItem({ quantity: 1 }), standingItem(9)]));
  assert.ok(rejected([tableItem({ quantity: 1 })]));
  assert.ok(rejected([tableItem({ quantity: 6 }), standingItem(5)]));
  assert.notEqual(summary([tableItem(), standingItem(4)]), '');
});

test('unknown, foreign and unavailable identities are rejected', () => {
  assert.ok(rejected([seatItem({ id: 's:ZZ r:1 t:1' })]));
  assert.ok(rejected([tableItem({ id: 't:Masa_9999' })]));
  assert.ok(rejected([standingItem(2, { id: 'z:Other', mk: 'z:Other' })]));
  assert.ok(rejected([{ id: seat.mk, type: 'ticket', quantity: 1 }]));
  assert.ok(rejected([seatItem({ id: undefined })]));
  if (blocked) assert.ok(rejected([tableItem({ id: blocked.properties.mk })]));
});

test('duplicates, two standing rows and out-of-range quantities are rejected', () => {
  assert.ok(rejected([seatItem(), seatItem()]));
  assert.ok(rejected([tableItem(), tableItem()]));
  assert.ok(rejected([standingItem(2), standingItem(3)]));
  for (const quantity of [0, -1, 11, 1.5, '3', null, 1e9]) assert.ok(rejected([standingItem(quantity)]), String(quantity));
  assert.ok(rejected([seatItem({ quantity: 5 })]));
});

test('more than ten admissions are rejected however they are made up', () => {
  const many = freeSeats.slice(0, 11).map(f => ({ id: f.properties.mk, type: 'seat', quantity: 1 }));
  assert.ok(rejected(many));
  assert.notEqual(summary(many.slice(0, 10)), '');
  assert.ok(rejected([...many.slice(0, 5), standingItem(6)]));
  assert.notEqual(summary([...many.slice(0, 5), standingItem(5)]), '');
  assert.ok(rejected([seatItem(), seatItem({ id: seat2.mk }), tableItem(), standingItem(3)]));
});

test('a malformed cart or a missing venue shows the empty state, not a crash', () => {
  for (const cart of [null, {}, { items: 'x' }, { items: [] }, { items: [null] }, { items: [42] }]) {
    assert.equal((checkout(cart).html['order-summary'] || ''), '');
  }
  assert.equal(checkout({ items: [seatItem()] }, false).html['order-summary'] || '', '');
});

test('the checkout page loads the same venue-data stamp as the map page', () => {
  const stamp = (file) => read(file).match(/venue-data-ceca\.js\?v=([0-9a-f]+)/)[1];
  assert.equal(stamp('checkout/index.html'), stamp('index.html'));
});
