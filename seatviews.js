/* Изглед от мястото като готови картинки (assets/seatviews/*.webp), рисувани от истинската
   3D сцена (tools/render-seatviews.cjs). Тук е само търсенето: кое място коя картинка
   ползва, и зареждането на описа (manifest.json). Чиста логика, без DOM, с тест.

   nearest(venue, mk, manifest) -> view | null
     - място на трибуна: същият сектор, най-близкият по номер ред;
     - маса: най-близката по разстояние маса от описа;
     - правостоящи: единствената картинка на зоната.
   Ако секторът няма картинки (затворен сектор), връща null. */
(function (root) {
  'use strict';
  var DIR = 'assets/seatviews/';
  var MANIFEST = DIR + 'manifest.json';

  // "s:B.2.2 r:27 t:1" -> { s: 'B.2.2', r: '27', t: '1' }
  function parseSeat(mk) {
    var m = /^s:(\S+) r:(\S+) t:(\S+)$/.exec(String(mk));
    return m ? { s: m[1], r: m[2], t: m[3] } : null;
  }

  // Описът се индексира веднъж на обект; кешът не пази нищо след края на обекта.
  var indexes = typeof WeakMap === 'function' ? new WeakMap() : null;
  function indexOf(manifest) {
    var hit = indexes && indexes.get(manifest);
    if (hit) return hit;
    var bySector = {}, tables = [], standing = null;
    (manifest.views || []).forEach(function (view) {
      if (view.kind === 'tribune') (bySector[view.sector] = bySector[view.sector] || []).push(view);
      else if (view.kind === 'table') tables.push(view);
      else if (view.kind === 'standing' && !standing) standing = view;
    });
    var built = { bySector: bySector, tables: tables, standing: standing };
    if (indexes) indexes.set(manifest, built);
    return built;
  }

  // Координатите на масите по mk, веднъж на обект залата.
  var tableCoords = typeof WeakMap === 'function' ? new WeakMap() : null;
  function coordsOf(venue) {
    var hit = tableCoords && tableCoords.get(venue);
    if (hit) return hit;
    var map = {};
    ((venue.tables && venue.tables.features) || []).forEach(function (f) {
      map[f.properties.mk] = f.geometry.coordinates;
    });
    if (tableCoords) tableCoords.set(venue, map);
    return map;
  }

  function rowDistance(a, b) {
    var x = Number(a), y = Number(b);
    if (isFinite(x) && isFinite(y)) return Math.abs(x - y);
    return String(a) === String(b) ? 0 : Infinity;
  }

  function nearest(venue, mk, manifest) {
    if (!manifest || !manifest.views || !mk) return null;
    var index = indexOf(manifest);
    mk = String(mk);
    if (mk.charAt(0) === 'z') return index.standing;
    if (mk.charAt(0) === 't') {
      var coords = coordsOf(venue || {});
      var here = coords[mk];
      if (!here) return null;
      var best = null, bestD = Infinity;
      index.tables.forEach(function (view) {
        var at = coords[view.mk];
        if (!at) return;
        var d = (at[0] - here[0]) * (at[0] - here[0]) + (at[1] - here[1]) * (at[1] - here[1]);
        if (d < bestD) { bestD = d; best = view; }
      });
      return best;
    }
    var seat = parseSeat(mk);
    var list = seat && index.bySector[seat.s];
    if (!list || !list.length) return null;
    var pick = null, pickD = Infinity;
    list.forEach(function (view) {
      var d = rowDistance(view.row, seat.r);
      if (d < pickD) { pickD = d; pick = view; }
    });
    return pick;
  }

  function url(view) {
    return DIR + view.file;
  }

  // Описът се тегли веднъж; грешка не се помни, за да може следващото отваряне да опита пак.
  var pending = null;
  function load() {
    if (pending) return pending;
    pending = fetch(MANIFEST, { credentials: 'same-origin' }).then(function (res) {
      if (!res.ok) throw new Error('seatviews manifest ' + res.status);
      return res.json();
    }).then(function (manifest) {
      if (!manifest || !Array.isArray(manifest.views)) throw new Error('seatviews manifest shape');
      return manifest;
    }).catch(function (error) {
      pending = null;
      throw error;
    });
    return pending;
  }

  // Предварително теглене на описа, когато браузърът е свободен: първото отваряне на
  // изгледа го намира готов. Грешките се мълчат (изгледът пак ще опита при отваряне).
  function warm() {
    var run = function () { load().catch(function () {}); };
    if (typeof root.requestIdleCallback === 'function') root.requestIdleCallback(run, { timeout: 4000 });
    else setTimeout(run, 1500);
  }

  var api = { DIR: DIR, parseSeat: parseSeat, nearest: nearest, url: url, load: load, warm: warm };
  root.SeatViews = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window === 'object' ? window : globalThis);
