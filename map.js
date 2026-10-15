window.SeatMap = (function () {
  "use strict";
  const Fe = ["#1a9850", "#66bd63", "#a6d96a", "#fee08b", "#fdae61", "#f46d43", "#d73027", "#a50026"],
    // Светла подложка: избраното е ТЪМНОСИНЬО ядро - върху бледия под и
    // цветната рампа на нивата това е единственото, което бие всичко.
    Ce = "#46587A",
    Ae = "#153D8A",
    // Продаденото/извън филтъра трябва да ОТСТЪПВА, не да свети: сиво, малко
    // по-тъмно от пода, за да личи, че мястото го има, но не е за продан.
    Ge = "#C3CAD5",
    Ke2 = "#D2D8E1",
    K = ["Noto Sans Regular"],
    // Шрифтовете се сервират от нас. demotiles.maplibre.org е демо сървър без
    // CORS хедъри за част от диапазоните - кирилицата и знакът € гърмяха.
    Ve = "font/{fontstack}/{range}.pbf",
    ue = 111319.49,
    Pe = 0.37,
    $e = 0.12,
    A = typeof matchMedia == "function" && matchMedia("(max-width: 880px)").matches,
    Dt =
      (typeof matchMedia == "function" && matchMedia("(pointer: coarse)").matches) ||
      (typeof window < "u" && "ontouchstart" in window),
    Ee = A ? 16 : 24,
    Je = 60,
    Qe = 17,
    // Минимална едрина на място в пиксели, под която камерата не се отдалечава.
    et = 22,
    tt = 18,
    nt = 0.05,
    ot = 2.8,
    it = 1.2,
    // Ръчният зум има повече свобода от автоматичното кадриране: с бутоните
    // трябва да може да се влезе плътно в местата и да се отстъпи назад от
    // началния изглед, без камерата сама да отива дотам.
    hz = 0.9,
    lz = 0.5,
    // Колко мащаб дава едно натискане на бутон. Едно ниво (двойно) се усещаше
    // малко, когато и без това остават две натискания до тавана.
    sz = 1.25,
    // Колко мащаб се отстъпва от "площта точно опира ръбовете".
    vz = 0.4,
    // Колко от завъртането към сцената се ползва на първата стъпка.
    bz = 0.55,
    // С колко от височината на екрана слизат местата при "изглед от мястото"
    // на широк екран: те остават в долната третина, а сцената застава отгоре,
    // по средата. Отместването е в ПИКСЕЛИ на екрана, не в координати: старото
    // изместване на центъра (22% от пътя до сцената) растеше с разстоянието и
    // при далечните сектори изкарваше самите избрани места от кадъра, затова
    // беше нулирано за всички. На телефон екранът е тесен, сцената е по-широка
    // от него при този мащаб и кадърът остава върху местата.
    vo = A ? 0 : 0.22,
    // Изглед от мястото на широк екран: малко по-дълго от останалите ходове,
    // защото наклонът скача от 18 на 64 градуса и по-кратко се усещаше рязко.
    sd = 1400,
    // Докъде камерата може да се завърти в зала със сцена в единия край. При
    // 35° страничните блокове на НДК (истинската посока към сцената е 51°) не
    // се обръщаха докрай към нея. 55° покрива и най-страничния блок, без да
    // позволява камерата да мине зад гърба на зрителя.
    we = 55;
  // Местата на маса идват от данните (свойството seats); 6 е само резервата.
  // Масите на концерта са коктейлни: две бар столчета към всяка, а не по едно
  // на място - затова столчетата в 3D са TABLE_STOOLS, а билетите са seats.
  const TABLE_SEATS_FALLBACK = 6,
    TABLE_STOOLS = 2;
  function tableSeatsOf(p) {
    return p && Number(p.seats) > 0 ? Number(p.seats) : TABLE_SEATS_FALLBACK;
  }
  function tableSeatsAll() {
    const first = ((l && l.tables && l.tables.features) || [])[0];
    return tableSeatsOf(first && first.properties);
  }
  let i = null,
    // Таван и под за автоматичното кадриране. Не съвпадат с тези на картата -
    // ръчният зум стига по-далеч и в двете посоки.
    zx = 22,
    zi = 0,
    l = null,
    H = new Map(),
    z = new Map(),
    P = new Map(),
    E = null,
    k = !1,
    g = !1,
    O = 0.3,
    m = null,
    W = null,
    _e = 0,
    fe = null,
    S = null,
    F = null,
    b = null,
    R = !1,
    D = null,
    de = new Set(),
    He = new Set(),
    x = { center: [0, 0], zoom: 2 },
    y = [0, 0],
    X = 30,
    N = [0, 0];
  function pe(e, t) {
    // Изместването на целта отвъд сцената важи само за местата, залепени за
    // нея. Преди прагът беше 0.4 от залата и обръщаше посоката на цели
    // сектори до сцената (D.1.2 гледаше на 139 градуса накриво).
    const n = Math.hypot(y[0] - e, y[1] - t),
      q2 = Math.max(0, 1 - n / (0.08 * X)),
      r = q2 * q2 * 0.4 * X,
      a = y[0] + N[0] * r,
      s = y[1] + N[1] * r;
    let c = (Math.atan2(a - e, s - t) * 180) / Math.PI;
    // В зала "в кръг" (места и от двете страни на сцената) камерата трябва да
    // може да заобиколи изцяло, за да гледа иззад сектора към сцената.
    return ((N[0] || N[1]) && !Gn && (c = Math.max(-we, Math.min(we, c))), c);
  }
  function rt(e, t) {
    return [e + (y[0] - e) * 0.55, t + (y[1] - t) * 0.55];
  }
  // Плавно спиране (cubic-out): камерата тръгва решително и спира меко.
  // Вграденото на MapLibre (quad-out) спира по-рязко и при завъртане към
  // сцената се усещаше като подръпване в края.
  function vd(k) {
    return 1 - Math.pow(1 - k, 3);
  }
  // Системната настройка "по-малко движение" се чете при всяко кадриране, а не
  // веднъж при зареждане - човек може да я смени, докато схемата е отворена.
  function rmo() {
    return typeof matchMedia == "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  let w = null,
    T = null,
    ge = !1,
    _ = !0,
    he = function () {},
    B = x.zoom + 2.6,
    me = B - 0.4,
    Y = B + 0.4,
    h = !1,
    ye = function () {},
    be = function () {},
    xe = function () {},
    ze = function () {},
    Jn = function () {},
    qn2 = function () {},
    // Зоната за правостоящи: покупка без място, затова има свой клик.
    Sn2 = function () {},
    Z,
    q,
    G,
    // Търсеният брой места заедно. Всяко място носи дължината на свободната
    // редица, в която попада - оттам схемата знае кои стават за групата.
    Gq2,
    Pq2 = 0,
    V,
    $,
    J,
    Q,
    ee,
    te,
    ne,
    oe;
  function j(e, t) {
    if (!(!e || !e.length)) {
      if (typeof e[0] == "number") {
        t(e);
        return;
      }
      for (let n = 0; n < e.length; n++) j(e[n], t);
    }
  }
  function ke(e) {
    let t = 1 / 0,
      n = 1 / 0,
      o = -1 / 0,
      r = -1 / 0;
    return (
      ((e && e.features) || []).forEach(function (s) {
        !s.geometry ||
          !s.geometry.coordinates ||
          j(s.geometry.coordinates, function (c) {
            (c[0] < t && (t = c[0]), c[1] < n && (n = c[1]), c[0] > o && (o = c[0]), c[1] > r && (r = c[1]));
          });
      }),
      t === 1 / 0
        ? null
        : [
            [t, n],
            [o, r],
          ]
    );
  }
  function at(e) {
    if (!e.geometry || !e.geometry.coordinates) return [0, 0];
    let t = 0,
      n = 0,
      o = 0;
    return (
      j(e.geometry.coordinates, function (r) {
        ((t += r[0]), (n += r[1]), o++);
      }),
      o ? [t / o, n / o] : [0, 0]
    );
  }
  function st(e) {
    const t = e.properties && e.properties.centroid;
    return Array.isArray(t) && t.length === 2 && typeof t[0] == "number" ? t : at(e);
  }
  function ct() {
    const e = ["match", ["get", "bucket"]];
    return (
      Fe.forEach(function (t, n) {
        e.push(n, t);
      }),
      e.push(Ce),
      e
    );
  }
  function Se(e, t) {
    const n =
        typeof t == "function"
          ? t
          : function (a) {
              return a;
            },
      o = ["match", e],
      r = l.tiers && l.tiers.length ? l.tiers : null;
    return (
      r
        ? r.forEach(function (a) {
            o.push(a.tier, n(a.color));
          })
        : Fe.forEach(function (a, s) {
            o.push(s, n(a));
          }),
      o.push(n(Ce)),
      o
    );
  }
  function Oe(e, t) {
    const n = /^#?([0-9a-f]{6})$/i.exec(String(e).trim());
    if (!n) return e;
    const o = parseInt(n[1], 16),
      r = Math.round(((o >> 16) & 255) * t),
      a = Math.round(((o >> 8) & 255) * t),
      s = Math.round((o & 255) * t);
    return (
      "#" +
      [r, a, s]
        .map(function (c) {
          return ("0" + Math.max(0, Math.min(255, c)).toString(16)).slice(-2);
        })
        .join("")
    );
  }
  // Накъде "гледа" мястото: към центъра на залата, с лек наклон към сцената.
  // Съотношението е леко, за да не изглеждат местата извъртени неестествено.
  const Ln = 0.28;
  function Bn(e, t) {
    let n = In[0] - e,
      o = In[1] - t,
      r = Math.hypot(n, o) || 1;
    ((n /= r), (o /= r));
    let a = y[0] - e,
      s = y[1] - t,
      c = Math.hypot(a, s) || 1;
    ((a /= c), (s /= c));
    const u = n * (1 - Ln) + a * Ln,
      d = o * (1 - Ln) + s * Ln,
      f = Math.hypot(u, d) || 1;
    return [u / f, d / f];
  }
  let In = [0, 0],
    Se2 = null,
    Ne2 = 0,
    Fe2 = 0,
    Wn = 0,
    tp = 0,
    Mc = null,
    Dt2 = null,
    Zn2 = !1,
    // Отделен флаг за блока с масите. Zn2 се гаси от слушателя на zoom, а
    // кадрирането на масите на телефон изобщо не мърда камерата (в кадъра
    // влиза и сцената), тоест мащабът остава домашният и масата ставаше
    // ненатискаема - допирът само пре-кадрираше блока, до безкрай.
    Bz2 = !1,
    Qt2 = null,
    Kq2 = 0,
    Xq2 = function () {},
    Ct2 = 0,
    Yt,
    Gn = !1;
  // Най-стегнатото разстояние между две места. В голяма зала гъстотата се мени
  // по сектори и ако пукът се оразмери по средната стъпка, в най-натъпканите
  // редове местата се сливат в едно петно.
  function Xn() {
    const e = (l.seats && l.seats.features) || [];
    if (e.length < 2) return O;
    const t = Math.max(1, Math.floor(e.length / 300)),
      n = Math.max(1, Math.floor(e.length / 900)),
      o = [];
    for (let r = 0; r < e.length; r += t) {
      const a = e[r].geometry.coordinates;
      let s = 1 / 0;
      for (let c = 0; c < e.length; c += n) {
        if (c === r) continue;
        const u = e[c].geometry.coordinates,
          d = a[0] - u[0],
          f = a[1] - u[1],
          M = d * d + f * f;
        M > 0 && M < s && (s = M);
      }
      s < 1 / 0 && o.push(Math.sqrt(s));
    }
    return (
      o.sort(function (r, a) {
        return r - a;
      }),
      o[Math.floor(o.length * 0.1)] || O
    );
  }
  // Височината на местата: партерът е равен, трибуните се качват диагонално
  // навън - едно голямо ниво, което просто расте с отдалечаването от центъра,
  // а секторите, обявени за втори етаж, стъпват върху него.
  function zt2() {
    if (window.ArenaGeometry && l.meta?.venue === 'Арена 8888') {
      window.ArenaGeometry.apply(l);
      Se2 = function(){return false;};
      return;
    }
    const e = (l.seats && l.seats.features) || [],
      up = (l.meta && l.meta.upperTier) || [];
    ((Se2 = null), (Ne2 = 0), (Fe2 = 0));
    // Височина се дава само на зали, за които е обявен горен етаж - в
    // класическа зала трибуни няма и всичко остава на пода.
    if (!up.length || !e.length) {
      e.forEach(function (t) {
        t.properties.el = 0;
      });
      return;
    }
    // Всеки сектор е рампа: редовете вътре в него се качват един над друг с
    // видимо стъпало, а самият сектор стъпва толкова по-високо, колкото
    // по-далече от сцената е. Така схемата е наклонена, без да става кула.
    const secs = new Map();
    e.forEach(function (t) {
      const p = t.properties || {},
        k2 = String(p.s),
        rk = String(p.r),
        c = t.geometry.coordinates,
        d = Math.hypot(c[0] - y[0], c[1] - y[1]);
      let sc = secs.get(k2);
      sc || ((sc = { rows: new Map(), min: 1 / 0 }), secs.set(k2, sc));
      let rw = sc.rows.get(rk);
      rw || ((rw = { d: 0, n: 0, a: [] }), sc.rows.set(rk, rw));
      ((rw.d += d), rw.n++, rw.a.push(t), d < sc.min && (sc.min = d));
    });
    let g0 = 1 / 0,
      g1 = 0;
    secs.forEach(function (sc) {
      (sc.min < g0 && (g0 = sc.min), sc.min > g1 && (g1 = sc.min));
    });
    // Наклонът на трибуната: около 15% - стъпалото между два реда е повече от
    // половин височина на място, за да се чете като рампа, а не като плоскост.
    const stepRow = O * 0.078,
      baseMax = O * 0.3;
    secs.forEach(function (sc, k2) {
      const flat = k2.indexOf(".0.") > 0,
        base = flat || g1 <= g0 ? 0 : ((sc.min - g0) / (g1 - g0)) * baseMax,
        rows = [];
      sc.rows.forEach(function (rw) {
        rows.push({ m: rw.d / rw.n, a: rw.a });
      });
      rows.sort(function (a2, b2) {
        return a2.m - b2.m;
      });
      rows.forEach(function (rw, idx) {
        rw.a.forEach(function (t) {
          t.properties.el = flat ? 0 : base + idx * stepRow;
        });
      });
    });
    ((Se2 = function () {
      return !1;
    }),
      (Ne2 = g0),
      (Fe2 = g1));
  }
  // Под всеки ред се подлага тънка лента на неговата височина - иначе
  // вдигнатите трибуни изглеждат като места, увиснали във въздуха.
  function Rb() {
    const src = (l.seats && l.seats.features) || [];
    if (!src.length) return { type: "FeatureCollection", features: [] };
    const rows = new Map();
    src.forEach(function (f) {
      const p = f.properties || {},
        k = p.s + "|" + p.r;
      (rows.has(k) || rows.set(k, []), rows.get(k).push(f));
    });
    const w = (Wn > 0 ? Wn : O) * 0.62,
      out = [];
    rows.forEach(function (a) {
      if (a.length < 2) return;
      let h = 0;
      a.forEach(function (f) {
        h += (f.properties && f.properties.el) || 0;
      });
      h /= a.length;
      if (h < 0.012) return;
      a.sort(function (x, z) {
        return (+x.properties.t || 0) - (+z.properties.t || 0);
      });
      const pts = a.map(function (f) {
          return f.geometry.coordinates;
        }),
        up = [],
        dn = [];
      for (let k = 0; k < pts.length; k++) {
        const b = pts[Math.max(0, k - 1)],
          c = pts[Math.min(pts.length - 1, k + 1)];
        let dx = c[0] - b[0],
          dy = c[1] - b[1];
        const L2 = Math.hypot(dx, dy) || 1;
        ((dx /= L2), (dy /= L2));
        const nx = -dy * w,
          ny = dx * w,
          ex = k === 0 ? -dx * w : k === pts.length - 1 ? dx * w : 0,
          ey = k === 0 ? -dy * w : k === pts.length - 1 ? dy * w : 0;
        (up.push([pts[k][0] + nx + ex, pts[k][1] + ny + ey]), dn.push([pts[k][0] - nx + ex, pts[k][1] - ny + ey]));
      }
      const ring = up.concat(dn.reverse());
      (ring.push(ring[0]),
        out.push({ type: "Feature", properties: { h: h }, geometry: { type: "Polygon", coordinates: [ring] } }));
    });
    return { type: "FeatureCollection", features: out };
  }
  // Предпазен парапет по ръба на всяка вдигната трибуна: там има истинско
  // пропадане към по-долното ниво.
  function Pb() {
    const src = (l.seats && l.seats.features) || [],
      out = [];
    if (!src.length || !Se2) return { type: "FeatureCollection", features: out };
    const low = new Map();
    src.forEach(function (f) {
      const p = f.properties || {},
        e = p.el || 0,
        v = low.get(p.s);
      (!v || e < v.el - 1e-9) && low.set(p.s, { el: e, r: String(p.r) });
    });
    const rows = new Map();
    src.forEach(function (f) {
      const p = f.properties || {},
        v = low.get(p.s);
      v && String(p.r) === v.r && (rows.has(p.s) || rows.set(p.s, []), rows.get(p.s).push(f));
    });
    const u = Wn > 0 ? Wn : O,
      w = u * 0.95,
      ph = u * 0.34,
      pr = u * 0.08,
      step = u * 1.5;
    rows.forEach(function (a, k) {
      const v = low.get(k);
      if (!v || v.el < 0.1 || a.length < 2) return;
      a.sort(function (x, z) {
        return (+x.properties.t || 0) - (+z.properties.t || 0);
      });
      // ръбът е откъм ниското - тоест към центъра на залата
      const line = a.map(function (f) {
        const c = f.geometry.coordinates,
          dx = In[0] - c[0],
          dy = In[1] - c[1],
          d = Math.hypot(dx, dy) || 1;
        return [c[0] + (dx / d) * w, c[1] + (dy / d) * w];
      });
      const pts = [];
      for (let q = 0; q < line.length - 1; q++) {
        const p0 = line[q],
          p1 = line[q + 1],
          len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]),
          n2 = Math.max(1, Math.round(len / step));
        for (let j2 = 0; j2 < n2; j2++)
          pts.push([p0[0] + ((p1[0] - p0[0]) * j2) / n2, p0[1] + ((p1[1] - p0[1]) * j2) / n2]);
      }
      pts.push(line[line.length - 1]);
      pts.forEach(function (p, q) {
        out.push({
          type: "Feature",
          properties: { part: "post", b: v.el, h: v.el + ph },
          geometry: { type: "Polygon", coordinates: Un(p[0], p[1], pr, 6) },
        });
        if (q === pts.length - 1) return;
        const z2 = pts[q + 1],
          dx = z2[0] - p[0],
          dy = z2[1] - p[1],
          L2 = Math.hypot(dx, dy) || 1,
          nx = (-dy / L2) * pr * 0.6,
          ny = (dx / L2) * pr * 0.6;
        out.push({
          type: "Feature",
          properties: { part: "rail", b: v.el + ph * 0.82, h: v.el + ph },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [p[0] + nx, p[1] + ny],
                [z2[0] + nx, z2[1] + ny],
                [z2[0] - nx, z2[1] - ny],
                [p[0] - nx, p[1] - ny],
                [p[0] + nx, p[1] + ny],
              ],
            ],
          },
        });
      });
    });
    return { type: "FeatureCollection", features: out };
  }
  function lt() {
    Wn = Xn();
    zt2();
    const e = Math.min(O * Pe, Wn * 0.36);
    return {
      type: "FeatureCollection",
      features: l.seats.features.map(function (t) {
        const n = t.geometry.coordinates,
          o = Bn(n[0], n[1]),
          // посоката на гърба: там кръгчето се издува и се вижда накъде гледа
          r = Math.atan2(-o[1], -o[0]),
          a = [];
        for (let s = 0; s < Ee; s++) {
          const c = (s / Ee) * Math.PI * 2;
          a.push([n[0] + Math.cos(c) * e, n[1] + Math.sin(c) * e]);
        }
        return (
          a.push(a[0]),
          { type: "Feature", id: t.id, properties: t.properties, geometry: { type: "Polygon", coordinates: [a] } }
        );
      }),
    };
  }
  // Масите в оригинала са квадрати. Тук се рисуват като кръгли маси: крак,
  // падаща покривка, плот, ваза с цвете и две бар столчета. Плотът е в цвета на
  // ценовата категория, за да личи колко струва масата.
  function Un(cx, cy, r, n) {
    const out = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return (out.push(out[0]), [out]);
  }
  // Външният ръб на масата (столчетата) спрямо радиуса на плота.
  const hx = 1.46;
  // Ъгълът на всяко бар столче от посоката „на юг" (към зрителите), в радиани.
  const STOOL_SPREAD = 0.62;
  function Vn() {
    const src = (l.tables && l.tables.features) || [];
    if (!src.length) return { type: "FeatureCollection", features: [] };
    // Стъпката между масите: чертаната маса трябва да се събира в нея с въздух
    // отстрани, иначе столчетата на съседните маси се застъпват.
    let pitch = 1 / 0;
    const step = Math.max(1, Math.ceil(src.length / 400));
    for (let a = 0; a < src.length; a += step) {
      const ca = src[a].geometry.coordinates;
      for (let b = 0; b < src.length; b++) {
        if (b === a) continue;
        const cb = src[b].geometry.coordinates,
          d = Math.hypot(ca[0] - cb[0], ca[1] - cb[1]);
        if (d > 1e-6 && d < pitch) pitch = d;
      }
    }
    // Отстояние до сцената - масите не бива да опират подиума и въжето.
    let stMin = 1 / 0;
    const stR = l.stage && l.stage.geometry && l.stage.geometry.coordinates;
    if (stR && stR[0] && stR[0].length > 2) {
      const ring = stR[0];
      src.forEach(function (f) {
        const p = f.geometry.coordinates;
        for (let k = 0; k < ring.length - 1; k++) {
          const a = ring[k],
            b = ring[k + 1],
            dx = b[0] - a[0],
            dy = b[1] - a[1],
            L2 = dx * dx + dy * dy || 1;
          let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2;
          t = Math.max(0, Math.min(1, t));
          const d = Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dy * t));
          if (d < stMin) stMin = d;
        }
      });
    }
    // Отпечатък: 22% от стъпката остават празни между две съседни маси, а до
    // сцената се пази поне една стъпка на място и нещо.
    let foot = 1 / 0;
    if (isFinite(pitch)) foot = Math.min(foot, pitch * 0.39);
    if (isFinite(stMin)) foot = Math.min(foot, stMin - O * 1.15);
    const H = O * 0.62,
      out = [];
    src.forEach(function (f) {
      const c = f.geometry.coordinates,
        p = f.properties || {},
        r0 = typeof p.radius == "number" && p.radius > 0 ? p.radius : O * 1.2,
        r = isFinite(foot) && foot > 0 ? Math.min(r0, foot / hx) : r0,
        sold = p.sold === !0,
        col = p.color || "#c9a227";
      // Мат черен метал: това са коктейлни маси без покривка и без нищо отгоре.
      // Плотът е ЕДИН плътен диск в цвета на ценовата категория (както преди);
      // продадените са сиви, за да не се бъркат със свободните.
      const METAL = "#2A2F37",
        METAL_DARK = "#1D2128",
        GREY = "#B9C1CC",
        GREY_DARK = "#AEB6C2",
        // Два квадратни бар стола откъм зрителите (сцената е на север, +y): „щъркели" -
        // висока квадратна седалка без възглавница на тънки прави крака и квадратна
        // рамка за краката.
        sq = function (cx, cy, h) {
          return [
            [
              [cx - h, cy - h],
              [cx + h, cy - h],
              [cx + h, cy + h],
              [cx - h, cy + h],
              [cx - h, cy - h],
            ],
          ];
        },
        sqRing = function (cx, cy, ho, hi) {
          return [sq(cx, cy, ho)[0], sq(cx, cy, hi)[0].reverse()];
        },
        part = function (name, poly, base, top, color) {
          out.push({
            type: "Feature",
            properties: { part: name, sold: sold, mk: p.mk, name: p.name, base: base, height: top, color: color },
            geometry: { type: "Polygon", coordinates: poly },
          });
        };
      for (let q = 0; q < TABLE_STOOLS; q++) {
        const ang = -Math.PI / 2 + (q ? 1 : -1) * STOOL_SPREAD,
          sx = c[0] + Math.cos(ang) * r * 1.32,
          sy = c[1] + Math.sin(ang) * r * 1.32,
          // Щъркел: малка седалка високо на дълги тънки крака (седалката е на
          // 0.77-0.80 от височината на масата), с тънка рамка за краката.
          hs = r * 0.15,
          lg = r * 0.02,
          cl = sold ? GREY : METAL;
        [-1, 1].forEach(function (dx) {
          [-1, 1].forEach(function (dy) {
            part("chair", sq(sx + dx * (hs - lg), sy + dy * (hs - lg), lg), 0, H * 0.77, cl);
          });
        });
        part("chair", sqRing(sx, sy, hs - lg, hs - lg * 2.2), H * 0.31, H * 0.33, cl);
        part("chair", sq(sx, sy, hs), H * 0.77, H * 0.8, cl);
      }
      // Маса: ниска основа, тънка колона и плътният цветен плот.
      part("base", Un(c[0], c[1], r * 0.5, 20), 0, H * 0.05, sold ? GREY_DARK : METAL_DARK);
      part("column", Un(c[0], c[1], r * 0.09, 10), H * 0.05, H * 0.86, sold ? GREY_DARK : METAL_DARK);
      part("top", Un(c[0], c[1], r, 28), H * 0.86, H, sold ? Ge : col);
    });
    // Радиусът на хит-зоната: колкото масата, но не по-малко от половин стъпка.
    tp = isFinite(foot) && foot > 0 ? Math.max(foot, isFinite(pitch) ? pitch * 0.42 : foot) : O * 1.1;
    return { type: "FeatureCollection", features: out };
  }
  // Сцената като 3D тяло: подиум с височина два пъти колкото масите, плюс
  // тънък по-светъл ръб отгоре, за да се чете като дъска, а не като блок.
  function eo() {
    const st = l.stage && l.stage.geometry && l.stage.geometry.coordinates;
    if (!st || !st[0] || st[0].length < 3) return { type: "FeatureCollection", features: [] };
    const H = O * 0.62 * 2;
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { part: "deck", base: 0, height: H },
          geometry: { type: "Polygon", coordinates: st },
        },
        {
          type: "Feature",
          properties: { part: "lip", base: H, height: H * 1.06 },
          geometry: { type: "Polygon", coordinates: st },
        },
      ],
    };
  }
  // Червено въже със златни колчета САМО пред сцената и по фланговете - зад нея
  // няма публика, затова задното ребро отпада. Контурът се измества навън по
  // нормалите на ребрата (не радиално), за да не се изкриви буквата "Т" на
  // подиума с пътеката, и остава пред масите на първия ред.
  function Qn() {
    const st = l.stage && l.stage.geometry && l.stage.geometry.coordinates;
    if (!st || !st[0] || st[0].length < 4) return { type: "FeatureCollection", features: [] };
    const ring = st[0].slice(0, -1),
      m = ring.length;
    let cx0 = 0,
      cy0 = 0,
      ar = 0;
    ring.forEach(function (q) {
      ((cx0 += q[0]), (cy0 += q[1]));
    });
    ((cx0 /= m), (cy0 /= m));
    for (let k = 0; k < m; k++) {
      const p = ring[k],
        q = ring[(k + 1) % m];
      ar += p[0] * q[1] - q[0] * p[1];
    }
    // "Напред" = от сцената към центъра на залата. Пази се предната страна и
    // двата фланга; ребрата, чиято нормала гледа назад, отпадат.
    let fx = In[0] - cx0,
      fy = In[1] - cy0;
    const fl = Math.hypot(fx, fy);
    fl > 1e-6 ? ((fx /= fl), (fy /= fl)) : ((fx = 0), (fy = -1));
    const ccw = ar > 0,
      nm = function (p, q) {
        const dx = q[0] - p[0],
          dy = q[1] - p[1],
          L = Math.hypot(dx, dy) || 1;
        return ccw ? [dy / L, -dx / L] : [-dy / L, dx / L];
      },
      off = O * 0.65,
      keep = [];
    for (let k = 0; k < m; k++) {
      const n = nm(ring[k], ring[(k + 1) % m]);
      keep.push(n[0] * fx + n[1] * fy > -0.5);
    }
    if (!keep.some(Boolean)) return { type: "FeatureCollection", features: [] };
    // Групи от съседни запазени ребра (обхождането е циклично).
    const runs = [];
    let s0 = keep.every(Boolean) ? 0 : -1;
    for (let k = 0; k < m && s0 < 0; k++) if (keep[k] && !keep[(k - 1 + m) % m]) s0 = k;
    let cur = [];
    for (let k = 0; k < m; k++) {
      const idx = (s0 + k) % m;
      if (keep[idx]) cur.push(idx);
      else {
        if (cur.length) runs.push(cur);
        cur = [];
      }
    }
    if (cur.length) runs.push(cur);
    const paths = runs.map(function (run) {
      const seg = run.map(function (k) {
          const p = ring[k],
            q = ring[(k + 1) % m],
            n = nm(p, q);
          return [
            [p[0] + n[0] * off, p[1] + n[1] * off],
            [q[0] + n[0] * off, q[1] + n[1] * off],
          ];
        }),
        line = [seg[0][0]];
      for (let j = 0; j < seg.length - 1; j++) {
        const a = seg[j],
          b = seg[j + 1],
          d1 = [a[1][0] - a[0][0], a[1][1] - a[0][1]],
          d2 = [b[1][0] - b[0][0], b[1][1] - b[0][1]],
          den = d1[0] * d2[1] - d1[1] * d2[0];
        if (Math.abs(den) < 1e-9) {
          line.push(a[1]);
          continue;
        }
        const t = ((b[0][0] - a[0][0]) * d2[1] - (b[0][1] - a[0][1]) * d2[0]) / den,
          ip = [a[0][0] + d1[0] * t, a[0][1] + d1[1] * t],
          co = ring[run[j + 1]];
        // При остър ъгъл ъгловата пресечна точка бяга далеч навън - тогава се скосява.
        if (Math.hypot(ip[0] - co[0], ip[1] - co[1]) > off * 2.6) (line.push(a[1]), line.push(b[0]));
        else line.push(ip);
      }
      line.push(seg[seg.length - 1][1]);
      return line;
    });
    const postR = O * 0.13,
      postH = O * 0.9,
      ropeH = O * 0.62,
      ropeT = O * 0.06,
      step = O * 2.6,
      out = [];
    paths.forEach(function (line) {
      const pts = [];
      for (let k = 0; k < line.length - 1; k++) {
        const p0 = line[k],
          p1 = line[k + 1],
          len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]),
          n = Math.max(1, Math.round(len / step));
        for (let j2 = 0; j2 < n; j2++)
          pts.push([p0[0] + ((p1[0] - p0[0]) * j2) / n, p0[1] + ((p1[1] - p0[1]) * j2) / n]);
      }
      pts.push(line[line.length - 1]);
      pts.forEach(function (p, k) {
        (out.push({
          type: "Feature",
          properties: { part: "post", base: 0, height: postH },
          geometry: { type: "Polygon", coordinates: Un(p[0], p[1], postR, 8) },
        }),
          out.push({
            type: "Feature",
            properties: { part: "knob", base: postH, height: postH * 1.18 },
            geometry: { type: "Polygon", coordinates: Un(p[0], p[1], postR * 1.4, 8) },
          }));
        // Въжето свързва само съседни колчета в редицата - не се затваря в кръг.
        const q = pts[k + 1];
        if (!q) return;
        const dx = q[0] - p[0],
          dy = q[1] - p[1],
          L2 = Math.hypot(dx, dy) || 1,
          nx = (-dy / L2) * ropeT,
          ny = (dx / L2) * ropeT;
        out.push({
          type: "Feature",
          properties: { part: "rope", base: ropeH, height: ropeH + ropeT * 2 },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [p[0] + nx, p[1] + ny],
                [q[0] + nx, q[1] + ny],
                [q[0] - nx, q[1] - ny],
                [p[0] - nx, p[1] - ny],
                [p[0] + nx, p[1] + ny],
              ],
            ],
          },
        });
      });
    });
    return { type: "FeatureCollection", features: out };
  }
  function v(e, t) {
    (i.setFeatureState({ source: "seats", id: e }, t),
      i.getSource("seatsPuck") && i.setFeatureState({ source: "seatsPuck", id: e }, t));
  }
  // Прозрачност на ценовите балони: пълни на общ изглед, изчезнали дотогава,
  // когато вече се целят отделни места.
  function Op() {
    return ["step", ["zoom"], 1, C(Qe) + 0.15, 0];
  }
  function ut() {
    return ["interpolate", ["linear"], ["zoom"], me, 1, Y, 0];
  }
  function ft() {
    if (l.meta && typeof l.meta.seatPitch == "number" && l.meta.seatPitch > 0) return l.meta.seatPitch;
    const e = (l.seats && l.seats.features) || [];
    if (e.length < 2) return 0.3;
    const t = Math.max(1, Math.floor(e.length / 250)),
      n = [];
    for (let o = 0; o < e.length; o += t) {
      const r = e[o].geometry.coordinates;
      let a = 1 / 0;
      for (let s = 0; s < e.length; s++) {
        if (s === o) continue;
        const c = e[s].geometry.coordinates,
          u = r[0] - c[0],
          d = r[1] - c[1],
          f = u * u + d * d;
        f < a && (a = f);
      }
      n.push(Math.sqrt(a));
    }
    return (
      n.sort(function (o, r) {
        return o - r;
      }),
      n[Math.floor(n.length / 2)] || 0.3
    );
  }
  // Значка на балона: най-евтиният сектор и секторът с най-добро отношение
  // Значки „Топ избор" и „Най-евтино" няма: това са предложения, а схемата
  // маркира само това, което човекът избере сам. Функцията остава, за да
  // изчиства значки, ако дойдат от данните.
  function bz2() {
    ((l.pins && l.pins.features) || []).forEach(function (f) {
      (delete f.properties.badge, delete f.properties.badgeColor);
    });
  }
  function dt() {
    if (!i || i.hasImage("price-pill")) return;
    // Балонът е бял, само с цветна рамка и мека сянка (Стефан, 05.09: без
    // тъмната рамка отвън). Сянката го държи отделен от бледата схема, а
    // тъмният надпис се чете върху бялото. Рамката носи значката - оранжева
    // за топ избор, зелена за най-евтино - и по едно балонче на ценова
    // категория в нейния цвят: евтиното зелено, скъпото червено. Така цената
    // се чете и когато очите само пробягват по схемата.
    const pi = [
      ["price-pill", "#46587A", 3],
      ["price-pill-top", "#f0902f", 3],
      ["price-pill-cheap", "#28b661", 3],
      // Правостоящите са свой продукт, не ценова категория: синият цвят на
      // марката ги отделя и от зелено-оранжевите места, и от масите.
      ["price-pill-standing", Ae, 3],
    ];
    (((l.tiers && l.tiers.length ? l.tiers : []).forEach(function (tr) {
      tr && tr.color != null && tr.tier != null && pi.push(["price-pill-t" + tr.tier, tr.color, 3]);
    })),
      // Същите балончета и за масите, но в лилавата гама: масата е друг
      // продукт (цяла, за всичките ѝ места), а не по-скъпо място.
      ((l.meta && l.meta.tableLevels) || []).forEach(function (tl) {
        tl && tl.pill != null && tl.level != null && pi.push(["price-pill-m" + tl.level, tl.pill, 3]);
      }),
      pi.forEach(function (v) {
      const nm = v[0],
        col = v[1],
        o = v[2],
        sh = 5,
        e = 76,
        t = 34,
        n = 12,
        r = document.createElement("canvas");
      ((r.width = e), (r.height = t));
      const a = r.getContext("2d");
      a.clearRect(0, 0, e, t);
      const s = sh + o / 2,
        c = sh + o / 2,
        u = e - 2 * sh - o,
        d = t - 2 * sh - o,
        f = Math.min(n, d / 2) - o / 2;
      function pat(x, y, w, h, rd) {
        (a.beginPath(),
          a.moveTo(x + rd, y),
          a.arcTo(x + w, y, x + w, y + h, rd),
          a.arcTo(x + w, y + h, x, y + h, rd),
          a.arcTo(x, y + h, x, y, rd),
          a.arcTo(x, y, x + w, y, rd),
          a.closePath());
      }
      (pat(s, c, u, d, f),
        (a.shadowColor = "rgba(11,27,58,0.25)"),
        (a.shadowBlur = 4),
        (a.shadowOffsetY = 2),
        (a.fillStyle = "#FFFFFF"),
        a.fill(),
        (a.shadowColor = "rgba(0,0,0,0)"),
        (a.shadowBlur = 0),
        (a.shadowOffsetY = 0));
      // Цветният кант е самата рамка и е гланциран: светло горе, чистият
      // цвят по средата, потъмняване долу - като самите хапчета на ценовите
      // категории. Отдолу минава тънка полупрозрачна тъмна линия, за да не се
      // губи жълтото върху бялото на схемата.
      const gx = a.createLinearGradient(0, c, 0, c + d);
      (gx.addColorStop(0, Oe(col, 1.5)),
        gx.addColorStop(0.42, col),
        gx.addColorStop(1, Oe(col, 0.64)),
        pat(s, c, u, d, f),
        (a.lineWidth = o + 1),
        (a.strokeStyle = "rgba(11,27,58,0.22)"),
        a.stroke(),
        (a.lineWidth = o),
        (a.strokeStyle = gx),
        a.stroke());
      const M = a.getImageData(0, 0, e, t);
      i.addImage(
        nm,
        { width: e, height: t, data: M.data },
        {
          pixelRatio: 1,
          // Разтягат се само средните ивици, за да не се деформират ъглите,
          // а сянката остава еднаква по цялата дължина.
          stretchX: [[sh + n, e - sh - n]],
          stretchY: [[Math.round(t / 2) - 1, Math.round(t / 2) + 1]],
          content: [sh + n - 2, sh + o + 2, e - sh - n + 2, t - sh - o - 2],
        },
      );
    }));
  }
  function Re() {
    // „20 €", не „€20": така се пише на български и така стои и в количката.
    const pr = [
      "concat",
      [
        "to-string",
        [
          "round",
          ["coalesce", _ ? ["get", "priceFromAll"] : ["get", "priceFrom"], ["get", "priceFrom"], ["get", "price"], 0],
        ],
      ],
      " €",
    ];
    return [
      "case",
      ["has", "badge"],
      // Значката стои НАД цената: на един ред балонът ставаше два пъти
      // по-дълъг от останалите и се набиваше върху съседните сектори.
      [
        "format",
        ["coalesce", ["get", "badge"], ""],
        { "font-scale": 0.8, "text-color": ["coalesce", ["get", "badgeColor"], "#0B1B3A"] },
        "\n",
        {},
        pr,
        { "font-scale": 1 },
      ],
      ["format", pr, { "font-scale": 1 }],
    ];
  }
  function De() {
    if (!i) return;
    (i.getLayer("pins-bubbles") && i.setLayoutProperty("pins-bubbles", "text-field", Re()),
      i.getLayer("section-number-labels") && i.setLayoutProperty("section-number-labels", "text-field", nl2()),
      i.getLayer("table-price-labels") && i.setLayoutProperty("table-price-labels", "text-field", tl2()),
      i.getLayer("tables-overview") && i.setLayoutProperty("tables-overview", "text-field", mv2()),
      i.getLayer("standing-label") && i.setLayoutProperty("standing-label", "text-field", stl()));
  }
  function pt(e) {
    const t = [];
    if (!e || !e.cols || !e.rows || !Array.isArray(e.colors)) return t;
    const n = (e.x2 - e.x1) / e.cols,
      o = (e.top - e.base) / e.rows;
    for (let r = 0; r < e.rows; r++)
      for (let a = 0; a < e.cols; a++) {
        const s = e.x1 + a * n,
          c = s + n;
        t.push({
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [s, e.y1],
                [c, e.y1],
                [c, e.y2],
                [s, e.y2],
                [s, e.y1],
              ],
            ],
          },
          properties: {
            part: "curtain",
            color: e.colors[r * e.cols + a] || "#888888",
            base: e.base + r * o,
            height: e.base + (r + 1) * o,
          },
        });
      }
    return t;
  }
  function C(e) {
    return Math.log2((e * 360) / (512 * Math.max(1e-6, O)));
  }
  function gt() {
    b ||
      !i ||
      ((b = document.createElement("div")),
      (b.className = "seat-tip"),
      b.setAttribute("aria-hidden", "true"),
      (b.style.display = "none"),
      i.getContainer().appendChild(b));
  }
  function ht(e, t) {
    if ((gt(), !b)) return;
    const n = H.get("s:" + e.s),
      o = (n && n.properties && n.properties.name) || e.s,
      r = _ && e.eurAll != null ? e.eurAll : e.eur,
      a = e.obstructed === !0 || e.obstructed === "true";
    ((b.innerHTML =
      '<div class="seat-tip-sec">' +
      ie(String(o)) +
      '</div><div class="seat-tip-pos">ред ' +
      ie(String(e.r)) +
      " · място " +
      ie(String(e.t)) +
      (a ? ' · <span class="seat-tip-warn">ограничена видимост</span>' : "") +
      "</div>" +
      (r != null ? '<div class="seat-tip-price">' + ie(String(r)) + " €</div>" : "")),
      (b.style.display = "block"));
    const s = i.getContainer().clientWidth,
      c = t.x > s - 180;
    ((b.style.left = (c ? t.x - 14 : t.x + 14) + "px"),
      (b.style.top = t.y - 12 + "px"),
      (b.style.transform = c ? "translate(-100%, -100%)" : "translate(0, -100%)"));
  }
  function mt() {
    b && (b.style.display = "none");
  }
  function ie(e) {
    return e.replace(/[&<>"']/g, function (t) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[t];
    });
  }
  // Етикетът на сектора носи и цената - тя е по-важна от номера. Цените се
  // събират от самите места (един обход), за да излезе и „от", когато секторът
  // има повече от една цена.
  function nz2() {
    if (!l.sectionLabels || !l.sectionLabels.features) return;
    const ce = new Map();
    (((l.sections && l.sections.features) || []).forEach(function (f) {
      const p = f.properties || {};
      p.mk && ce.set(p.mk, p);
    }));
    const mn = new Map();
    (((l.seats && l.seats.features) || []).forEach(function (f) {
      const p = f.properties || {};
      if (p.sold === !0 || p.s == null) return;
      const k2 = "s:" + p.s;
      let z = mn.get(k2);
      (z || ((z = { a: null, b: null, c: null, d: null }), mn.set(k2, z)),
        typeof p.eur == "number" &&
          ((z.a = z.a == null || p.eur < z.a ? p.eur : z.a), (z.b = z.b == null || p.eur > z.b ? p.eur : z.b)),
        typeof p.eurAll == "number" &&
          ((z.c = z.c == null || p.eurAll < z.c ? p.eurAll : z.c),
          (z.d = z.d == null || p.eurAll > z.d ? p.eurAll : z.d)));
    }));
    l.sectionLabels.features.forEach(function (f) {
      const p = f.properties || {},
        sc = ce.get(p.mk) || {},
        z = mn.get(p.mk);
      ((p.offsale = sc.offsale === !0),
        (p.priceFrom = z && z.a != null ? z.a : sc.priceFrom != null ? sc.priceFrom : null),
        (p.priceTo = z && z.b != null ? z.b : p.priceFrom),
        (p.priceFromAll = z && z.c != null ? z.c : sc.priceFromAll != null ? sc.priceFromAll : null),
        (p.priceToAll = z && z.d != null ? z.d : p.priceFromAll));
    });
  }
  // Надписът: номерът дребен отгоре, цената едра отдолу.
  // По ЕДНО балонче на ценова категория, не над всяка маса: 54 числа върху
  // 54 маси не се четат, а цветът и без това вече казва категорията. Точката
  // е масата, най-близка до средата на своята категория - там балончето стои
  // върху маса от същия цвят.
  function Ntl2() {
    const out = [],
      by = new Map();
    ((l.tables && l.tables.features) || []).forEach(function (f) {
      const pr = f.properties || {};
      if (pr.sold === !0 || pr.eur == null) return;
      const k = pr.tableLevel != null ? pr.tableLevel : pr.eur;
      (by.has(k) || by.set(k, []), by.get(k).push(f));
    });
    // Четирите балона се разстилат: всяко следващо се слага на масата от
    // своята категория, най-далеч от вече сложените. Иначе две категории
    // излизаха една върху друга - най-вече на тесен екран.
    const taken = [];
    Array.from(by.keys())
      .sort(function (p1, p2) {
        return (by.get(p1)[0].properties.eur || 0) - (by.get(p2)[0].properties.eur || 0);
      })
      .forEach(function (k) {
        const fs = by.get(k);
        let best = fs[0],
          bd = -1;
        fs.forEach(function (f) {
          const c = f.geometry.coordinates;
          let d = 1 / 0;
          (taken.forEach(function (t) {
            const q = (c[0] - t[0]) * (c[0] - t[0]) + (c[1] - t[1]) * (c[1] - t[1]);
            q < d && (d = q);
          }),
            d > bd && ((bd = d), (best = f)));
        });
        (taken.push(best.geometry.coordinates),
          out.push({
            type: "Feature",
            geometry: { type: "Point", coordinates: best.geometry.coordinates.slice() },
            properties: {
              eur: best.properties.eur,
              eurAll: best.properties.eurAll,
              seats: tableSeatsOf(best.properties),
              tableLevel: best.properties.tableLevel,
            },
          }));
      });
    return { type: "FeatureCollection", features: out };
  }
  // Една точка в средата на блока с най-евтината маса: това е, което се вижда
  // от общия план.
  // Нула при „по-малко движение": системната настройка изключва преливите.
  function Ux2(ms) {
    return typeof matchMedia == "function" && matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : ms;
  }
  function Mz2() {
    const src = ((l.tables && l.tables.features) || []).filter(function (f) {
      return (f.properties || {}).sold !== !0 && (f.properties || {}).eur != null;
    });
    if (!src.length) return { type: "FeatureCollection", features: [] };
    let sx = 0,
      sy = 0,
      ev = null;
    (src.forEach(function (f) {
      ((sx += f.geometry.coordinates[0]), (sy += f.geometry.coordinates[1]));
      (!ev || f.properties.eur < ev.eur) && (ev = f.properties);
    }),
      (sx /= src.length),
      (sy /= src.length));
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [sx, sy] },
          properties: { eur: ev.eur, eurAll: ev.eurAll, seats: tableSeatsOf(ev), tableLevel: ev.tableLevel },
        },
      ],
    };
  }
  function mv2() {
    const c = _ ? ["get", "eurAll"] : ["get", "eur"];
    return [
      "format",
      "Маси, " + tableSeatsAll() + " места",
      { "font-scale": 0.78, "text-color": "#6B5A93" },
      "\n",
      {},
      ["concat", "от ", ["to-string", ["round", ["coalesce", c, 0]]], " €"],
      { "font-scale": 1 },
    ];
  }
  // Кой от двата слоя говори: в блока - всяка маса, иначе - общият балон.
  // По мащаб само като втори път: ръчното приближаване също трябва да работи.
  function Tv2() {
    if (!i || !i.getLayer("tables-overview")) return;
    const vs = Bz2 || i.getZoom() >= C(Qe) + 0.15;
    (i.setLayoutProperty("tables-overview", "visibility", vs ? "none" : "visible"),
      i.getLayer("table-price-labels") &&
        i.setLayoutProperty("table-price-labels", "visibility", vs ? "visible" : "none"));
  }
  // Надписът на масата казва това, което човек ще купи: цялата маса, с
  // всичките ѝ места. Цената на едно място стои в легендата, тук би подвела - масата не
  // се дели.
  function tl2() {
    const c = _ ? ["get", "eurAll"] : ["get", "eur"];
    return [
      "format",
      ["concat", ["to-string", ["coalesce", ["get", "seats"], TABLE_SEATS_FALLBACK]], " места"],
      { "font-scale": 0.78, "text-color": "#6B5A93" },
      "\n",
      {},
      ["concat", ["to-string", ["round", ["coalesce", c, 0]]], " €"],
      { "font-scale": 1 },
    ];
  }
  // Балонът на зоната за правостоящи: името дребно отгоре, цената едра отдолу -
  // същият вид като „Маси, 6 места / от 900 €".
  function stl() {
    const c = _ ? ["get", "eurAll"] : ["get", "eur"];
    return [
      "format",
      "Правостоящи",
      { "font-scale": 0.78, "text-color": "#153D8A" },
      "\n",
      {},
      ["concat", ["to-string", ["round", ["coalesce", c, 0]]], " €"],
      { "font-scale": 1 },
    ];
  }
  // Една точка в средата на зоната, където стои балонът.
  function stPin() {
    const f = ((l.standing && l.standing.features) || [])[0];
    if (!f) return { type: "FeatureCollection", features: [] };
    const xs = [],
      ys = [];
    f.geometry.coordinates[0].forEach(function (pt) {
      xs.push(pt[0]);
      ys.push(pt[1]);
    });
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [(Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2, (Math.min.apply(null, ys) + Math.max.apply(null, ys)) / 2],
          },
          properties: { eur: f.properties.eur, eurAll: f.properties.eurAll },
        },
      ],
    };
  }
  // Леко щриховане върху зоната: показва, че е площ за стоене, не място, и се
  // отличава от плоските цветове на ценовите категории, без да е шумно.
  function stHatch() {
    if (!i || i.hasImage("standing-hatch")) return;
    const sz = 14,
      cv = document.createElement("canvas");
    ((cv.width = sz), (cv.height = sz));
    const cx = cv.getContext("2d");
    ((cx.strokeStyle = "rgba(21,61,138,0.30)"), (cx.lineWidth = 1.4), cx.beginPath());
    // Три отсечки, за да се слеят плочките без шев по ъглите.
    [-sz, 0, sz].forEach(function (o) {
      (cx.moveTo(o, sz), cx.lineTo(o + sz, 0));
    });
    cx.stroke();
    i.addImage("standing-hatch", { width: sz, height: sz, data: cx.getImageData(0, 0, sz, sz).data }, { pixelRatio: 2 });
  }
  // Състояние на зоната: избрана и под мишката.
  let stSelected = !1,
    stHovered = null;
  function stSet(on) {
    ((stSelected = !!on),
      i && i.getSource("standing") && i.setFeatureState({ source: "standing", id: "z:Standing" }, { selected: stSelected }));
  }
  function stHover(pt) {
    if (!i || !i.getLayer("standing-fill")) return !1;
    const f = i.queryRenderedFeatures(pt, { layers: ["standing-fill"] }),
      mk = f && f.length ? f[0].properties.mk : null;
    if (mk !== stHovered) {
      (stHovered && i.setFeatureState({ source: "standing", id: stHovered }, { hover: !1 }),
        mk && i.setFeatureState({ source: "standing", id: mk }, { hover: !0 }),
        (stHovered = mk));
    }
    return !!mk;
  }
  // Камерата отива при зоната (от легендата). Наклонът се изправя, за да се
  // види цялото поле, а не само ръбът му.
  function stFrame() {
    const f = l.standing && l.standing.features && l.standing.features[0];
    if (!i || !f) return;
    const xs = f.geometry.coordinates[0].map(function (pt) { return pt[0]; }),
      ys = f.geometry.coordinates[0].map(function (pt) { return pt[1]; });
    i.fitBounds(
      [
        [Math.min.apply(null, xs), Math.min.apply(null, ys)],
        [Math.max.apply(null, xs), Math.max.apply(null, ys)],
      ],
      { padding: { top: 70, bottom: A ? 170 : 110, left: 30, right: 30 + panelPad() }, pitch: 0, bearing: 0, duration: rmo() ? 0 : 900, essential: !0 },
    );
  }
  function stLayers() {
    if (!l.standing || !l.standing.features || !l.standing.features.length) return;
    const sel = ["boolean", ["feature-state", "selected"], !1],
      hov = ["boolean", ["feature-state", "hover"], !1],
      off = ["any", ["==", ["get", "sold"], !0], ["==", ["get", "offsale"], !0]];
    (i.addSource("standing", { type: "geojson", data: l.standing, promoteId: "mk" }),
      i.addSource("standingPin", { type: "geojson", data: stPin() }),
      stHatch(),
      dt());
    // Под всичко останало: зоната е плосък под между масите и FOH. Слоят е
    // fill, а не fill-extrusion - само той се хваща от queryRenderedFeatures.
    i.addLayer({
      id: "standing-fill",
      type: "fill",
      source: "standing",
      paint: {
        "fill-color": ["case", off, "#E3E7EE", sel, "#A9C4EC", hov, "#C9DBF4", "#DCE8F8"],
        "fill-color-transition": { duration: Ux2(160), delay: 0 },
        "fill-opacity": 1,
      },
    });
    i.addLayer({
      id: "standing-hatch",
      type: "fill",
      source: "standing",
      paint: { "fill-pattern": "standing-hatch", "fill-opacity": ["case", off, 0, sel, 0.9, 0.7] },
    });
    i.addLayer({
      id: "standing-line",
      type: "line",
      source: "standing",
      paint: { "line-color": ["case", off, "#AEB6C2", Ae], "line-width": 1.6, "line-dasharray": [3, 2] },
    });
    // Избрана: плътен по-дебел кант върху пунктира.
    i.addLayer({
      id: "standing-line-sel",
      type: "line",
      source: "standing",
      paint: { "line-color": Ae, "line-width": 3, "line-opacity": ["case", sel, 1, 0] },
    });
    i.addLayer({
      id: "standing-label",
      type: "symbol",
      source: "standingPin",
      layout: {
        "icon-image": "price-pill-standing",
        "icon-text-fit": "both",
        "icon-text-fit-padding": [2, 5, 2, 5],
        "text-field": stl(),
        "text-font": K,
        "text-size": ["interpolate", ["linear"], ["zoom"], C(Qe) - 2.2, 10, C(Qe) + 0.6, 12],
        "text-anchor": "center",
        "text-justify": "center",
        "text-line-height": 1.15,
        "icon-allow-overlap": !0,
        "text-allow-overlap": !0,
      },
      paint: { "text-color": "#0B1B3A" },
    });
    stSelected && stSet(!0);
  }
  function nl2() {
    const ot = _ ? ["get", "priceFromAll"] : ["get", "priceFrom"],
      dk = _ ? ["get", "priceToAll"] : ["get", "priceTo"],
      cena = [
        "concat",
        ["case", ["==", ["coalesce", ot, -1], ["coalesce", dk, -1]], "", "от "],
        ["to-string", ["round", ["coalesce", ot, 0]]],
        " €",
      ];
    return [
      "format",
      ["get", "label"],
      { "font-scale": 0.82, "text-color": "#46587A" },
      "\n",
      {},
      ["case", ["==", ["get", "offsale"], !0], "не се продава", ["==", ["coalesce", ot, -1], -1], "", cena],
      { "font-scale": 1 },
    ];
  }
  function yt() {
    (nz2(),
      i.addSource("sections", { type: "geojson", data: l.sections }),
      l.sectionLabels && i.addSource("sectionLabels", { type: "geojson", data: l.sectionLabels }),
      l.objectLabels && i.addSource("objectLabels", { type: "geojson", data: l.objectLabels }),
      l.pins && i.addSource("pins", { type: "geojson", data: l.pins }));
    const e = l.court || {};
    let t = l.stage3d && l.stage3d.features && l.stage3d.features.length ? l.stage3d : null;
    (t && l.curtain && (t = { type: "FeatureCollection", features: t.features.concat(pt(l.curtain)) }),
      t && i.addSource("stage3d", { type: "geojson", data: t }),
      e.apron && i.addSource("courtApron", { type: "geojson", data: e.apron }),
      e.floor && !t && i.addSource("courtFloor", { type: "geojson", data: e.floor }),
      e.paint && i.addSource("courtPaint", { type: "geojson", data: e.paint }),
      e.lines && !t && i.addSource("courtLines", { type: "geojson", data: e.lines }),
      l.rowLabels &&
        l.rowLabels.features &&
        l.rowLabels.features.length &&
        i.addSource("rowLabels", { type: "geojson", data: l.rowLabels }),
      g &&
        (i.addSource("seats", { type: "geojson", data: l.seats, promoteId: "mk" }),
        i.addSource("seatsPuck", { type: "geojson", data: lt(), promoteId: "mk", tolerance: 0 }),
        (function () {
          const rb = Rb();
          rb.features.length && i.addSource("tierDeck", { type: "geojson", data: rb });
          const pb = Pb();
          pb.features.length && i.addSource("railings", { type: "geojson", data: pb });
          const bz = Bz();
          bz && i.addSource("tablesZone", { type: "geojson", data: bz });
        })()));
    const n = ct(),
      o = ut();
    if (
      (e.apron &&
        i.addLayer({
          id: "court-apron",
          type: "fill",
          source: "courtApron",
          paint: { "fill-color": "#D9DFE8", "fill-opacity": 1 },
        }),
      e.floor &&
        !t &&
        i.addLayer({
          id: "court-floor",
          type: "fill",
          source: "courtFloor",
          paint: { "fill-color": "#dcb98a", "fill-opacity": 1 },
        }),
      e.paint &&
        i.addLayer({
          id: "court-paint",
          type: "fill",
          source: "courtPaint",
          paint: { "fill-color": "#1a1f71", "fill-opacity": 1 },
        }),
      e.lines && !t)
    ) {
      const r = [
          "match",
          ["get", "kind"],
          "boundary",
          "#14186f",
          "key",
          "#14186f",
          "three-pt",
          "#14186f",
          "division",
          "#e5622a",
          "center-circle",
          "#e5622a",
          "center-circle-inner",
          "#e5622a",
          "ft-circle",
          "#e5622a",
          "restricted",
          "#e5622a",
          "backboard",
          "#ffffff",
          "#ffffff",
        ],
        a = ["==", ["get", "kind"], "boundary"],
        s = ["interpolate", ["linear"], ["zoom"], x.zoom, ["case", a, 1.2, 0.7], Y, ["case", a, 2.7, 2.2]];
      i.addLayer({
        id: "court-lines",
        type: "line",
        source: "courtLines",
        paint: { "line-color": r, "line-width": s },
      });
    }
    stLayers();
    if (
      (i.addLayer({
        id: "sections-fill",
        type: "fill",
        source: "sections",
        paint: { "fill-color": n, "fill-opacity": 0 },
      }),
      i.addLayer({
        id: "sections-line",
        type: "line",
        source: "sections",
        paint: { "line-color": "#c9cdd6", "line-width": 1, "line-opacity": 0 },
      }),
      t &&
        i.addLayer({
          id: "stage-3d",
          type: "fill-extrusion",
          source: "stage3d",
          paint: {
            "fill-extrusion-color": ["get", "color"],
            "fill-extrusion-base": ["*", ["coalesce", ["get", "base"], 0], ue],
            "fill-extrusion-height": ["*", ["coalesce", ["get", "height"], 0], ue],
            "fill-extrusion-opacity": 1,
            "fill-extrusion-vertical-gradient": !0,
          },
        }),
      g)
    ) {
      const r = Se(["get", "tier"]),
        a = Se(["get", "tier"], function (L) {
          return Oe(L, 0.78);
        }),
        s = Se(["get", "tier"], function (L) {
          return Oe(L, 0.88);
        }),
        u = ["boolean", ["feature-state", "selected"], !1],
        d = ["boolean", ["feature-state", "hover"], !1],
        // Предложения няма - на картата свети само това, което човекът е
        // натиснал сам.
        M = [
          "case",
          u,
          Ae,
          ["boolean", ["get", "sold"], !1],
          Ge,
          d,
          a,
          ["boolean", ["feature-state", "hl"], !1],
          s,
          r,
        ],
        I = O * $e * ue,
        // Избраното място НЕ се вдига: двойната височина го откъсваше от реда
        // и то увисваше във въздуха. Личи си по цвета, не по височината.
        // Мишката вдига само едва-едва, колкото да усетиш кое сочиш.
        p = ["*", ["case", d, 1.25, 1], I],
        // Изразът със зум ТРЯБВА да е най-отгоре - вложен вътре в умножение
        // MapLibre го отхвърля и целият слой спира да се рисува.
        // Compress vertical scale only in the overview, keeping seats selectable.
        // The dedicated seat view uses full estimated elevations.
        Ez = function (k2) {
          return ["*", ["coalesce", ["get", "el"], 0], ue * k2 * 0.18];
        },
        El2 = ["interpolate", ["linear"], ["zoom"], 5, Ez(1), 6.4, Ez(1)],
        Eh = ["interpolate", ["linear"], ["zoom"], 5, ["+", Ez(1), p], 6.4, ["+", Ez(1), p]];
      Mc = M;
      i.addLayer({
        id: "seats-3d",
        type: "fill-extrusion",
        source: "seatsPuck",
        paint: {
          "fill-extrusion-color": M,
          // Смяната на препоръката ставаше в един кадър: старите места
          // отскачаха към цвета на категорията, новите пламваха в синьо и
          // окото не хващаше кое се е сменило - приличаше на трепване, не на
          // отговор. Прелив от една трета от секундата го прави четимо.
          "fill-extrusion-color-transition": { duration: Ux2(340), delay: 0 },
          "fill-extrusion-base": El2,
          "fill-extrusion-height": Eh,
          "fill-extrusion-opacity": 1,
          "fill-extrusion-vertical-gradient": !0,
        },
      });
    }
    if (
      (i.getSource("rowLabels") &&
        i.addLayer({
          id: "row-labels",
          type: "symbol",
          source: "rowLabels",
          minzoom: C(12),
          filter: ["==", ["get", "side"], "L"],
          layout: {
            "text-field": ["get", "label"],
            "text-font": K,
            "text-size": ["interpolate", ["linear"], ["zoom"], C(28), 9, C(60), 12],
            "text-allow-overlap": !0,
            "text-ignore-placement": !0,
            "text-pitch-alignment": "map",
            "text-rotation-alignment": "viewport",
          },
          paint: {
            "text-color": "#46587A",
            "text-halo-color": "#ffffff",
            "text-halo-width": 1.2,
            // Натиснеш ли сектор, камерата спира около C(20). Старият праг
            // (C(28)) палеше номерата чак след това - човек стоеше в сектора
            // без нито един номер на ред пред очите си.
            "text-opacity": ["interpolate", ["linear"], ["zoom"], C(19), 0, C(25), 1],
          },
        }),
      l.sectionLabels &&
        i.addLayer({
          id: "section-number-labels",
          type: "symbol",
          source: "sectionLabels",
          // Отдалеч цените са в балончетата, отблизо - в този надпис. Границата
          // е една и съща и слоевете са СКРИТИ един за друг, а не само
          // прозрачни: невидим надпис пак заема място в схемата за сблъсъци и
          // изяждаше балончетата - отдалеч не оставаше нито една цена.
          minzoom: C(Qe) + 0.15,
          layout: {
            "text-field": nl2(),
            "text-font": K,
            "text-size": 12,
            "text-line-height": 1.15,
            // Отдалеч цените са в балончетата - тогава този надпис мълчи, за да
            // не им отнема мястото и повече сектори да показват цена. Отблизо
            // балончетата гаснат и надписът поема: номер и под него цената.
            "text-anchor": "top",
            "text-offset": [0, 0.35],
            "text-allow-overlap": !1,
            "text-padding": 1,
          },
          paint: {
            "text-color": "#0B1B3A",
            "text-halo-color": "#ffffff",
            "text-halo-width": 1.4,
          },
        }),
      l.objectLabels &&
        i.addLayer({
          id: "object-labels",
          type: "symbol",
          source: "objectLabels",
          layout: {
            "text-field": ["get", "label"],
            "text-font": K,
            "text-size": 14,
            "text-letter-spacing": 0.05,
            "text-allow-overlap": !1,
          },
          paint: { "text-color": "#0B1B3A", "text-halo-color": "#ffffff", "text-halo-width": 1.8 },
        }),
      l.pins &&
        (bz2(),
        i.getSource("pins") && i.getSource("pins").setData(l.pins),
        dt(),
        i.addLayer({
          id: "pins-bubbles",
          type: "symbol",
          source: "pins",
          maxzoom: C(Qe) + 0.15,
          layout: {
            "icon-image": [
              "case",
              ["==", ["get", "badge"], "Топ избор"],
              "price-pill-top",
              ["==", ["get", "badge"], "Най-евтино"],
              "price-pill-cheap",
              ["has", "tier"],
              ["concat", "price-pill-t", ["to-string", ["get", "tier"]]],
              "price-pill",
            ],
            "icon-text-fit": "both",
            "icon-text-fit-padding": [2, 5, 2, 5],
            "text-field": Re(),
            "text-font": K,
            // Отдалеч балончето е дребно, за да се съберат цените на повече
            // сектори: там те са единственото, което се чете.
            "text-size": ["interpolate", ["linear"], ["zoom"], C(Qe) - 2.2, 9.5, C(Qe) + 0.15, 11],
            // Балонът се оразмерява по текста; изместването и долната котва
            // изкарваха надписа извън бялото, а на два реда режеха значката.
            "text-anchor": "center",
            "text-justify": "center",
            "text-max-width": 12,
            "text-line-height": 1.15,

            "icon-allow-overlap": !1,
            "text-allow-overlap": !1,
            "text-padding": 0,
            "symbol-sort-key": ["case", ["has", "badge"], -1, ["get", "priceFrom"]],
          },
          paint: { "text-color": "#0B1B3A", "icon-opacity": Op(), "text-opacity": Op() },
        })),
      g)
    ) {
      // Синият пръстен около избраното място отпадна. Кръгът лежи плоско на
      // пода, а мястото стърчи над него: на наклонена схема двете се
      // разминаваха и изглеждаше, че избраното виси във въздуха над чуждо
      // синьо кръгче. Избраното си личи по тъмносиньото капаче.
      if (l.tables && l.tables.features && l.tables.features.length) {
        i.addSource("tables", { type: "geojson", data: Vn(), promoteId: "mk" });
        i.addLayer({
          id: "tables-3d",
          type: "fill-extrusion",
          source: "tables",
          paint: {
            "fill-extrusion-color": [
              "case",
              ["boolean", ["feature-state", "selected"], !1],
              // Избраната маса: плотът става син, металът остава черен - личи
              // отгоре, без да се губи видът на масата.
              ["match", ["get", "part"], "top", Ae, ["coalesce", ["get", "color"], "#c9a227"]],
              ["coalesce", ["get", "color"], "#c9a227"],
            ],
            // Същият прелив и при масите: „Друга маса" сменя две наведнъж.
            "fill-extrusion-color-transition": { duration: Ux2(340), delay: 0 },
            "fill-extrusion-base": ["*", ["get", "base"], ue],
            "fill-extrusion-height": ["*", ["get", "height"], ue],
            "fill-extrusion-opacity": 1,
            "fill-extrusion-vertical-gradient": !0,
          },
        });
      }
      if (l.stage) {
        const stg = eo();
        if (stg.features.length) {
          i.addSource("stagePlatform", { type: "geojson", data: stg });
          i.addLayer({
            id: "stage-platform",
            type: "fill-extrusion",
            source: "stagePlatform",
            paint: {
              "fill-extrusion-color": ["match", ["get", "part"], "lip", "#8A97AD", "#5C6B86"],
              "fill-extrusion-base": ["*", ["get", "base"], ue],
              "fill-extrusion-height": ["*", ["get", "height"], ue],
              "fill-extrusion-opacity": 1,
              "fill-extrusion-vertical-gradient": !0,
            },
          });
        }
        const bar = Qn();
        if (bar.features.length) {
          i.addSource("barrier", { type: "geojson", data: bar });
          i.addLayer({
            id: "barrier-3d",
            type: "fill-extrusion",
            source: "barrier",
            paint: {
              "fill-extrusion-color": [
                "match",
                ["get", "part"],
                "post",
                "#c9a227",
                "knob",
                "#e8c75a",
                "rope",
                "#b3172b",
                "#c9a227",
              ],
              "fill-extrusion-base": ["*", ["get", "base"], ue],
              "fill-extrusion-height": ["*", ["get", "height"], ue],
              "fill-extrusion-opacity": 1,
              "fill-extrusion-vertical-gradient": !0,
            },
          });
        }
      }
      if (l.tables && l.tables.features && l.tables.features.length) {
        // хит-тестът ползва точките на масите; circle слой върху полигон
        // рисува кръг на всеки връх, не в центъра
        i.addSource("tablePoints", { type: "geojson", data: l.tables, promoteId: "mk" });
        i.getSource("tablesZone") &&
          i.addLayer({
            id: "tables-zone",
            type: "fill",
            source: "tablesZone",
            paint: { "fill-color": "rgba(0,0,0,0)", "fill-opacity": 0.001 },
          });
        const tr = tp > 0 ? tp : O * 1.1,
          th = function (zz) {
            return (tr / 360) * 512 * Math.pow(2, zz);
          };
        // Отдалеч блокът с маси говори с ЕДИН балон - „от 2040 €" - както
        // секторите. Отблизо всяка маса казва своята цена. Дотук трябваше да
        // натиснеш маса, за да разбереш какво купуваш.
        (i.addSource("tablesPin", { type: "geojson", data: Mz2() }),
          i.addSource("tableTiers", { type: "geojson", data: Ntl2() }),
          dt(),
          i.addLayer({
            id: "tables-overview",
            type: "symbol",
            source: "tablesPin",
            layout: {
              "icon-image": ["concat", "price-pill-m", ["to-string", ["coalesce", ["get", "tableLevel"], 0]]],
              "icon-text-fit": "both",
              "icon-text-fit-padding": [2, 5, 2, 5],
              "text-field": mv2(),
              "text-font": K,
              "text-size": 10.5,
              "text-anchor": "center",
              "text-justify": "center",
              "text-line-height": 1.15,
              "icon-allow-overlap": !0,
              "text-allow-overlap": !0,
            },
            paint: { "text-color": "#0B1B3A" },
          }),
          i.addLayer({
            id: "table-price-labels",
            type: "symbol",
            source: "tableTiers",
            layout: {
              "icon-image": ["concat", "price-pill-m", ["to-string", ["coalesce", ["get", "tableLevel"], 0]]],
              "icon-text-fit": "both",
              "icon-text-fit-padding": [2, 5, 2, 5],
              "text-field": tl2(),
              "text-font": K,
              "text-size": ["interpolate", ["linear"], ["zoom"], C(Qe) - 2.2, 9.5, C(Qe) + 0.6, 11.5],
              "text-anchor": "center",
              "text-justify": "center",
              "text-line-height": 1.15,
              // Четирите трябва да се виждат ВСИЧКИ: това е легендата на
              // масите. Със сблъсъци две от тях изчезваха под надписите на
              // секторите и оставаха две категории от четири.
              "icon-allow-overlap": !0,
              "text-allow-overlap": !0,
              "text-padding": 0,
              "symbol-sort-key": ["coalesce", ["get", "eur"], 0],
            },
            paint: { "text-color": "#0B1B3A" },
          }),
          Tv2());
        i.addLayer({
          id: "tables-hit",
          type: "circle",
          source: "tablePoints",
          filter: ["!=", ["get", "sold"], !0],
          paint: {
            "circle-radius": ["interpolate", ["exponential", 2], ["zoom"], 2, th(2), 10, th(10)],
            "circle-color": "rgba(0,0,0,0)",
            "circle-stroke-width": 0,
            "circle-pitch-alignment": "map",
            "circle-pitch-scale": "map",
          },
        });
      }
      const Yn = function (Zn) {
        return (((Wn > 0 ? Wn : O) * 0.42) / 360) * 512 * Math.pow(2, Zn);
      };
      i.getSource("tierDeck") &&
        i.addLayer({
          id: "tier-deck",
          type: "fill-extrusion",
          source: "tierDeck",
          paint: {
            // Платформата е малко по-тъмна от пода, за да отделя реда, без
            // да блести и без да се слива с бледия под.
            "fill-extrusion-color": "#C9D1DC",
            "fill-extrusion-base": 0,
            "fill-extrusion-height": [
              "interpolate",
              ["linear"],
              ["zoom"],
              5,
              ["*", ["get", "h"], ue * 0.18],
              6.4,
              ["*", ["get", "h"], ue * 0.18],
            ],
            "fill-extrusion-opacity": 1,
            "fill-extrusion-vertical-gradient": !0,
          },
        });
      i.getSource("railings") &&
        i.addLayer({
          id: "railings-3d",
          type: "fill-extrusion",
          source: "railings",
          paint: {
            "fill-extrusion-color": ["match", ["get", "part"], "rail", "#9AA5B5", "#8A95A5"],
            "fill-extrusion-base": ["*", ["get", "b"], ue * 0.18],
            "fill-extrusion-height": ["*", ["get", "h"], ue * 0.18],
            "fill-extrusion-opacity": 1,
            "fill-extrusion-vertical-gradient": !0,
          },
        });
      i.addLayer(
        {
          id: "seats-shadow",
          type: "circle",
          source: "seats",
          paint: {
            "circle-radius": ["interpolate", ["exponential", 2], ["zoom"], 2, Yn(2), 10, Yn(10)],
            "circle-color": "#0B1B3A",
            "circle-opacity": ["case", [">", ["coalesce", ["get", "el"], 0], 0.015], 0.12, 0.28],
            "circle-blur": 0.55,
            "circle-translate": [1.5, 2.5],
            "circle-pitch-alignment": "map",
            "circle-pitch-scale": "map",
          },
        },
        "seats-3d",
      );
    }
    // Надписите и ценовите балони излизат най-отгоре. Слоевете, добавени след
    // тях (маси, рампи, сенки на местата), се рисуваха ВЪРХУ балона - местата
    // прозираха през него и точно затова изглеждаше слят със схемата.
    ["row-labels", "section-number-labels", "object-labels", "pins-bubbles", "standing-label"].forEach(function (nm) {
      i.getLayer(nm) && i.moveLayer(nm);
    });
  }
  // Свободно ли е мястото според текущите филтри - същите условия като на
  // кликаемия слой, но в код, защото хит-тестът вече минава по 3D телата.
  function av2(e) {
    if (!e || e.sold === !0) return !1;
    if (w && w.indexOf(e.tier) === -1) return !1;
    if (T) {
      const t = _ ? e.eurAll : e.eur;
      if (t == null) return !1;
      if ((T.min != null && t < T.min) || (T.max != null && t > T.max)) return !1;
    }
    return !(ge && e.obstructed === !0);
  }
  // Хит-тестът е по самите 3D тела, а не по кръгчета на пода: местата на
  // трибуните са вдигнати и кръгът остава под тях - човек цели видяното място,
  // а попада на друго един етаж по-надолу.
  // Продадено място под пръста: изгледът не се нулира, човекът просто е
  // уцелил заето място.
  function sd2(e) {
    if (!i.getLayer("seats-3d")) return !1;
    const d = A ? 12 : 4,
      q =
        i.queryRenderedFeatures(
          [
            [e.x - d, e.y - d],
            [e.x + d, e.y + d],
          ],
          { layers: ["seats-3d"] },
        ) || [];
    return q.some(function (f) {
      return f.properties && f.properties.sold === !0;
    });
  }
  function Rl(e) {
    if (!g || !i.getLayer("seats-3d")) return null;
    const fl = function (r) {
      return (r || []).filter(function (n) {
        return av2(n.properties);
      });
    };
    const tochno = i.queryRenderedFeatures(e, { layers: ["seats-3d"] });
    let t = fl(tochno);
    // На телефон пръстът е широк: ако допирът е паднал в празното между
    // местата, се пробва малък квадрат около него, вместо човек да цели по
    // пиксел. Но когато допирът е точно върху място, което не се продава,
    // разширяването се пропуска: иначе човек цели заетото място, а в
    // количката влиза съседът един ред назад.
    if (!t.length && !tochno.length && A && e && e.x != null) {
      const d = 10;
      t = fl(
        i.queryRenderedFeatures(
          [
            [e.x - d, e.y - d],
            [e.x + d, e.y + d],
          ],
          { layers: ["seats-3d"] },
        ),
      );
    }
    // Първото върнато е най-отпред по лъча на погледа - точно това, което
    // човек вижда под курсора.
    return t.length ? t[0] : null;
  }
  // Подсказките на бутоните за зум са на български.
  function Nz() {
    const e = i.getContainer(),
      a = e.querySelector(".maplibregl-ctrl-zoom-in"),
      b2 = e.querySelector(".maplibregl-ctrl-zoom-out");
    (a && ((a.title = "Приближете"), a.setAttribute("aria-label", "Приближете")),
      b2 && ((b2.title = "Отдалечете"), b2.setAttribute("aria-label", "Отдалечете")));
  }
  function bt() {
    const e = m ? m.zoom - 0.05 : 1 / 0;
    return Math.max(C(Qe), Math.min(x.zoom + it, e));
  }
  // Полетът минава през ниски мащаби и слушателят на zoom гаси флага по пътя.
  // Затова той се вдига пак, щом камерата спре.
  function vt2() {
    Zn2 = !0;
  }
  function Ne() {
    // Zn2: вече сме "вътре" в сектор или в блока с масите - тогава допирът
    // избира място, дори мащабът да е малко под общия праг. Иначе на телефон
    // вторият допир само пре-отваряше сектора.
    return Zn2 || i.getZoom() >= bt();
  }
  function xt() {
    (i.on("mousemove", "sections-fill", function (n) {
      if (!n.features || !n.features.length) return;
      const o = n.features[0].properties.mk;
      (o !== fe && ((fe = o), ye(o)), (i.getCanvas().style.cursor = "pointer"));
    }),
      i.on("mouseleave", "sections-fill", function () {
        ((fe = null), (i.getCanvas().style.cursor = ""), ye(null));
      }));
    function e() {
      (F != null && v(F, { hover: !1 }), (F = null), mt(), xe(null));
    }
    (i.getCanvas().addEventListener(
      "touchstart",
      function () {
        e();
      },
      { passive: !0 },
    ),
      g &&
        (i.on("mousemove", function (n) {
          // Заявката по 3D телата е скъпа (около 10 ms): смята се най-много
          // веднъж на кадър, вместо на всяко движение на мишката.
          ((Qt2 = n), Kq2 || (Kq2 = requestAnimationFrame(Xq2)));
        }),
        i.on("mouseout", function () {
          (e(), stHover([-1e5, -1e5]), (i.getCanvas().style.cursor = ""));
        })),
      (Xq2 = function () {
        Kq2 = 0;
        const n = Qt2;
        if (!n) return;
        {
          const o = Rl(n.point),
            sh = stHover(n.point);
          if (!o) {
            (F != null && e(), (i.getCanvas().style.cursor = sh ? "pointer" : ""));
            return;
          }
          if (((i.getCanvas().style.cursor = "pointer"), !Ne())) {
            F != null && e();
            return;
          }
          const r = o.properties.mk;
          (r !== F && (F != null && v(F, { hover: !1 }), (F = r), v(r, { hover: !0 }), xe(r)),
            ht(o.properties, n.point));
        }
      }),
      i.on("click", function (n) {
        const hs = Rl(n.point);
        // Продаденото място отпада още в хит-теста, тоест натискането му
        // потъваше без следа - човек го чука пак и пак. Тук се хваща отделно,
        // за да може приложението да каже, че е заето. Скритите от филтъра
        // места нарочно не влизат тук: за тях говорят самите филтри.
        if (!hs && Ne() && i.getLayer("seats-3d")) {
          const sq = (i.queryRenderedFeatures(n.point, { layers: ["seats-3d"] }) || []).filter(function (f) {
            return (f.properties || {}).sold === !0 && (f.properties || {}).mk;
          });
          if (sq.length) {
            ze(sq[0].properties.mk);
            return;
          }
        }
        if (!hs && i.getLayer("tables-hit")) {
          let tb = i.queryRenderedFeatures(n.point, { layers: ["tables-hit"] });
          if ((!tb || !tb.length) && i.getLayer("tables-3d"))
            tb = i.queryRenderedFeatures(n.point, { layers: ["tables-3d"] }).filter(function (f) {
              return (f.properties || {}).sold !== !0 && (f.properties || {}).mk;
            });
          if (tb && tb.length) {
            // Попадне ли допирът точно в кръга на маса и вече сме в блока,
            // масата се избира. Мащабът не решава: блокът е близо до сцената
            // и на телефон кадрирането му не вдига мащаба над прага.
            Ne() || Bz2 ? Jn(tb[0].properties.mk) : (qn2(), Ft2());
            return;
          }
        }
        if (!hs && i.getLayer("tables-zone")) {
          const bz = i.queryRenderedFeatures(n.point, { layers: ["tables-zone"] });
          if (bz && bz.length) {
            // Вътре в блока с масите: празното между масите само не прави
            // нищо, вместо да нулира целия изглед. Продадената маса обаче се
            // подава нататък - тя трябва да каже, че е заета, а текстът живее
            // при останалия български надпис, не тук в картата.
            if (Ne()) {
              const so = i.getLayer("tables-3d") ? i.queryRenderedFeatures(n.point, { layers: ["tables-3d"] }) : [];
              if (so && so.length) {
                const smk = (so[0].properties || {}).mk;
                smk && Jn(smk);
                return;
              }
            } else (qn2(), Ft2());
            return;
          }
        }
        // Зоната за правостоящи е голямо плоско поле: хваща се на всякакъв мащаб.
        if (!hs && i.getLayer("standing-fill")) {
          const sf = i.queryRenderedFeatures(n.point, { layers: ["standing-fill"] });
          if (sf && sf.length) {
            Sn2(sf[0].properties.mk);
            return;
          }
        }
        const r = i.getLayer("sections-fill") ? ["sections-fill"] : [],
          a = hs,
          s = r.length ? i.queryRenderedFeatures(n.point, { layers: r }) : [],
          c = a ? a.properties : null,
          u = s.length ? s[0].properties.mk : c ? "s:" + c.s : null;
        if (Ne()) {
          if (c) {
            ze(c.mk);
            return;
          }
          if (u) {
            if (E != null && u === "s:" + E) return;
            be(u);
            return;
          }
          if (sd2(n.point)) return;
          he();
          return;
        }
        if (u) {
          be(u);
          return;
        }
        if (sd2(n.point)) return;
        he();
      }),
      i.getContainer().addEventListener(
        "wheel",
        function (n) {
          if (!(n.deltaY > 0)) return;
          const o = i.getZoom();
          if (
            (!(o > x.zoom + 0.08 || i.getPitch() > 0.5 || Math.abs(i.getBearing()) > 0.5) && !R) ||
            (!R && (!m || o > m.zoom + 0.06)) ||
            (n.preventDefault(), n.stopImmediatePropagation(), R)
          )
            return;
          R = !0;
          const a = function () {
            ((R = !1), i.off("moveend", a));
          };
          (i.on("moveend", a), setTimeout(a, 1300), (k = !0), We());
        },
        { capture: !0, passive: !1 },
      ),
      i.on("moveend", function (n) {
        !n.originalEvent &&
          i.getPitch() > 5 &&
          (m = { zoom: i.getZoom(), pitch: i.getPitch(), bearing: i.getBearing() });
      }));
    // Колко пръста са върху схемата. Изправянето при отдалечаване минава през
    // setPitch/setBearing, а те вътрешно спират текущото движение на камерата -
    // заедно с него умираше и самият жест, още след първата стъпка. Оттам
    // идваше и оплакването: разтваряш с два пръста, залата помръдва едва-едва
    // и трябва да повториш 4-5 пъти. Затова докато пръстите са долу, наклонът
    // не се пипа - изправя се, щом се вдигнат.
    let pr = 0;
    const pl = i.getCanvasContainer(),
      brои = function (n) {
        pr = n.touches ? n.touches.length : 0;
      },
      pusni = function (n) {
        (brои(n),
          pr < 2 &&
            m &&
            !i.isEasing() &&
            i.getPitch() > 0.3 &&
            ((_e = performance.now()), W || (W = requestAnimationFrame(t))));
      };
    (pl.addEventListener("touchstart", brои, { passive: !0 }),
      pl.addEventListener("touchmove", brои, { passive: !0 }),
      pl.addEventListener("touchend", pusni, { passive: !0 }),
      pl.addEventListener("touchcancel", pusni, { passive: !0 }));
    function t() {
      // Тече ли собствено движение на камерата (връщането към цялата зала),
      // изправянето е негова работа - две ръце на един волан се бият.
      if (pr >= 2 || i.isEasing()) {
        W = null;
        return;
      }
      if (((W = null), !m)) return;
      const n = i.getZoom(),
        o = Math.max(0.3, m.zoom - x.zoom),
        r = Math.max(0, Math.min(1, (n - x.zoom) / o)),
        a = m.pitch * r,
        s = m.bearing * r,
        c = i.getPitch(),
        u = i.getBearing(),
        d = Math.abs(a - c) < 0.15 && Math.abs(s - u) < 0.15;
      if ((d || (i.setPitch(c + (a - c) * 0.22), i.setBearing(u + (s - u) * 0.22)), r <= 0.001 && c < 0.3)) {
        (i.setPitch(0), i.setBearing(0), (m = null));
        return;
      }
      (!d || performance.now() - _e < 350) && (W = requestAnimationFrame(t));
    }
    i.on("zoom", function (n) {
      // Върнем ли се към общия изглед, вече не сме "вътре" в сектор и първият
      // допир пак показва сектора, а не избира място.
      (i.getZoom() < x.zoom + 0.8 && (Zn2 = !1),
        Tv2(),
        !n.originalEvent || !m || ((_e = performance.now()), W || (W = requestAnimationFrame(t))));
    });
  }
  function St() {
    // Обхватът се смята и по местата, не само по контурите на секторите: ако
    // някой контур липсва или е повреден, границите излизаха невалидни и
    // fitBounds тихо се проваляше - залата оставаше с мащаба по подразбиране.
    let e = null;
    [l.sections, l.seats, l.stage3d, l.tables, l.court && l.court.floor && { features: [l.court.floor] }].forEach(
      function (t) {
        const n = t && ke(t);
        if (!n) return;
        const o = [n[0][0], n[0][1], n[1][0], n[1][1]];
        if (!o.every(isFinite)) return;
        e
          ? ((e[0][0] = Math.min(e[0][0], n[0][0])),
            (e[0][1] = Math.min(e[0][1], n[0][1])),
            (e[1][0] = Math.max(e[1][0], n[1][0])),
            (e[1][1] = Math.max(e[1][1], n[1][1])))
          : (e = [
              [n[0][0], n[0][1]],
              [n[1][0], n[1][1]],
            ]);
      },
    );
    return e;
  }
  // Страничният панел лежи ВЪРХУ картата на широк екран: ако вписването не го
  // отчете, залата се центрира в цялото платно и дясната ѝ трета остава под
  // панела - изглежда като прекалено близък зум. Мери се самият панел, за да
  // следва ширината си (clamp(320px, 30vw, 400px)) без да я преповтаряме тук.
  function panelPad() {
    if (A) return 0;
    const el = document.querySelector(".sidebar");
    if (!el) return 0;
    const cs = getComputedStyle(el);
    if (cs.position !== "absolute" && cs.position !== "fixed") return 0;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.width < innerWidth * 0.6 ? Math.round(r.width) : 0;
  }
  function actionPad(base) {
    if (A) return base;
    const actions = document.querySelector(".map-actions")?.getBoundingClientRect();
    if (!actions?.height) return base;
    // Large desktop controls must not cover the last rows in the whole-hall view.
    return Math.max(base, i.getContainer().getBoundingClientRect().bottom - actions.top + 16);
  }
  function Be() {
    const e = St();
    if (!e) return;
    const t = l.stage3d && l.stage3d.features && l.stage3d.features.length ? 84 : 40;
    i.setMinZoom(0);
    const n = A ? 14 : 40;
    // Рамките се вдигат за вписването. Стоят ли по време на него, MapLibre
    // клампва зума така, че изгледът да не излезе от тях - а с отстъпите
    // (и мястото за страничния панел) изгледът обхваща доста повече от
    // залата. Резултатът беше по-близък зум от нужния и залата не се
    // побираше в кадъра.
    i.setMaxBounds(null);
    // Отстъпите са симетрични по вертикала: неравните изтласкваха залата
    // надолу и над нея зееше празнина, а под нея опираше в листа.
    const tp = A ? Math.round(t * 0.7) : t;
    (i.fitBounds(e, { padding: { top: tp, bottom: A ? tp : actionPad(n), left: n, right: n + panelPad() }, duration: 0 }),
      // Чак сега рамките: около залата с една пета марж, но задължително и
      // около текущия изглед - иначе камерата, която току-що нагласихме, пак
      // би била притисната.
      (function () {
        const dx = (e[1][0] - e[0][0]) * 0.2,
          dy = (e[1][1] - e[0][1]) * 0.2,
          v = i.getBounds();
        i.setMaxBounds([
          [Math.min(e[0][0] - dx, v.getWest()), Math.min(e[0][1] - dy, v.getSouth())],
          [Math.max(e[1][0] + dx, v.getEast()), Math.max(e[1][1] + dy, v.getNorth())],
        ]);
      })(),
      (x = { center: i.getCenter().toArray(), zoom: i.getZoom() }),
      (B = x.zoom + 2.6),
      (me = B - 0.4),
      (Y = B + 0.4),
      (zi = Math.max(0, x.zoom - nt)),
      (zx = Math.max(x.zoom + 1.5, g ? C(Je) : x.zoom + ot)),
      i.setMinZoom(Math.max(0, zi - lz)),
      i.setMaxZoom(zx + hz));
  }
  function Mt(e) {
    if (typeof ResizeObserver > "u" || !e) return;
    let t = null;
    new ResizeObserver(function () {
      (t != null && cancelAnimationFrame(t),
        (t = requestAnimationFrame(function () {
          ((t = null), i && (i.resize(), k || Be()));
        })));
    }).observe(e);
  }
  function Lt(e) {
    const t = e.container;
    ((l = e.venue),
      (ye = typeof e.onSectionHover == "function" ? e.onSectionHover : function () {}),
      (be = typeof e.onSectionClick == "function" ? e.onSectionClick : function () {}),
      (y = Array.isArray(l.focus) && l.focus.length === 2 ? l.focus : [0, 0]),
      (xe = typeof e.onSeatHover == "function" ? e.onSeatHover : function () {}),
      (ze = typeof e.onSeatClick == "function" ? e.onSeatClick : function () {}),
      (Jn = typeof e.onTableClick == "function" ? e.onTableClick : function () {}),
      (qn2 = typeof e.onTablesZone == "function" ? e.onTablesZone : function () {}),
      (Sn2 = typeof e.onStandingClick == "function" ? e.onStandingClick : function () {}),
      (he = typeof e.onBackgroundClick == "function" ? e.onBackgroundClick : function () {}),
      (H = new Map()));
    const n = (l.sections && l.sections.features) || [];
    return (
      n.forEach(function (r) {
        const a = r.properties && r.properties.mk != null ? r.properties.mk : r.id;
        a != null && H.set(a, r);
      }),
      (function () {
        let a = 0,
          s = 0,
          c = 0,
          u = 0;
        if (
          (n.forEach(function (I) {
            j(I.geometry && I.geometry.coordinates, function (p) {
              ((s += p[0]), (c += p[1]), a++);
              const L = Math.hypot(p[0] - y[0], p[1] - y[1]);
              L > u && (u = L);
            });
          }),
          !a)
        )
          return;
        X = u || 30;
        const d = y[0] - s / a,
          f = y[1] - c / a,
          M = Math.hypot(d, f);
        N = M > 0.15 * X ? [d / M, f / M] : [0, 0];
      })(),
      (g = !!(l.seats && l.seats.features && l.seats.features.length)),
      g && (O = ft()),
      (function () {
        const pts = (l.seats && l.seats.features) || [];
        if (!pts.length) return;
        let x0 = 1 / 0,
          x1 = -1 / 0,
          y0 = 1 / 0,
          y1 = -1 / 0;
        pts.forEach(function (f) {
          const c = f.geometry.coordinates;
          (c[0] < x0 && (x0 = c[0]), c[0] > x1 && (x1 = c[0]), c[1] < y0 && (y0 = c[1]), c[1] > y1 && (y1 = c[1]));
        });
        In = [(x0 + x1) / 2, (y0 + y1) / 2];
        // Най-отдалеченото място от сцената - мерилото за "далечен сектор".
        Ct2 = 0;
        pts.forEach(function (f) {
          const c = f.geometry.coordinates,
            d = Math.hypot(c[0] - y[0], c[1] - y[1]);
          d > Ct2 && (Ct2 = d);
        });
        // Ако около фокуса има места в почти всички посоки, залата е "в кръг".
        const bins = new Array(24).fill(0);
        pts.forEach(function (f) {
          const c = f.geometry.coordinates,
            a = Math.atan2(c[1] - y[1], c[0] - y[0]);
          bins[Math.floor(((a + Math.PI) / (2 * Math.PI)) * 24) % 24]++;
        });
        Gn = bins.filter(Boolean).length >= 16;
      })(),
      (z = new Map()),
      (P = new Map()),
      ((l.seats && l.seats.features) || []).forEach(function (r) {
        const a = r.properties || {},
          s = a.mk != null ? a.mk : r.id;
        s != null && z.set(s, r);
        const c = a.s;
        c != null && (P.has(c) || P.set(c, []), P.get(c).push(s));
      }),
      (i = new maplibregl.Map({
        container: t,
        attributionControl: false,
        style: {
          version: 8,
          glyphs: Ve,
          sources: {},
          layers: [{ id: "bg", type: "background", paint: { "background-color": "#EEF2F8" } }],
        },
        center: [0, 0],
        zoom: 2,
        pitch: 0,
        bearing: 0,
        maxPitch: 70,
        antialias: !A,
        renderWorldCopies: !1,
      })),
      // Бутоните за зум ползват стъпката на картата - подменяме я, за да
      // е по-осезаема от едно ниво.
      ((i.zoomIn = function (nz) {
        return i.easeTo(Object.assign({ zoom: i.getZoom() + sz, duration: 260 }, nz), { originalEvent: null });
      }),
      (i.zoomOut = function (nz) {
        return i.easeTo(Object.assign({ zoom: i.getZoom() - sz, duration: 260 }, nz), { originalEvent: null });
      })),
      // Горе вляво: вдясно бутоните оставаха под страничния панел, а и се
      // събираха с хапчетата от лентата - два различни вида бутони в един ъгъл.
      i.addControl(new maplibregl.NavigationControl({ showCompass: !1, showZoom: !0 }), "top-left"),
      i.on("webglcontextlost", function () {
        window.SeatMapStartup && window.SeatMapStartup.graphicsLost();
      }),
      i.on("webglcontextrestored", function () {
        i.once("idle", function () { window.SeatMapStartup && window.SeatMapStartup.mapReady(); });
      }),
      A && i.touchZoomRotate && i.touchZoomRotate.disableRotation(),
      i.on("load", function () {
        (Nz(),
          Be(),
          yt(),
          xt(),
          Mt(t),
          (h = !0),
          Z !== void 0 && (Ke(Z), (Z = void 0)),
          q !== void 0 && (Ue(q), (q = void 0)),
          G !== void 0 && ((w = G || null), (G = void 0)),
          Gq2 !== void 0 && ((Pq2 = Gq2 || 0), (Gq2 = void 0)),
          te !== void 0 && ((T = te), (te = void 0)),
          ne !== void 0 && ((ge = ne), (ne = void 0)),
          oe !== void 0 && ((_ = oe), (oe = void 0)),
          De(),
          // Надписът СЦЕНА се качва най-отгоре, иначе 3D подиумът го покрива.
          i.getLayer("object-labels") && i.moveLayer("object-labels"),
          U(),
          re(),
          V !== void 0 && (Le(V), (V = void 0)),
          $ !== void 0 && (Te($), ($ = void 0)),
          J !== void 0 && (Xe(J.mks, J.opts), (J = void 0)),
          Q !== void 0 && (Ye(Q), (Q = void 0)),
          Yt !== void 0 && (Jt(Yt), (Yt = void 0)),
          ee !== void 0 && (ve(ee), (ee = void 0)));
        i.once("idle", function () { window.SeatMapStartup && window.SeatMapStartup.mapReady(); });
      }),
      i
    );
  }
  // Колко от пътя до сцената влиза в кадъра при завъртане към сектор.
  const Ze = A ? 0.55 : 0.78;
  function je(e, t, Zt, kn, wd, mz, pv, bd) {
    if (!e.length) return;
    let n = 0,
      o = 0;
    for (const p of e) ((n += p[0]), (o += p[1]));
    ((n /= e.length), (o /= e.length));
    // bd омекотява завъртането на първата стъпка (оглед на сектора). Важи само
    // за зали със сцена в единия край: там блоковете са наредени в мрежа и
    // пълното обръщане към сцената ги слага диагонално на екрана. В зала "в
    // кръг" секторите са наредени радиално и обръщането тъкмо ги изправя.
    const r = pe(n, o) * (bd == null || Gn ? 1 : bd),
      // kn = "изглед от мястото": в кадъра влиза цялата сцена, за да се прецени
      // как се вижда оттам. Иначе се хваща само половината път до сцената.
      a = kn ? [y[0], y[1]] : [n + (y[0] - n) * Ze, o + (y[1] - o) * Ze];
    let s = 1 / 0,
      c = 1 / 0,
      u = -1 / 0,
      d = -1 / 0;
    for (const p of e.concat([a]))
      (p[0] < s && (s = p[0]), p[1] < c && (c = p[1]), p[0] > u && (u = p[0]), p[1] > d && (d = p[1]));
    const f = [
        [s, c],
        [u, d],
      ],
      M = A ? { top: 44, bottom: 52, left: 10, right: 10 } : { top: 150, bottom: 70, left: 34, right: 34 },
      I = Zt != null ? Math.min(Zt, zx) : zx;
    if (kn) {
      // Камерата застава зад местата и гледа към сцената под наклон. Центърът
      // се измества напред, за да останат местата долу, а сцената - горе.
      let bn = null,
        zw = 1 / 0;
      try {
        bn = i.cameraForBounds(f, { bearing: r, padding: M, maxZoom: I });
      } catch {}
      if (wd) {
        let s2 = 1 / 0,
          c2 = 1 / 0,
          u2 = -1 / 0,
          d2 = -1 / 0;
        for (const p of e)
          (p[0] < s2 && (s2 = p[0]), p[1] < c2 && (c2 = p[1]), p[0] > u2 && (u2 = p[0]), p[1] > d2 && (d2 = p[1]));
        try {
          const w2 = i.cameraForBounds(
            [
              [s2, c2],
              [u2, d2],
            ],
            { bearing: r, padding: M, maxZoom: I },
          );
          w2 && (zw = w2.zoom);
        } catch {}
      }
      // Наклонът "разтяга" далечината, затова кадърът търпи повече мащаб,
      // отколкото cameraForBounds смята: местата остават в долната четвърт,
      // а сцената застава в горната.
      const dl = Math.hypot(y[0] - n, y[1] - o),
        // Залепено за сцената: и малко изместване напред изкарва подиума от
        // кадъра, а стръмният наклон опира в тавана на мащаба.
        nr = Ct2 > 0 ? dl < Ct2 * 0.28 : !1,
        // sv = изглед от мястото на широк екран: единственият ход, който сваля
        // местата надолу и гледа към сцената под пълния наклон.
        sv = !wd && !A,
        // Далечина на местата като дял от най-далечното (0 при сцената, 1 в
        // последния ред). При задните сектори сцената е толкова далеч, че с
        // 40 px на място подиумът опираше горния ръб на кадъра; там едрината
        // слиза плавно до 32 px и сцената влиза с въздух. Плавно, а не с праг,
        // за да няма два съседни сектора с различен мащаб.
        fq = sv && Ct2 > 0 ? Math.max(0, Math.min(1, (dl / Ct2 - 0.6) / 0.4)) : 0,
        // wd = кадрира се цяла площ (сектор или блокът с масите): там мащабът
        // трябва да покаже целия блок, а не да се набива в него.
        zc = bn ? Math.min(zx, bn.zoom + (wd ? 0 : 1.8)) : i.getZoom(),
        // Избраните места ТРЯБВА да се виждат - под този мащаб те стават
        // точки и човек не разбира кое точно му е избрано.
        // При кадриране на площ мащабът се вдига за удобно избиране, но не
        // повече от това, при което самата площ още се събира в кадъра.
        // mz се смята по разстоянието между съседни места В СЕКТОРА - така
        // нагъстите централни блокове получават повече мащаб. Но гъстотата не
        // казва нищо за големината на залата: в зала с рядко разположени места
        // (НДК) същото правило хващаше две трети от нея и секторът плуваше в
        // празно поле. Затова мащабът никога не пада под общия за залата.
        zf = Math.max(mz != null ? mz : -1 / 0, C(A ? (wd ? 24 : 30) : wd ? 34 : 40 - 8 * fq)),
        // zw е мащабът, при който площта опира ръбовете на кадъра. Малко под
        // него, за да остане въздух наоколо и да личи докъде свършва блокът.
        zn = Math.min(zx, Math.max(zc, wd ? Math.min(zf, zw - vz) : zf)),
        pt2 = pv != null ? pv : nr ? 56 : 64,
        // Центърът остава ТОЧНО върху местата (така човек винаги вижда какво
        // си е избрал), а сцената влиза в кадъра чрез отместване на екрана:
        // местата се свалят надолу с фиксиран дял от височината, който не
        // зависи от това колко далеч е сцената. При кадриране на площ (wd)
        // отместване няма - секторът трябва да е в средата, за да се цели в
        // него, а наклонът е лек и сцената и без това е пред него.
        ofs = wd ? 0 : Math.round(i.getContainer().clientHeight * vo),
        // Изгледът от мястото е по-дълъг и с меко спиране; при "по-малко
        // движение" камерата застава на място без анимация.
        du = rmo() ? 0 : t != null ? t : sv ? sd : 1200;
      // easeTo сам нормализира bearing-а към късия път, така че и след ръчно
      // завъртане камерата не прави обиколка, а се връща към сцената направо.
      // easing се подава само когато има какво да се подаде: MapLibre слива
      // опциите с подразбиращите се и изрично undefined изтрива вградената
      // функция, при което анимацията увисва с първия кадър.
      const mv = { center: [n, o], zoom: zn, bearing: r, pitch: pt2, offset: [0, ofs], duration: du, essential: !0 };
      (sv && (mv.easing = vd), (m = { zoom: zn, pitch: pt2, bearing: r }), i.easeTo(mv));
      return;
    }
    try {
      const p = i.cameraForBounds(f, { bearing: r, padding: M, maxZoom: I });
      p && (m = { zoom: p.zoom, pitch: 50, bearing: r });
      const L = g ? C(A ? et : tt) : -1 / 0;
      if (p && p.zoom < L) {
        let ae = [1 / 0, 1 / 0],
          se = [-1 / 0, -1 / 0];
        for (const le of e)
          ((ae = [Math.min(ae[0], le[0]), Math.min(ae[1], le[1])]),
            (se = [Math.max(se[0], le[0]), Math.max(se[1], le[1])]));
        const ce = i.cameraForBounds([ae, se], { bearing: r, padding: M, maxZoom: I }),
          qe = Math.min(zx, Math.max(L, ce ? ce.zoom : L)),
          // Центърът се мести към сцената, за да влезе тя в кадъра. Когато
          // секторът и без това едва се събира, изместването е малко - иначе
          // местата излизат през долния ръб.
          Ge = 0;
        ((m = { zoom: qe, pitch: 50, bearing: r }),
          i.easeTo({
            center: [n + (y[0] - n) * Ge, o + (y[1] - o) * Ge],
            zoom: qe,
            bearing: r,
            pitch: 50,
            duration: t ?? 1100,
            essential: !0,
          }));
        return;
      }
    } catch {}
    i.fitBounds(f, { bearing: r, pitch: 50, padding: M, maxZoom: I, duration: t ?? 1100, essential: !0 });
  }
  function Ue(e) {
    if (!h) {
      q = e;
      return;
    }
    k = !0;
    const t = H.get(e);
    if (!t) return;
    const n = [];
    // Кадърът се строи по САМИТЕ МЕСТА, а не по контура на сектора: при
    // Г-образен контур средата му е встрани от местата и секторът излизаше
    // изместен, вместо да е в средата на екрана.
    ((P.get(String(e).replace(/^s:/, "")) || []).forEach(function (o) {
      const f = z.get(o);
      f && n.push([f.geometry.coordinates[0], f.geometry.coordinates[1]]);
    }),
      n.length ||
        j(t.geometry.coordinates, function (o) {
          n.push([o[0], o[1]]);
        }));
    // Прагът за мащаб се смята по разстоянието между съседни места В ТОЗИ
    // сектор: в централните блокове местата са нагъсто и трябва повече зум.
    const sq = (P.get(String(e).replace(/^s:/, "")) || [])
        .map(function (o) {
          return z.get(o);
        })
        .filter(Boolean),
      dd = [];
    for (let o = 1; o < sq.length && o < 400; o++) {
      const a2 = sq[o - 1].geometry.coordinates,
        b2 = sq[o].geometry.coordinates,
        d2 = Math.hypot(a2[0] - b2[0], a2[1] - b2[1]);
      d2 > 1e-6 && dd.push(d2);
    }
    dd.sort(function (a2, b2) {
      return a2 - b2;
    });
    const md = dd.length ? dd[Math.floor(dd.length * 0.35)] : 0,
      mz = md > 0 ? Math.log2(((A ? 14 : 19) * 360) / (512 * md)) : null;
    // Влезем ли в сектор, вече не сме в блока с масите.
    ((Zn2 = !0), (Bz2 = !1), Tv2(), i.once("moveend", vt2), je(n.length ? n : [st(t)], void 0, void 0, !0, !0, mz, 18, bz));
  }
  function Me(e, t) {
    if (!g || e == null) return;
    const n = String(e).replace(/^s:/, "");
    (P.get(n) || []).forEach(function (o) {
      v(o, t);
    });
  }
  function Ke(e) {
    if (!h) {
      Z = e;
      return;
    }
    if (
      (S != null && S !== e && (i.setFeatureState({ source: "sections", id: S }, { highlight: !1 }), Me(S, { hl: !1 })),
      e == null)
    ) {
      S = null;
      return;
    }
    (S !== e && Me(e, { hl: !0 }), i.setFeatureState({ source: "sections", id: e }, { highlight: !0 }), (S = e));
  }
  function Tt() {
    if (!h) {
      Z = null;
      return;
    }
    (S != null && (i.setFeatureState({ source: "sections", id: S }, { highlight: !1 }), Me(S, { hl: !1 })), (S = null));
  }
  function We() {
    ((Zn2 = !1), (Bz2 = !1), Tv2());
    if (!h) return;
    m = null;
    // Връщането е СЪЩОТО кадриране като при първо зареждане, а не запомнен
    // мащаб: запомненият идваше от друг размер на платното и отдалечаваше
    // повече от нужното.
    const e = St();
    if (!e) {
      i.easeTo({ center: x.center, zoom: x.zoom, bearing: 0, pitch: 0, duration: 900, essential: !0 });
      return;
    }
    const t = l.stage3d && l.stage3d.features && l.stage3d.features.length ? 84 : 40,
      n = A ? 14 : 40;
    const tp2 = A ? Math.round(t * 0.7) : t;
    i.fitBounds(e, {
      padding: { top: tp2, bottom: A ? tp2 : actionPad(n), left: n, right: n + panelPad() },
      bearing: 0,
      pitch: 0,
      duration: 800,
      essential: !0,
    });
  }
  // Избраната група може да е повече от едно място, затова състоянието се пази
  // като множество - иначе предишният избор остава маркиран.
  function Le(e) {
    const t = e == null ? [] : Array.isArray(e) ? e : [e];
    if (!h) {
      V = t.slice();
      return;
    }
    g &&
      (D &&
        D.forEach(function (n) {
          t.indexOf(n) === -1 && v(n, { selected: !1 });
        }),
      t.forEach(function (n) {
        z.get(n) && v(n, { selected: !0 });
      }),
      (D = t.slice()));
  }
  function vt() {
    (Kt2(), Le(null));
  }
  function Te(e) {
    if (!h) {
      $ = e || [];
      return;
    }
    g &&
      (de.forEach(function (t) {
        v(t, { rec: !1 });
      }),
      (de = new Set()),
      (e || []).forEach(function (t) {
        z.get(t) && (v(t, { rec: !0 }), de.add(t));
      }));
  }
  function Ft() {
    Te([]);
  }
  function Xe(e, kt) {
    // Ако картата още не е заредена, извикването се отлага - опциите трябва да
    // пътуват заедно с местата, иначе при повторното пускане се губят.
    if (!h) {
      J = { mks: e || [], opts: kt };
      return;
    }
    if (!g) return;
    k = !0;
    const t = (e || [])
      .map(function (d) {
        return z.get(d);
      })
      .filter(Boolean);
    if (!t.length) return;
    let n = 1 / 0,
      o = 1 / 0,
      r = -1 / 0,
      a = -1 / 0,
      s = 0,
      c = 0;
    t.forEach(function (d) {
      const f = d.geometry.coordinates;
      ((s += f[0]),
        (c += f[1]),
        f[0] < n && (n = f[0]),
        f[1] < o && (o = f[1]),
        f[0] > r && (r = f[0]),
        f[1] > a && (a = f[1]));
    });
    // context: не залепвай камерата в местата, а ги сложи в средата на екрана
    // с достатъчно зала наоколо, за да се разбира къде се намират. Тук не се
    // ползва fitBounds - при ограничен мащаб той изтласкваше местата под ръба.
    if (kt && kt.context) {
      const Ut = s / t.length,
        Vt = c / t.length,
        Wt = zi + (zx - zi) * 0.72,
        Xt = pe(Ut, Vt);
      // И на телефон камерата гледа към сцената, само че центърът се измества
      // по-малко - екранът е тесен и местата иначе излизат от кадъра.
      ((m = { zoom: Wt, pitch: 62, bearing: Xt }),
        i.easeTo({
          center: [Ut + (y[0] - Ut) * 0.22, Vt + (y[1] - Vt) * 0.22],
          zoom: Wt,
          bearing: Xt,
          pitch: 62,
          duration: 1100,
          essential: !0,
        }));
      return;
    }
    const u = 0.9;
    je(
      [
        [n - u, o - u],
        [r + u, o - u],
        [r + u, a + u],
        [n - u, a + u],
      ],
      void 0,
      void 0,
      !0,
    );
  }
  // Масата е мини сектор: камерата отива при нея и се завърта към сцената,
  // а самата маса потъмнява, за да се вижда коя е избрана.
  function Jt(e) {
    if (!h) {
      Yt = e;
      return;
    }
    const t = ((l.tables && l.tables.features) || []).filter(function (n) {
      return (n.properties || {}).mk === e;
    })[0];
    if (!t) return;
    k = !0;
    const n = t.geometry.coordinates,
      o = (tp > 0 ? tp : O * 1.2) * 2.4;
    je(
      [
        [n[0] - o, n[1] - o],
        [n[0] + o, n[1] - o],
        [n[0] + o, n[1] + o],
        [n[0] - o, n[1] + o],
      ],
      void 0,
      void 0,
      !0,
    );
  }
  // Масите са един общ сектор: първият клик показва целия блок, а чак вторият
  // избира конкретна маса - от общия изглед масата е няколко пиксела.
  // lvl = ценова категория. С нея кадърът обхваща само свободните маси от
  // тази категория („заведи ме при червените"); без нея - целия блок.
  function Ft2(lvl) {
    if (!h) return;
    let src = ((l.tables && l.tables.features) || []).filter(function (f) {
      return (f.properties || {}).sold !== !0;
    });
    if (lvl != null) {
      const only = src.filter(function (f) {
        return (f.properties || {}).tableLevel === lvl;
      });
      if (only.length) src = only;
    }
    if (!src.length) return;
    k = !0;
    let x0 = 1 / 0,
      y0 = 1 / 0,
      x1 = -1 / 0,
      y1 = -1 / 0;
    src.forEach(function (f) {
      const c = f.geometry.coordinates;
      (c[0] < x0 && (x0 = c[0]), c[0] > x1 && (x1 = c[0]), c[1] < y0 && (y0 = c[1]), c[1] > y1 && (y1 = c[1]));
    });
    const pad = (tp > 0 ? tp : O) * 1.8;
    ((Zn2 = !0), (Bz2 = !0), Tv2(), i.once("moveend", vt2));
    je(
      [
        [x0 - pad, y0 - pad],
        [x1 + pad, y0 - pad],
        [x1 + pad, y1 + pad],
        [x0 - pad, y1 + pad],
      ],
      void 0,
      void 0,
      !0,
      !0,
      void 0,
      18,
      bz,
    );
  }
  // Площта на блока с маси: клик върху нея (включително по продадена маса или
  // по празното между масите) работи като клик върху сектор.
  function Bz() {
    const src = (l.tables && l.tables.features) || [];
    if (!src.length) return null;
    let x0 = 1 / 0,
      y0 = 1 / 0,
      x1 = -1 / 0,
      y1 = -1 / 0;
    src.forEach(function (f) {
      const c = f.geometry.coordinates;
      (c[0] < x0 && (x0 = c[0]), c[0] > x1 && (x1 = c[0]), c[1] < y0 && (y0 = c[1]), c[1] > y1 && (y1 = c[1]));
    });
    const pd = (tp > 0 ? tp : O) * 1.1;
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [x0 - pd, y0 - pd],
                [x1 + pd, y0 - pd],
                [x1 + pd, y1 + pd],
                [x0 - pd, y1 + pd],
                [x0 - pd, y0 - pd],
              ],
            ],
          },
        },
      ],
    };
  }
  function Kt2() {
    (Dt2 && i.getSource("tables") && i.setFeatureState({ source: "tables", id: Dt2 }, { selected: !1 }), (Dt2 = null));
    Ot2([]);
  }
  // Избраните маси: една маса е една покупка за всичките ѝ места, но масите могат да са
  // няколко - затова състоянието е списък, а не едно поле.
  var Ts2 = [];
  function Ot2(e) {
    if (!h) return;
    const src = i.getSource("tables");
    if (!src) return;
    (Ts2.forEach(function (mk) {
      i.setFeatureState({ source: "tables", id: mk }, { selected: !1 });
    }),
      (Ts2 = (e || []).slice()),
      Ts2.forEach(function (mk) {
        i.setFeatureState({ source: "tables", id: mk }, { selected: !0 });
      }));
  }
  function Ye(e) {
    if (!h) {
      Q = e;
      return;
    }
    if (!g) return;
    k = !0;
    const t = z.get(e);
    if (!t) return;
    const n = t.geometry.coordinates,
      o = n[0],
      r = n[1],
      a = pe(o, r),
      s = zx - 0.2;
    ((m = { zoom: s, pitch: 50, bearing: a }),
      i.easeTo({ center: [o, r], zoom: s, bearing: a, pitch: 50, duration: 1100, essential: !0 }));
  }
  function ve(e) {
    if (!h) {
      ee = e;
      return;
    }
    if (
      !g ||
      (E != null &&
        (P.get(E) || []).forEach(function (o) {
          v(o, { revealed: !1 });
        }),
      (E = null),
      e == null)
    )
      return;
    const t = String(e).replace(/^s:/, "");
    ((P.get(t) || []).forEach(function (o) {
      v(o, { revealed: !0 });
    }),
      (E = t));
  }
  function Ct() {
    ve(null);
  }
  function U() {
    if (!h || !g) return;
    // Условията са защитени с coalesce: в боята изразът се смята за ВСЯКО
    // място, а продаденото няма цена и сравнението със null гърми - при
    // грешка MapLibre рисува с черно.
    const G2 = [],
      n = _ ? "eurAll" : "eur";
    (w && G2.push(["in", ["coalesce", ["get", "tier"], -1], ["literal", w]]),
      T &&
        (T.min != null && G2.push([">=", ["coalesce", ["get", n], -1], T.min]),
        T.max != null && G2.push(["<=", ["coalesce", ["get", n], 1e9], T.max])),
      ge && G2.push(["!=", ["get", "obstructed"], !0]),
      Pq2 > 1 && G2.push([">=", ["coalesce", ["get", "run"], 0], Pq2]));
    // Нито едно място не се крие: скритите места оставяха бели дупки насред
    // редовете и схемата изглеждаше сгрешена. Извън филтъра (както и
    // продаденото) местата просто посивяват, но не се предлагат и не се кликат.
    (["seats-3d", "seats-shadow"].forEach(function (o) {
      i.getLayer(o) && i.setFilter(o, null);
    }),
      Mc &&
        i.getLayer("seats-3d") &&
        i.setPaintProperty(
          "seats-3d",
          "fill-extrusion-color",
          G2.length ? ["case", ["all", ["!=", ["get", "sold"], !0], ["!", ["all"].concat(G2)]], Ke2, Mc] : Mc,
        ));
  }
  function re() {
    if (!h) return;
    const e = new Set();
    (H.forEach(function (t, n) {
      const o = t.properties || {};
      let r = !1;
      if (w) {
        const a = o.tier != null ? o.tier : o.bucket;
        (a == null || w.indexOf(a) === -1) && (r = !0);
      }
      if (!r && T) {
        const a = _ && o.priceFromAll != null ? o.priceFromAll : o.priceFrom,
          s = T.min,
          c = T.max;
        (a == null || (s != null && a < s) || (c != null && a > c)) && (r = !0);
      }
      r && e.add(n);
    }),
      He.forEach(function (t) {
        e.has(t) || i.setFeatureState({ source: "sections", id: t }, { dim: !1 });
      }),
      e.forEach(function (t) {
        i.setFeatureState({ source: "sections", id: t }, { dim: !0 });
      }),
      (He = e));
  }
  function It(e) {
    if (!h) {
      G = e;
      return;
    }
    ((w = e || null), U(), re());
  }
  // „Колко места" от отварящата стъпка: схемата свети само там, където групата
  // сяда заедно. Нищо не се избира - само се показва.
  function Nt2(e) {
    const n = typeof e == "number" && e > 1 ? e : 0;
    if (!h) {
      Gq2 = n;
      return;
    }
    ((Pq2 = n), U(), re());
  }
  function At(e, t) {
    const n = e == null && t == null ? null : { min: e ?? null, max: t ?? null };
    if (!h) {
      te = n;
      return;
    }
    ((T = n), U(), re());
  }
  function Pt(e) {
    const t = !!e;
    if (!h) {
      ne = t;
      return;
    }
    ((ge = t), U());
  }
  function Et(e) {
    const t = !!e;
    if (!h) {
      oe = t;
      return;
    }
    ((_ = t), De(), U(), re());
  }
  return {
    init: Lt,
    rotateToSection: Ue,
    highlight: Ke,
    clearHighlight: Tt,
    reset: We,
    selectSeat: Le,
    selectSeats: Le,
    clearSeatSelection: vt,
    highlightSeats: Te,
    clearSeatHighlights: Ft,
    frameSeats: Xe,
    setTierFilter: It,
    setPartyFilter: Nt2,
    setPriceRange: At,
    setObstructedHidden: Pt,
    setFeesMode: Et,
    zoomToSeats: Ye,
    frameTable: Jt,
    frameTables: Ft2,
    frameTableLevel: function (lvl) {
      Ft2(lvl);
    },
    // Свободните маси от една категория - панелът пита колко са, преди да
    // предложи да се избере някоя.
    tablesOfLevel: function (lvl) {
      return ((l.tables && l.tables.features) || [])
        .filter(function (f) {
          const pr = f.properties || {};
          return pr.sold !== !0 && pr.tableLevel === lvl;
        })
        .map(function (f) {
          return f.properties;
        });
    },
    selectTables: Ot2,
    selectStanding: stSet,
    frameStanding: stFrame,
    clearTableSelection: function () {
      Ot2([]);
    },
    revealSection: ve,
    clearRevealed: Ct,
    // Началният изглед: по него се решава дали камерата е "избягала" от
    // общия план. Не става по минималния мащаб - той дава запас за ръчно
    // отдалечаване и е под началния.
    home: function () {
      return x ? { center: x.center, zoom: x.zoom } : null;
    },
    // Достъп до картата за тестовия скрипт (мерене на ъгли и кадриране).
    _map: function () {
      return i;
    },
    _data: function () {
      return l;
    },
  };
})();
