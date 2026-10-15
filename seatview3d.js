window.SeatView3D = (function () {
  "use strict";
  // Three.js се сервира от нас, не от чужд CDN: външният скрипт вижда всичко на
  // страницата, а версията му може да се смени под краката ни.
  // Пътят се превръща в АБСОЛЮТЕН: динамичният import() приема гол път като
  // име на пакет („vendor/…") и отказва да го зареди.
  const Me = new URL("vendor/three.module.js?v=0.160.0", document.baseURI).href;
  let ct = null;
  function pe() {
    return (
      ct ||
        (ct = import(Me).catch(function (e) {
          throw ((ct = null), e);
        })),
      ct
    );
  }
  let f = null;
  function O(e, r) {
    return /БАЛКОН 2/.test(e)
      ? "B2"
      : /БАЛКОН 1/.test(e)
        ? /^loja/.test(r || "")
          ? "L"
          : "T"
        : /ОРКЕСТРИНА/.test(e)
          ? "O"
          : "P";
  }
  function J(e, r) {
    switch (O(e, r)) {
      case "B2":
        return { base: 12, slope: 0.36 };
      case "L":
        return { base: 7.5, slope: 0.12 };
      case "T":
        return { base: 2, slope: 0.16 };
      case "O":
        return { base: 0, slope: 0.03 };
      default:
        return { base: 0.5, slope: 0.11 };
    }
  }
  const nn = (e) => /БАЛКОН/.test(e || "");
  function we(e) {
    const r = document.createElement("div");
    r.style.cssText = "position:fixed;inset:0;z-index:10000;background:#0b0d16;display:flex;flex-direction:column;";
    const h = document.createElement("div");
    h.style.cssText =
      "display:flex;align-items:center;justify-content:space-between;padding:14px 20px;color:#fff;font:15px system-ui;flex:0 0 auto;";
    const d = document.createElement("div");
    d.textContent = e || "Изглед от мястото";
    const L = document.createElement("button");
    ((L.type = "button"),
      (L.textContent = "✕"),
      L.setAttribute("aria-label", "Затворете"),
      (L.style.cssText = "background:transparent;border:0;color:#fff;font-size:22px;cursor:pointer;padding:4px 10px;"),
      h.appendChild(d),
      h.appendChild(L));
    const w = document.createElement("div");
    w.style.cssText = "position:relative;flex:1 1 auto;min-height:0;";
    const y = document.createElement("div");
    return (
      (y.style.cssText =
        "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font:15px system-ui;pointer-events:none;"),
      (y.textContent = "Зареждане…"),
      w.appendChild(y),
      r.appendChild(h),
      r.appendChild(w),
      document.body.appendChild(r),
      { overlay: r, header: h, stage: w, status: y, closeBtn: L }
    );
  }
  const pt = (e) => [1, 3, 5].map((r) => parseInt(e.slice(r, r + 2), 16)),
    Ft = (e) =>
      "#" +
      e
        .map((r) =>
          Math.max(0, Math.min(255, Math.round(r)))
            .toString(16)
            .padStart(2, "0"),
        )
        .join(""),
    Wt = (e, r, h) => Ft(pt(e).map((d, L) => d + (pt(r)[L] - d) * h)),
    ye = (e, r) => Ft(pt(e).map((h) => h * r)),
    rt = ["#f1e4c3", "#d9a441", "#e0873a", "#d97a8a", "#b45a9a", "#7d5aa8", "#4f7fbf", "#f1e4c3"],
    it = ["#fbf6ea", "#f1e4c3", "#e2b04a", "#d97a8a", "#7d5aa8"];
  function ge(e, r, h) {
    const d = (e - 0.5) * h,
      L = r - 0.5,
      w = Math.abs(d) * 1.15 + Math.abs(L);
    if (w < 0.62) {
      const A = Math.min(it.length - 1, Math.floor((w / 0.62) * it.length));
      return ((Math.abs(Math.atan2(L, d)) * 8) / Math.PI) % 1 < 0.18 && w > 0.2 ? Wt(it[A], "#ffffff", 0.35) : it[A];
    }
    const y = Math.abs(d) * 1.6 + L * 1.1,
      m = ((Math.floor(y * 4.2) % rt.length) + rt.length) % rt.length,
      I = Math.min(1, Math.abs(d) / (h / 2));
    return Wt(rt[m], "#e9c77a", I * 0.2);
  }
  function be(e, r) {
    const d = Math.round(1536 / r),
      L = document.createElement("canvas");
    ((L.width = 1536), (L.height = d));
    const w = L.getContext("2d");
    ((w.fillStyle = "#2a2030"), w.fillRect(0, 0, 1536, d));
    const y = 7;
    for (let I = y / 2; I < d; I += y)
      for (let A = y / 2; A < 1536; A += y) {
        const U = A / 1536,
          B = 1 - I / d,
          S = ((A * 73 + I * 131) % 29) / 29;
        ((w.fillStyle = ye(ge(U, B, r), 0.85 + 0.3 * S)),
          w.beginPath(),
          w.arc(A, I, y * 0.5, 0, Math.PI * 2),
          w.fill());
      }
    const m = new e.CanvasTexture(L);
    return ((m.colorSpace = e.SRGBColorSpace), (m.anisotropy = 4), m);
  }
  function ve(e) {
    const h = document.createElement("canvas");
    ((h.width = 256), (h.height = 256));
    const d = h.getContext("2d");
    ((d.fillStyle = "#0f1530"), d.fillRect(0, 0, 256, 256));
    for (let w = 8; w < 256; w += 64)
      for (let y = 8; y < 256; y += 64) {
        const m = (y * 31 + w * 17) % 5;
        ((d.fillStyle = m < 2 ? "#182047" : "#0b1026"), d.fillRect(y, w, 48, 48));
      }
    const L = new e.CanvasTexture(h);
    return ((L.wrapS = L.wrapT = e.RepeatWrapping), L);
  }
  function Le(e, r) {
    const h = new e.Scene();
    h.fog = new e.Fog(592662, 70, 170);
    const d = (t) => t * 1.5,
      L = 0.95,
      w = 1.05,
      y = (function () {
        const t = [...new Set(r.seats.map((a) => +a.y.toFixed(3)))].sort((a, s) => a - s),
          n = [];
        let o = 0;
        for (let a = 1; a < t.length; a++) {
          const s = t[a] - t[a - 1];
          s > w && n.push({ at: t[a - 1], to: t[a], cut: s - L });
        }
        return function (a) {
          let s = a;
          for (const c of n) a >= c.to ? (s -= c.cut) : a > c.at && (s -= ((a - c.at) / (c.to - c.at)) * c.cut);
          return s;
        };
      })(),
      m = (t) => -y(t) * 2.4,
      I = r.stage,
      A = d(I.minLng),
      U = d(I.maxLng),
      B = m(I.minLat),
      S = m(I.maxLat),
      q = U - A,
      u = (A + U) / 2,
      T = new e.Mesh(new e.PlaneGeometry(400, 400), new e.MeshLambertMaterial({ color: 2897797 }));
    ((T.rotation.x = -Math.PI / 2), T.position.set(0, 0, 40), h.add(T));
    const et = (r.stage3d && r.stage3d.features) || [],
      H = new Map(),
      ht = (t) => (H.has(t) || H.set(t, new e.MeshLambertMaterial({ color: new e.Color(t) })), H.get(t));
    let x = null;
    if (r.curtain) {
      const t = r.curtain;
      x = { x0: d(t.x1), x1: d(t.x2), z0: m(t.y2), z1: m(t.y1), y0: t.base * 1.5 * 1.25, y1: t.top * 1.5 * 1.25 };
    }
    let V = 0.75;
    const nt = [];
    let g = 0;
    if (
      (et.forEach(function (t) {
        const n = t.properties || {},
          o = t.geometry && t.geometry.type === "Polygon" && t.geometry.coordinates[0];
        if (!o || o.length < 4) return;
        const a = /^(platform|lip|stair|stanchion|rope)$/.test(n.part) ? 1 : 1.25,
          s = (+n.base || 0) * 1.5 * a,
          c = (+n.height || 0) * 1.5 * a;
        if ((n.part === "platform" && (V = c), n.part === "curtain")) {
          (x || (x = { x0: 1 / 0, x1: -1 / 0, z0: 1 / 0, z1: -1 / 0, y0: 1 / 0, y1: -1 / 0 }),
            o.forEach(function (M) {
              const v = d(M[0]),
                N = m(M[1]);
              ((x.x0 = Math.min(x.x0, v)),
                (x.x1 = Math.max(x.x1, v)),
                (x.z0 = Math.min(x.z0, N)),
                (x.z1 = Math.max(x.z1, N)));
            }),
            (x.y0 = Math.min(x.y0, s)),
            (x.y1 = Math.max(x.y1, c)));
          return;
        }
        let i = 0,
          l = 0;
        (o.forEach(function (M) {
          ((i += d(M[0])), (l += -m(M[1])));
        }),
          (i /= o.length),
          (l /= o.length));
        const b = n.part === "platform" ? 1 : 0.996,
          P = n.part === "platform" ? 0 : 0.004 + 0.002 * (g++ % 5),
          z = new e.Shape();
        o.forEach(function (M, v) {
          const N = i + (d(M[0]) - i) * b,
            xe = l + (-m(M[1]) - l) * b;
          v === 0 ? z.moveTo(N, xe) : z.lineTo(N, xe);
        });
        const G = new e.ExtrudeGeometry(z, { depth: Math.max(0.02, c - s), bevelEnabled: !1 });
        (G.rotateX(-Math.PI / 2), G.translate(0, s + P, 0));
        const k = new e.Mesh(G, ht(n.color || "#666666"));
        (/^(stanchion|rope)$/.test(n.part) && nt.push(k), h.add(k));
      }),
      !et.length)
    ) {
      const t = new e.Mesh(new e.BoxGeometry(q, 1.1, B - S), new e.MeshLambertMaterial({ color: 1052692 }));
      (t.position.set(u, 0.55, (B + S) / 2),
        h.add(t),
        (x = { x0: u - q * 0.43, x1: u + q * 0.43, z0: S + 0.2, z1: S + 1, y0: 1.1, y1: 10.1 }));
    }
    const F = x.x1 - x.x0,
      K = x.y1 - x.y0,
      wt = (x.x0 + x.x1) / 2,
      ft = (x.y0 + x.y1) / 2,
      Dt = new e.Mesh(
        new e.BoxGeometry(F, K, Math.max(0.3, x.z1 - x.z0)),
        new e.MeshLambertMaterial({ color: 2760752 }),
      );
    (Dt.position.set(wt, ft, (x.z0 + x.z1) / 2), h.add(Dt));
    const Ot = new e.Mesh(new e.PlaneGeometry(F, K), new e.MeshBasicMaterial({ map: be(e, F / K) }));
    (Ot.position.set(wt, ft, x.z1 + 0.02), h.add(Ot));
    const Vt = new e.PointLight(16767392, 55, 60, 1.8);
    (Vt.position.set(wt, ft, x.z1 + 4), h.add(Vt));
    const Ge = new e.MeshLambertMaterial({ color: 9313056 });
    [-1, 1].forEach(function (t) {
      const n = new e.Mesh(new e.BoxGeometry(1.6, K + 0.4, 0.7), Ge);
      (n.position.set(t < 0 ? x.x0 - 0.9 : x.x1 + 0.9, ft + 0.2, x.z1 + 0.6), h.add(n));
    });
    let yt = 0,
      gt = -1 / 0;
    r.seats.forEach(function (t) {
      ((yt = Math.max(yt, Math.abs(d(t.x) - u))), (gt = Math.max(gt, m(t.y))));
    });
    const p = yt + 2.6,
      W = gt + 3.2,
      Xt = W - (S - 1),
      dt = ve(e);
    dt.repeat.set(10, 3);
    const bt = new e.MeshLambertMaterial({ map: dt }),
      j = 22,
      jt = new e.Mesh(new e.PlaneGeometry(p * 2 + 2, j), bt);
    (jt.position.set(u, j / 2, S - 1),
      h.add(jt),
      [-1, 1].forEach(function (t) {
        const n = new e.Mesh(new e.PlaneGeometry(Xt, j), bt.clone());
        ((n.material.map = dt.clone()),
          n.material.map.repeat.set(Math.round(Xt / 14), 3),
          n.position.set(u + t * p, j / 2, (S - 1 + W) / 2),
          (n.rotation.y = (-t * Math.PI) / 2),
          h.add(n));
      }));
    const ot = new e.Mesh(new e.PlaneGeometry(p * 2 + 2, j), bt.clone());
    ((ot.material.map = dt.clone()),
      ot.material.map.repeat.set(10, 3),
      ot.position.set(u, j / 2, W),
      (ot.rotation.y = Math.PI),
      h.add(ot));
    const Be = new e.MeshBasicMaterial({ color: 15263196 });
    [-1, 1].forEach(function (t) {
      const n = new e.Mesh(new e.PlaneGeometry(6, 3.4), Be);
      (n.position.set(u + t * (p - 0.12), 7.2, B + 6), (n.rotation.y = (-t * Math.PI) / 2), h.add(n));
    });
    const ke = new e.MeshLambertMaterial({ color: 3813162 }),
      Zt = new e.MeshLambertMaterial({ color: 12102026 }),
      $ = function (t, n, o, a) {
        const s = new e.Group(),
          c = new e.Mesh(new e.BoxGeometry(1.7, 2.3, 0.08), ke);
        c.position.set(0, 1.15, 0.05);
        const i = new e.Mesh(new e.BoxGeometry(1.95, 2.45, 0.05), Zt);
        i.position.set(0, 1.22, 0.02);
        const l = new e.Mesh(new e.SphereGeometry(0.05, 6, 6), Zt);
        (l.position.set(0.55, 1.05, 0.11),
          s.add(i),
          s.add(c),
          s.add(l),
          s.position.set(t, n, o),
          (s.rotation.y = a),
          h.add(s));
      },
      vt = new e.Mesh(new e.PlaneGeometry(200, 200), new e.MeshLambertMaterial({ color: 461082 }));
    ((vt.rotation.x = Math.PI / 2), vt.position.set(u, j, (S + W) / 2), h.add(vt));
    const Ie = new e.SphereGeometry(0.14, 6, 6),
      Ce = new e.MeshBasicMaterial({ color: 16774880 }),
      Lt = 26,
      Pt = Math.max(8, Math.round((W - S) / 2.6)),
      Nt = new e.InstancedMesh(Ie, Ce, Lt * Pt),
      Yt = new e.Matrix4();
    let Ae = 0;
    for (let t = 0; t < Pt; t++)
      for (let n = 0; n < Lt; n++)
        (Yt.makeTranslation(u - p + 1.5 + n * ((p * 2 - 3) / (Lt - 1)), j - 0.12, S + 1.5 + t * 2.6),
          Nt.setMatrixAt(Ae++, Yt));
    h.add(Nt);
    const Fe = new e.MeshLambertMaterial({ color: 1383752 });
    for (let t = 0; t < Pt; t++) {
      const n = new e.Mesh(new e.BoxGeometry(p * 2 - 1, 0.9, 0.16), Fe);
      (n.position.set(u, j - 0.75, S + 2.8 + t * 2.6), h.add(n));
    }
    const R = d(r.focus[0]),
      Y = m(r.focus[1]);
    let zt = 0,
      St = 0;
    (r.seats.forEach(function (t) {
      ((zt += d(t.x)), (St += m(t.y)));
    }),
      (zt /= Math.max(1, r.seats.length)),
      (St /= Math.max(1, r.seats.length)));
    let Gt = zt - R,
      at = St - Y;
    const _t = Math.hypot(Gt, at) || 1;
    ((Gt /= _t), (at /= _t));
    const We = (t, n) => (t - R) * Gt + (n - Y) * at,
      De = (t, n) => Math.hypot(t - R, n - Y),
      Ut = (t, n, o) => (t === "P" || t === "O" ? We(n, o) : De(n, o)),
      Z = {},
      ut = {};
    r.seats.forEach(function (t) {
      const n = O(t.level, t.s),
        o = Ut(n, d(t.x), m(t.y));
      ((!(n in Z) || o < Z[n]) && (Z[n] = o), (!(n in ut) || o > ut[n]) && (ut[n] = o));
    });
    const Oe = function (t, n) {
        const o = J(t, n),
          a = O(t, n),
          s = Math.max(1, (ut[a] || 0) - (Z[a] || 0));
        return Math.min(o.slope, (22 - 4.5 - o.base) / s);
      },
      C = function (t, n, o, a) {
        const s = J(t, a),
          c = O(t, a);
        return s.base + Oe(t, a) * Math.max(0, Ut(c, n, o) - (Z[c] || 0));
      },
      Kt = function (t, n, o) {
        const a = t.attributes.position;
        for (let s = 0; s < a.count; s++) {
          const c = a.getX(s),
            i = a.getZ(s);
          a.setY(s, a.getY(s) + C(n, c, i, o) - J(n, o).base);
        }
        return ((a.needsUpdate = !0), t.computeVertexNormals(), t);
      },
      Bt = (t) => (t.s || "") + "|" + (t.r || ""),
      E = new Map();
    r.seats.forEach(function (t) {
      const n = Bt(t);
      (E.has(n) || E.set(n, { level: t.level, seats: [] }), E.get(n).seats.push(t));
    });
    const $t = new e.Matrix4(),
      Qt = new e.Quaternion(),
      Jt = new e.Euler(),
      qt = new e.Vector3(),
      Ve = new e.Vector3(1, 1, 1);
    E.forEach(function (t) {
      if (t.seats.length < 2) return;
      let n = t.seats[0],
        o = t.seats[0],
        a = -1;
      for (let M = 0; M < t.seats.length; M++)
        for (let v = M + 1; v < t.seats.length; v++) {
          const N = Math.hypot(t.seats[M].x - t.seats[v].x, t.seats[M].y - t.seats[v].y);
          N > a && ((a = N), (n = t.seats[M]), (o = t.seats[v]));
        }
      const s = d(n.x),
        c = m(n.y),
        i = d(o.x),
        l = m(o.y),
        b = Math.hypot(i - s, l - c) || 1;
      let P = -(l - c) / b,
        z = (i - s) / b;
      const G = (s + i) / 2,
        k = (c + l) / 2;
      (P * (R - G) + z * (Y - k) < 0 && ((P = -P), (z = -z)), (t.yaw = Math.atan2(P, z)));
    });
    const Xe = function (t) {
        const n = t.slice().sort((s, c) => s[0] - c[0] || s[1] - c[1]);
        if (n.length < 3) return n;
        const o = (s, c, i) => (c[0] - s[0]) * (i[1] - s[1]) - (c[1] - s[1]) * (i[0] - s[0]),
          a = (s) => {
            const c = [];
            for (const i of s) {
              for (; c.length >= 2 && o(c[c.length - 2], c[c.length - 1], i) <= 0;) c.pop();
              c.push(i);
            }
            return (c.pop(), c);
          };
        return a(n).concat(a(n.slice().reverse()));
      },
      je = new e.MeshLambertMaterial({ color: 12159560 }),
      Ze = new e.MeshLambertMaterial({ color: 2897797 }),
      Ne = new e.MeshLambertMaterial({ color: 1317434 }),
      Ye = new e.MeshLambertMaterial({ color: 13804894 }),
      Tt = (t) => Math.abs(Math.abs(t[0] - u) - p) < 0.6 || Math.abs(t[1] - W) < 0.6,
      Ht = function (t, n) {
        let o = !1;
        for (let a = 0, s = n.length - 1; a < n.length; s = a++) {
          const c = n[a][0],
            i = n[a][1],
            l = n[s][0],
            b = n[s][1];
          i > t[1] != b > t[1] && t[0] < ((l - c) * (t[1] - i)) / (b - i) + c && (o = !o);
        }
        return o;
      },
      _e = function (t, n) {
        if (t.length < 3) return null;
        const o = Xe(t.map((l) => [d(l.x), m(l.y)]));
        let a = 0,
          s = 0;
        (o.forEach((l) => {
          ((a += l[0]), (s += l[1]));
        }),
          (a /= o.length),
          (s /= o.length));
        const c = (l) => Ue(o, a, s, l);
        let i = null;
        for (const l of [1.6, 1, 0.6, 0.3]) if (((i = c(l)), !n.some((b) => Ht(b, i)))) break;
        return i;
      },
      Ue = function (t, n, o, a) {
        let s = t;
        const c = Math.sign(n - u) || 1,
          i = p - Math.abs(n - u),
          l = W - o,
          b = i <= l;
        return s.map((P) => {
          const z = P[0] - n,
            G = P[1] - o,
            k = Math.hypot(z, G) || 1;
          let M = P[0] + (z / k) * a,
            v = P[1] + (G / k) * a;
          return (
            b && (M - n) * c > 0 && (M = u + c * p),
            !b && v > o && (v = W),
            Math.abs(M - u) > p - 3.2 && (M = u + Math.sign(M - u) * p),
            v > W - 3.5 && (v = W),
            (M = Math.max(u - p, Math.min(u + p, M))),
            (v = Math.min(W, v)),
            [M, v]
          );
        });
      },
      Ke = function (t, n) {
        const o = new e.Vector3().subVectors(n, t),
          a = o.length();
        if (a < 0.05) return;
        o.normalize();
        const s = new e.Vector3().copy(t).add(n).multiplyScalar(0.5),
          c = new e.Quaternion().setFromUnitVectors(new e.Vector3(0, 0, 1), o),
          i = new e.Mesh(new e.BoxGeometry(0.16, 0.6, a), Ne);
        (i.position.copy(s), i.quaternion.copy(c), h.add(i));
        const l = new e.Mesh(new e.BoxGeometry(0.34, 0.12, a), Ye);
        (l.position.copy(s).add(new e.Vector3(0, 0.34, 0)), l.quaternion.copy(c), h.add(l));
      },
      kt = function (t, n, o) {
        const a = J(n, o).base,
          s = O(n, o),
          c = r.seats.filter((l) => O(l.level, l.s) !== s).map((l) => [d(l.x), m(l.y)]),
          i = t.map((l) => _e(l, c)).filter(Boolean);
        return (
          i.forEach(function (l, b) {
            const P = new e.Shape();
            l.forEach((M, v) => {
              v === 0 ? P.moveTo(M[0], -M[1]) : P.lineTo(M[0], -M[1]);
            });
            const G = /^blok-(9|10)$/.test((t[b] && t[b][0] && t[b][0].s) || "") ? Math.max(1.1, a + 0.05) : 1.1,
              k = new e.ExtrudeGeometry(P, { depth: G, bevelEnabled: !1 });
            (k.rotateX(-Math.PI / 2), k.translate(0, a - G, 0), Kt(k, n, o), h.add(new e.Mesh(k, [Ze, je])));
          }),
          i.forEach(function (l, b) {
            for (let P = 0; P < l.length; P++) {
              const z = l[P],
                G = l[(P + 1) % l.length];
              if (Tt(z) && Tt(G)) continue;
              const k = [(z[0] + G[0]) / 2, (z[1] + G[1]) / 2];
              i.some((M, v) => v !== b && Ht(k, M)) ||
                Ke(
                  new e.Vector3(z[0], C(n, z[0], z[1], o) + 0.3, z[1]),
                  new e.Vector3(G[0], C(n, G[0], G[1], o) + 0.3, G[1]),
                );
            }
          }),
          i
        );
      };
    (nt.forEach(function (t) {
      t.geometry.computeBoundingBox();
      const n = t.geometry.boundingBox;
      t.position.y = C("ОРКЕСТРИНА", (n.min.x + n.max.x) / 2, (n.min.z + n.max.z) / 2);
    }),
      (function () {
        if (r.seats.filter((l) => O(l.level, l.s) === "P").map((l) => [d(l.x), m(l.y)]).length < 3) return;
        const o = Y + at * (Z.O != null ? Z.O : 0),
          a = Y + at * (Z.P != null ? Z.P : 0),
          s = new e.MeshLambertMaterial({ color: 3095180 }),
          c = function (l, b, P, z) {
            if (b - l < 0.2) return;
            const G = [
                [u - p, l],
                [u + p, l],
                [u + p, b],
                [u - p, b],
              ],
              k = new e.Shape();
            G.forEach((v, N) => {
              N === 0 ? k.moveTo(v[0], -v[1]) : k.lineTo(v[0], -v[1]);
            });
            const M = new e.ExtrudeGeometry(k, { depth: z, bevelEnabled: !1 });
            (M.rotateX(-Math.PI / 2), M.translate(0, -z + J(P).base, 0), Kt(M, P), h.add(new e.Mesh(M, s)));
          },
          i = a - 0.9;
        (c(B + 0.6, i, "ОРКЕСТРИНА", 0.3), c(i, W, "ПАРТЕР 1", 0.3 + J("ПАРТЕР 1").base));
      })());
    const It = function (t) {
        const n = new Map();
        return (
          r.seats.forEach(function (o) {
            t(o) && (n.has(o.s) || n.set(o.s, []), n.get(o.s).push(o));
          }),
          [...n.values()]
        );
      },
      $e = kt(
        It((t) => O(t.level, t.s) === "T"),
        "БАЛКОН 1",
        "blok-9",
      ),
      Rt = kt(
        It((t) => O(t.level, t.s) === "L"),
        "БАЛКОН 1",
        "loja-11",
      ),
      Qe = $e.concat(Rt);
    kt(
      It((t) => O(t.level, t.s) === "B2"),
      "БАЛКОН 2",
      "blok-17",
    );
    const _ = W - 0.06;
    ($(u - p * 0.35, C("БАЛКОН 2", u - p * 0.35, _), _, Math.PI),
      $(u + p * 0.35, C("БАЛКОН 2", u + p * 0.35, _), _, Math.PI),
      [-1, 1].forEach(function (t) {
        const n = Qe.filter((a) => a.some((s) => Math.sign(s[0] - u) === t));
        if (!n.length) return;
        const o = u + t * (p - 0.06);
        n.forEach(function (a) {
          const s = a.filter((l) => Math.abs(Math.abs(l[0] - u) - p) < 0.6);
          if (!s.length) return;
          const c = s.reduce((l, b) => l + b[1], 0) / s.length,
            i = Rt.indexOf(a) >= 0 ? "loja-11" : "blok-9";
          $(o, C("БАЛКОН 1", o, c, i), c, t > 0 ? -Math.PI / 2 : Math.PI / 2);
        });
      }),
      $(u - p * 0.35, C("ПАРТЕР 1", u - p * 0.35, _), _, Math.PI),
      $(u + p * 0.35, C("ПАРТЕР 1", u + p * 0.35, _), _, Math.PI));
    const mt = B + 6;
    ($(u - p + 0.06, C("ПАРТЕР 1", u - p + 0.06, mt), mt, Math.PI / 2),
      $(u + p - 0.06, C("ПАРТЕР 1", u + p - 0.06, mt), mt, -Math.PI / 2));
    const Et = (t) => O(t.level, t.s) === "O",
      tt = r.seats.filter(Et),
      Q = r.seats.filter((t) => !Et(t)),
      X = (t, n, o) => new e.InstancedMesh(t, new e.MeshLambertMaterial({ color: n }), Math.max(1, o)),
      D = (t, n, o, a, s, c, i, l, b) => {
        (Jt.set(0, c, 0), Qt.setFromEuler(Jt));
        const P = o + Math.cos(c) * i + Math.sin(c) * b,
          z = s - Math.sin(c) * i + Math.cos(c) * b;
        (qt.set(P, a + l, z), $t.compose(qt, Qt, Ve), t.setMatrixAt(n, $t));
      },
      Je = 13914666,
      qe = 12862751,
      te = 2761502,
      Ct = 13225686,
      ee = 1710620,
      Te = 14207140,
      ne = X(new e.SphereGeometry(1, 14, 8).scale(0.25, 0.075, 0.24), Je, Q.length),
      oe = X(new e.SphereGeometry(1, 14, 8).scale(0.25, 0.27, 0.06), qe, Q.length),
      ae = X(new e.BoxGeometry(0.06, 0.07, 0.4), te, Q.length),
      se = X(new e.BoxGeometry(0.06, 0.07, 0.4), te, Q.length),
      ce = X(new e.BoxGeometry(0.42, 0.34, 0.36), 1315350, Q.length),
      re = X(new e.SphereGeometry(1, 14, 8).scale(0.255, 0.275, 0.05), Te, Q.length);
    (Q.forEach(function (t, n) {
      const o = d(t.x),
        a = m(t.y),
        s = C(t.level, o, a, t.s),
        c = E.get(Bt(t)),
        i = c && c.yaw != null ? c.yaw : Math.atan2(R - o, Y - a);
      (D(ce, n, o, s, a, i, 0, 0.17, 0),
        D(ne, n, o, s, a, i, 0, 0.42, 0),
        D(oe, n, o, s, a, i, 0, 0.72, -0.22),
        D(re, n, o, s, a, i, 0, 0.72, -0.26),
        D(ae, n, o, s, a, i, -0.27, 0.62, -0.02),
        D(se, n, o, s, a, i, 0.27, 0.62, -0.02));
    }),
      [ce, ne, oe, re, ae, se].forEach((t) => h.add(t)));
    const ie = X(new e.BoxGeometry(0.46, 0.05, 0.4), ee, tt.length),
      le = X(new e.BoxGeometry(0.44, 0.3, 0.04), ee, tt.length),
      He = new e.BoxGeometry(0.03, 0.44, 0.03),
      st = [0, 1, 2, 3].map(() => X(He, Ct, tt.length)),
      he = X(new e.BoxGeometry(0.03, 0.36, 0.03), Ct, tt.length),
      fe = X(new e.BoxGeometry(0.03, 0.36, 0.03), Ct, tt.length);
    (tt.forEach(function (t, n) {
      const o = d(t.x),
        a = m(t.y),
        s = C(t.level, o, a, t.s),
        c = E.get(Bt(t)),
        i = c && c.yaw != null ? c.yaw : Math.atan2(R - o, Y - a);
      (D(ie, n, o, s, a, i, 0, 0.45, 0),
        D(le, n, o, s, a, i, 0, 0.75, -0.19),
        D(st[0], n, o, s, a, i, -0.21, 0.22, 0.17),
        D(st[1], n, o, s, a, i, 0.21, 0.22, 0.17),
        D(st[2], n, o, s, a, i, -0.21, 0.22, -0.17),
        D(st[3], n, o, s, a, i, 0.21, 0.22, -0.17),
        D(he, n, o, s, a, i, -0.21, 0.64, -0.19),
        D(fe, n, o, s, a, i, 0.21, 0.64, -0.19));
    }),
      [ie, le, he, fe].concat(st).forEach((t) => h.add(t)));
    const xt = d(r.own.x),
      Mt = m(r.own.y),
      At = C(r.own.level, xt, Mt, r.own.s),
      de = new e.Mesh(
        new e.SphereGeometry(1, 14, 8).scale(0.27, 0.05, 0.26),
        new e.MeshBasicMaterial({ color: 3108822 }),
      );
    (de.position.set(xt, At + 0.5, Mt),
      h.add(de),
      h.add(new e.AmbientLight(16770764, 0.8)),
      h.add(new e.HemisphereLight(8425727, 4206618, 0.5)),
      [0.3, 0.7].forEach(function (t) {
        const n = new e.PointLight(16766888, 60, 90, 1.6);
        (n.position.set(u, j - 1.5, S + (W - S) * t), h.add(n));
      }));
    const ue = new e.DirectionalLight(16773341, 0.75);
    (ue.position.set(u, 14, S + 10), h.add(ue));
    const me = new e.DirectionalLight(13160703, 0.25);
    return (
      me.position.set(u, 12, 60),
      h.add(me),
      { scene: h, camera: { x: xt, y: At + 1.2, z: Mt }, lookAt: { x: u, y: V + 1.5, z: B - 0.25 * (B - S) } }
    );
  }
  function Pe(e) {
    lt();
    const r = we(e.title);
    f = {
      dom: r,
      raf: null,
      renderer: null,
      disposed: !1,
      lon: 0,
      lat: 0,
      targetLon: 0,
      targetLat: 0,
      fov: 62,
      targetFov: 62,
      keydown: null,
      pointer: null,
      resize: null,
    };
    const h = function (d) {
      d.key === "Escape" && lt();
    };
    (document.addEventListener("keydown", h),
      (f.keydown = h),
      r.closeBtn.addEventListener("click", lt),
      pe()
        .then(function (d) {
          !f || f.disposed || ze(d, e, r);
        })
        .catch(function (d) {
          (console.error("[seatview3d]", d),
            f && !f.disposed && (r.status.textContent = "3D изгледът не можа да се зареди"));
        }));
  }
  function ze(e, r, h) {
    const d = h.stage.clientWidth || innerWidth,
      L = h.stage.clientHeight || innerHeight,
      w = new e.WebGLRenderer({ antialias: !0 });
    (w.setPixelRatio(Math.min(devicePixelRatio || 1, 2)),
      w.setSize(d, L),
      (w.domElement.style.cssText = "display:block;width:100%;height:100%;cursor:grab;"),
      h.stage.appendChild(w.domElement),
      (f.renderer = w));
    const y = Le(e, r),
      m = new e.PerspectiveCamera(f.fov, d / L, 0.1, 400);
    m.position.set(y.camera.x, y.camera.y, y.camera.z);
    const I = y.lookAt.x - y.camera.x,
      A = y.lookAt.z - y.camera.z;
    f.targetLon = f.lon = (Math.atan2(I, -A) * 180) / Math.PI;
    const U = y.lookAt.y - y.camera.y;
    f.targetLat = f.lat = (Math.atan2(U, Math.hypot(I, A)) * 180) / Math.PI;
    const B = w.domElement;
    let S = !1,
      q = 0,
      u = 0,
      T = 0,
      et = 0;
    const H = function (g, F) {
        ((S = !0), (q = g), (u = F), (T = f.targetLon), (et = f.targetLat), (B.style.cursor = "grabbing"));
      },
      ht = function (g, F) {
        S && ((f.targetLon = T + (g - q) * 0.12), (f.targetLat = Math.max(-45, Math.min(50, et + (F - u) * 0.12))));
      },
      x = function () {
        ((S = !1), (B.style.cursor = "grab"));
      },
      V = {
        md: function (g) {
          (g.preventDefault(), H(g.clientX, g.clientY));
        },
        mm: function (g) {
          ht(g.clientX, g.clientY);
        },
        mu: x,
        ts: function (g) {
          g.touches.length === 1 && H(g.touches[0].clientX, g.touches[0].clientY);
        },
        tm: function (g) {
          g.touches.length === 1 && (ht(g.touches[0].clientX, g.touches[0].clientY), g.preventDefault());
        },
        te: x,
        wh: function (g) {
          (g.preventDefault(), (f.targetFov = Math.max(35, Math.min(85, f.targetFov + g.deltaY * 0.04))));
        },
      };
    (B.addEventListener("mousedown", V.md),
      addEventListener("mousemove", V.mm),
      addEventListener("mouseup", V.mu),
      B.addEventListener("touchstart", V.ts, { passive: !0 }),
      B.addEventListener("touchmove", V.tm, { passive: !1 }),
      B.addEventListener("touchend", V.te),
      B.addEventListener("wheel", V.wh, { passive: !1 }),
      (f.pointer = { canvas: B, P: V }));
    const nt = function () {
      const g = h.stage.clientWidth,
        F = h.stage.clientHeight;
      ((m.aspect = g / F), m.updateProjectionMatrix(), w.setSize(g, F));
    };
    (addEventListener("resize", nt),
      (f.resize = nt),
      (h.status.style.display = "none"),
      (function g() {
        if (!f || f.disposed) return;
        ((f.raf = requestAnimationFrame(g)),
          (f.lon += (f.targetLon - f.lon) * 0.1),
          (f.lat += (f.targetLat - f.lat) * 0.1),
          (f.fov += (f.targetFov - f.fov) * 0.1),
          (m.fov = f.fov),
          m.updateProjectionMatrix());
        const F = ((90 - f.lat) * Math.PI) / 180,
          K = (f.lon * Math.PI) / 180;
        (m.lookAt(
          m.position.x + 100 * Math.sin(F) * Math.sin(K),
          m.position.y + 100 * Math.cos(F),
          m.position.z - 100 * Math.sin(F) * Math.cos(K),
        ),
          w.render(y.scene, m));
      })());
  }
  function lt() {
    if (f) {
      if (
        ((f.disposed = !0),
        f.raf && cancelAnimationFrame(f.raf),
        f.keydown && document.removeEventListener("keydown", f.keydown),
        f.resize && removeEventListener("resize", f.resize),
        f.pointer)
      ) {
        const e = f.pointer.canvas,
          r = f.pointer.P;
        (e.removeEventListener("mousedown", r.md),
          removeEventListener("mousemove", r.mm),
          removeEventListener("mouseup", r.mu),
          e.removeEventListener("touchstart", r.ts),
          e.removeEventListener("touchmove", r.tm),
          e.removeEventListener("touchend", r.te),
          e.removeEventListener("wheel", r.wh));
      }
      if (f.renderer) {
        f.renderer.dispose();
        const e = f.renderer.domElement;
        e && e.parentNode && e.parentNode.removeChild(e);
      }
      (f.dom.overlay.parentNode && f.dom.overlay.parentNode.removeChild(f.dom.overlay), (f = null));
    }
  }
  function Se(e, r) {
    f && ((f.targetLon += e || 0), (f.targetLat = Math.max(-45, Math.min(50, f.targetLat + (r || 0)))));
  }
  return { open: Pe, close: lt, look: Se };
})();
