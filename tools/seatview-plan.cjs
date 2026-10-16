'use strict';
/* Кои гледни точки се рисуват като картинки (assets/seatviews) и кое място коя ползва.
   Чиста функция над залата (VENUE), без браузър и без диск: ползват я рисувачът
   (tools/render-seatviews.cjs) и тестът, който пази описа свеж.

   - Трибуна: за всеки сектор с места в продажба - по един изглед от средния ред и средното
     място; при повече от 12 реда в продажба още два (предна и задна третина).
   - Маси: масите се групират по ред (по y), от всеки ред се взимат лява, средна и дясна.
   - Правостоящи: един изглед.
   "В продажба" е структурното състояние (не е блокирано и има цена): продадените на живо места
   не местят гледните точки. */
const SeatViews = require('../seatviews.js');

const TALL_SECTOR_ROWS = 12;
const ROW_Y_TOLERANCE = 0.35;
const SIDES = ['left', 'centre', 'right'];

function onSale(p) {
  return !p.offsale && Number.isFinite(p.eur) && p.eur > 0;
}

// Индексът на представителя в група от n елемента, разделена на k равни части.
function pickIndex(n, k, part) {
  return Math.min(n - 1, Math.floor(((part + 0.5) * n) / k));
}

function tribuneViews(venue) {
  const bySector = new Map();
  for (const f of venue.seats.features) {
    const p = f.properties;
    if (!onSale(p)) continue;
    if (!bySector.has(p.s)) bySector.set(p.s, new Map());
    const rows = bySector.get(p.s);
    if (!rows.has(p.r)) rows.set(p.r, []);
    rows.get(p.r).push(p);
  }
  const views = [];
  const sectors = [...bySector.keys()].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  for (const sector of sectors) {
    const rows = bySector.get(sector);
    const rowKeys = [...rows.keys()].sort((a, b) => Number(a) - Number(b));
    const parts = rowKeys.length > TALL_SECTOR_ROWS ? 3 : 1;
    for (let part = 0; part < parts; part++) {
      const row = rowKeys[pickIndex(rowKeys.length, parts, part)];
      const seats = rows.get(row).slice().sort((a, b) => Number(a.t) - Number(b.t));
      const seat = seats[pickIndex(seats.length, 1, 0)];
      views.push({ id: 's-' + sector + '-r' + row, kind: 'tribune', sector, row, mk: seat.mk });
    }
  }
  return views;
}

// Масите на един ред имат (почти) едно и също y; редът 1 е най-близо до сцената (най-голямото y).
function tableRows(venue) {
  const tables = venue.tables.features.map((f) => ({ p: f.properties, x: f.geometry.coordinates[0], y: f.geometry.coordinates[1] }));
  tables.sort((a, b) => b.y - a.y);
  const rows = [];
  for (const t of tables) {
    const row = rows.find((r) => Math.abs(r.y - t.y) < ROW_Y_TOLERANCE);
    if (row) row.tables.push(t);
    else rows.push({ y: t.y, tables: [t] });
  }
  return rows;
}

function tableViews(venue) {
  const views = [];
  tableRows(venue).forEach((row, i) => {
    const sorted = row.tables.slice().sort((a, b) => a.x - b.x);
    const parts = Math.min(SIDES.length, sorted.length);
    for (let part = 0; part < parts; part++) {
      const t = sorted[pickIndex(sorted.length, parts, part)];
      const side = parts === SIDES.length ? SIDES[part] : 'p' + part;
      views.push({ id: 't-r' + (i + 1) + '-' + side, kind: 'table', tableRow: i + 1, side, mk: t.p.mk });
    }
  });
  return views;
}

function standingViews(venue) {
  const f = ((venue.standing || {}).features || [])[0];
  return f ? [{ id: 'standing', kind: 'standing', mk: f.properties.mk }] : [];
}

function tableNumber(properties) {
  const m = /(\d+)$/.exec(String(properties.token || properties.mk));
  return m ? Number(m[1]) : null;
}

// Гледните точки с обхвата им: редовете (трибуна) или масите (маса), които всяка покрива.
function plan(venue) {
  const views = [...tribuneViews(venue), ...tableViews(venue), ...standingViews(venue)];
  const lookup = { views };
  const covered = new Map(views.map((v) => [v.id, []]));
  for (const f of venue.seats.features) {
    const p = f.properties;
    if (!onSale(p)) continue;
    const view = SeatViews.nearest(venue, p.mk, lookup);
    if (view) covered.get(view.id).push(Number(p.r));
  }
  for (const f of venue.tables.features) {
    const view = SeatViews.nearest(venue, f.properties.mk, lookup);
    if (view) covered.get(view.id).push(tableNumber(f.properties));
  }
  for (const view of views) {
    const list = covered.get(view.id);
    if (view.kind === 'tribune') view.rows = [Math.min(...list), Math.max(...list)];
    if (view.kind === 'table') view.tables = [...new Set(list)].sort((a, b) => a - b);
  }
  return views;
}

module.exports = { plan, onSale, tableNumber };
