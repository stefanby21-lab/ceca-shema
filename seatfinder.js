(function (A) {
  "use strict";
  var h = {
      balanced: { view: 0.4, price: 0.35, centrality: 0.25 },
      price: { view: 0.15, price: 0.7, centrality: 0.15 },
      view: { view: 0.65, price: 0.1, centrality: 0.25 },
    },
    E = 18,
    _ = 20,
    k = 2,
    w = { venue: null, initialized: !1 };
  function p(r, e, i) {
    return r < e ? e : r > i ? i : r;
  }
  function z() {
    if (!w.initialized) throw new Error("SeatFinder.find: not initialized - call SeatFinder.init(window.VENUE) first.");
  }
  function I(r) {
    if (!r || !r.seats || !Array.isArray(r.seats.features))
      throw new Error("SeatFinder.init: venue.seats.features (array) is required.");
    if (!r.adjacency || !Array.isArray(r.adjacency.runs))
      throw new Error("SeatFinder.init: venue.adjacency.runs (array) is required.");
    return ((w.venue = r), (w.initialized = !0), !0);
  }
  function L(r) {
    var e = r.properties || {},
      i = r.geometry && r.geometry.coordinates;
    return {
      mk: e.mk,
      s: e.s,
      r: e.r,
      t: e.t,
      eur: e.eur,
      tier: e.tier,
      view: Number.isFinite(e.view) ? e.view : .5,
      lngLat: i ? [i[0], i[1]] : [0, 0],
    };
  }
  // Връща отсечките от реда, които минават филтрите, заедно с началния им
  // индекс в целия ред - индексът трябва да е спрямо реда, за да може после
  // да се прецени дали остава самотно място в края му.
  function K(r, e, i, n, excludeObstructed) {
    for (var c = [], a = [], segStart = 0, v = 0; v < r.length; v++) {
      var l = r[v],
        t = e[l].properties,
        u = (!i || i.has(t.tier)) && t.sold !== !0 && t.offsale !== !0 && Number.isFinite(t.eur) && t.eur > 0 && (!excludeObstructed || !t.obstructed),
        d = n ? (n.key === "eurAll" && typeof t.eurAll == "number" ? t.eurAll : t.eur) : 0,
        f = !n || ((n.min == null || d >= n.min) && (n.max == null || d <= n.max));
      u && f ? (a.length === 0 && (segStart = v), a.push(l)) : a.length && (c.push({ i0: segStart, arr: a }), (a = []));
    }
    return (a.length && c.push({ i0: segStart, arr: a }), c);
  }
  // Групов билет не бива да оставя едно самотно свободно място в края на реда,
  // защото единичните места се продават трудно.
  function O(r, e, i) {
    return e !== 1 && r - (e + i) !== 1;
  }
  // Кое е най-близкото до кликнатото място разположение на N билета, което не
  // осиротява място. Връща началния индекс или -1, ако редът не позволява.
  function R(r, e, i) {
    if (!Number.isInteger(r) || !Number.isInteger(i) || i < 1 || r < i) return -1;
    for (var n = p(e - Math.floor((i - 1) / 2), 0, r - i), c = -1, a = 1 / 0, v = 0; v + i <= r; v++)
      if (O(r, v, i)) {
        var l = Math.abs(v - n);
        l < a && ((a = l), (c = v));
      }
    return c;
  }
  function N(r, e) {
    for (var i = r.length, n = new Array(i), c = 0, a = 0, v = 0, l = 0, t = 1 / 0, u = -1 / 0, f = 0; f < i; f++) {
      var o = L(e[r[f]]);
      ((n[f] = o),
        (c += o.eur),
        (a += o.view),
        (v += o.lngLat[0]),
        (l += o.lngLat[1]),
        o.tier < t && (t = o.tier),
        o.tier > u && (u = o.tier));
    }
    var s = c / i,
      y = [v / i, l / i];
    return {
      seats: n,
      mks: n.map(function (g) {
        return g.mk;
      }),
      section: n[0].s,
      row: n[0].r,
      totalEur: c,
      avgEur: s,
      minTier: t,
      maxTier: u,
      view: a / i,
      centroid: y,
      score: 0,
    };
  }
  function P(r) {
    var e = 1 - p(Math.abs(r[0]) / E, 0, 1),
      i = 1 - p(Math.abs(r[1]) / E, 0, 1);
    return (e + i) / 2;
  }
  function x(r, e) {
    for (var i = h[e] || h.balanced, n = 1 / 0, c = -1 / 0, a = 0; a < r.length; a++) {
      var v = r[a].avgEur;
      (v < n && (n = v), v > c && (c = v));
    }
    for (var l = c - n, t = 0; t < r.length; t++) {
      var u = r[t],
        f = l > 0 ? 1 - (u.avgEur - n) / l : 1,
        o = u.view,
        s = P(u.centroid);
      ((u.score = i.view * o + i.price * f + i.centrality * s), (u._viewScoreForTiebreak = o));
    }
  }
  function C(r, e) {
    if (e.score !== r.score) return e.score - r.score;
    if (e._viewScoreForTiebreak !== r._viewScoreForTiebreak) return e._viewScoreForTiebreak - r._viewScoreForTiebreak;
    if (r.totalEur !== e.totalEur) return r.totalEur - e.totalEur;
    var i = String(r.section) + String(r.row),
      n = String(e.section) + String(e.row);
    return i < n ? -1 : i > n ? 1 : 0;
  }
  function M(r) {
    (z(), (r = r || {}));
    var e = r.partySize;
    if (!Number.isInteger(e) || e < 1) throw new Error("SeatFinder.find: partySize must be an integer >= 1.");
    for (
      var i = Array.isArray(r.tiers) ? new Set(r.tiers) : null,
        n = r.price
          ? { key: r.price.key === "eurAll" ? "eurAll" : "eur", min: r.price.min ?? null, max: r.price.max ?? null }
          : typeof r.maxPriceEur == "number"
            ? { key: "eur", min: null, max: r.maxPriceEur }
            : null,
        c = h.hasOwnProperty(r.sortBy) ? r.sortBy : "balanced",
        a = Number.isInteger(r.topK) && r.topK > 0 ? r.topK : _,
        v = w.venue.seats.features,
        l = w.venue.adjacency.runs,
        t = [],
        u = 0;
      u < l.length;
      u++
    )
      for (var f = l[u], o = K(f, v, i, n, r.excludeObstructed), s = 0; s < o.length; s++) {
        var y = o[s].arr,
          segStart = o[s].i0;
        if (!(y.length < e))
          for (var g = 0; g + e <= y.length; g++)
            (r.allowOrphan === !0 || physicalWindowAllowed(f, v, y[g], e)) && t.push(N(y.slice(g, g + e), v));
      }
    if (!t.length) return [];
    (x(t, c), t.sort(C));
    for (var F = new Map(), m = [], S = 0; S < t.length && m.length < a; S++) {
      var d = t[S],
        T = String(d.section) + "|" + String(d.row),
        b = F.get(T) || 0;
      b >= k || (F.set(T, b + 1), delete d._viewScoreForTiebreak, m.push(d));
    }
    return m;
  }
  // Manual selection stays anchored to the clicked seat, within its physical run.
  // Reuse the same availability and price boundaries as recommendations.
  function findAround(mk, options) {
    z();
    options = options || {};
    var count = options.partySize;
    if (!Number.isInteger(count) || count < 1) return [];
    var seats = w.venue.seats.features,
      tiers = Array.isArray(options.tiers) ? new Set(options.tiers) : null;
    for (var run of w.venue.adjacency.runs) {
      if (!run.some(index => seats[index].properties.mk === mk)) continue;
      for (var segment of K(run, seats, tiers, options.price, options.excludeObstructed)) {
        var anchor = segment.arr.findIndex(index => seats[index].properties.mk === mk);
        if (anchor < 0 || segment.arr.length < count) continue;
        var preferred = p(anchor - Math.floor((count - 1) / 2), 0, segment.arr.length - count);
        var starts = [];
        for (var start = Math.max(0, anchor - count + 1); start <= anchor && start + count <= segment.arr.length; start++) {
          if (physicalWindowAllowed(run, seats, segment.arr[start], count)) starts.push(start);
        }
        starts.sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred));
        if (starts.length) return segment.arr.slice(starts[0], starts[0] + count).map(index => seats[index].properties.mk);
      }
    }
    return [];
  }
  function physicalWindowAllowed(run, seats, first, count) {
    for (const segment of K(run, seats, null, null, false)) {
      const start = segment.arr.indexOf(first);
      if (start >= 0) return O(segment.arr.length, start, count);
    }
    return false;
  }
  // Свободната отсечка, в която седи едно място: колко свободни места са
  // слепени с него и кои са те. Панелът пита това, за да каже честно защо не
  // може да вземе точно толкова, колкото човекът иска. Без филтри отговорът е
  // физическият ред; с филтри - това, което човекът вижда.
  function segmentAround(mk, options) {
    z();
    options = options || {};
    var seats = w.venue.seats.features,
      tiers = Array.isArray(options.tiers) ? new Set(options.tiers) : null;
    for (var run of w.venue.adjacency.runs) {
      if (!run.some(index => seats[index].properties.mk === mk)) continue;
      for (var segment of K(run, seats, tiers, options.price, options.excludeObstructed)) {
        if (segment.arr.some(index => seats[index].properties.mk === mk))
          return segment.arr.map(index => seats[index].properties.mk);
      }
    }
    return [];
  }
  function leavesIsolatedSeat(mks) {
    z();
    const selected = new Set(mks), seats = w.venue.seats.features;
    for (const run of w.venue.adjacency.runs) {
      for (const segment of K(run, seats, null, null, false)) {
        if (segment.arr.length < 2) continue; // Existing singletons are not caused by this order.
        let free = 0;
        for (const index of segment.arr) {
          if (selected.has(seats[index].properties.mk)) {
            if (free === 1) return true;
            free = 0;
          } else free++;
        }
        if (free === 1) return true;
      }
    }
    return false;
  }
  A.SeatFinder = { init: I, find: M, findAround: findAround, segmentAround, leavesIsolatedSeat, leavesNoOrphan: O, pickWindow: R };
})(typeof window < "u" ? window : globalThis);
