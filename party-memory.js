/* Помни избрания брой билети от портата за 1 час (както SeatGeek).
   Чистата логика е отделена от localStorage, за да се тества: parse() решава
   дали записът още важи, read() и write() само го носят до хранилището. */
(function (root) {
  'use strict';
  var KEY = 'ceca.party.v1';
  var TTL_MS = 60 * 60 * 1000;
  var MIN = 1, MAX = 10;

  // Връща брой от MIN до MAX или null: изтекъл, повреден или от бъдещето запис
  // се държи като липсващ, и портата тръгва от стандартното си число.
  function parse(raw, now) {
    if (typeof raw !== 'string' || !raw) return null;
    var data;
    try { data = JSON.parse(raw); } catch (_) { return null; }
    if (!data || typeof data !== 'object') return null;
    var n = data.n, t = data.t;
    if (typeof n !== 'number' || !Number.isInteger(n) || n < MIN || n > MAX) return null;
    if (typeof t !== 'number' || !isFinite(t) || typeof now !== 'number' || !isFinite(now)) return null;
    var age = now - t;
    if (age < 0 || age >= TTL_MS) return null;
    return n;
  }

  function store() {
    try { return root.localStorage || null; } catch (_) { return null; }
  }

  function read(now) {
    var s = store();
    if (!s) return null;
    try { return parse(s.getItem(KEY), typeof now === 'number' ? now : Date.now()); } catch (_) { return null; }
  }

  function write(n, now) {
    if (typeof n !== 'number' || !Number.isInteger(n) || n < MIN || n > MAX) return false;
    var s = store();
    if (!s) return false;
    try {
      s.setItem(KEY, JSON.stringify({ n: n, t: typeof now === 'number' ? now : Date.now() }));
      return true;
    } catch (_) { return false; }
  }

  var api = { KEY: KEY, TTL_MS: TTL_MS, parse: parse, read: read, write: write };
  root.PartyMemory = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window === 'object' ? window : globalThis);
