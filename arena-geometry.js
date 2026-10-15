/* Arena geometry shared by the ticket map and the view from a seat.
   XY comes from the venue SVG. Heights are estimates in the same units,
   pending a measured section drawing; never a photographic sightline claim. */
(function (root) {
  "use strict";
  const SCALE = 3,
    RISE = 0.099,
    BASE = { 0: 0, 1: 0.27, 2: 1.755, 3: 3.78 };
  function apply(venue) {
    const rows = new Map();
    for (const f of venue.seats.features) {
      const p = f.properties,
        key = p.s + "|" + p.r;
      const point = f.geometry.coordinates,
        focus = venue.focus || [0, 0];
      const dx = point[0] - focus[0],
        dy = focus[1] - point[1],
        distance = Math.hypot(dx, dy);
      // An approximate view score from angle and distance to the actual stage.
      p.view =
        0.65 * Math.max(0, dy / Math.max(0.01, distance)) +
        0.35 * (1 - Math.min(1, distance / 45));
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key).push(f);
    }
    const sectors = new Map();
    for (const [key, seats] of rows) {
      const sector = seats[0].properties.s;
      if (!sectors.has(sector)) sectors.set(sector, []);
      sectors
        .get(sector)
        .push({
          key,
          seats,
          depth:
            seats.reduce(
              (sum, f) => sum + Math.hypot(...f.geometry.coordinates),
              0,
            ) / seats.length,
        });
    }
    for (const [sector, list] of sectors) {
      // Ложите (200-214) нямат точка в името: без този ред ставаха ниво 0,
      // тоест седалки на пода. Те са на нивото на V.I.P, освен 204-207.
      const level =
        /^20[4-7]$/.test(sector)
          ? 3
          : sector === "V.I.P" || /^2\d\d$/.test(sector)
            ? 2
            : Number(sector.split(".")[1]) || 0;
      list.sort((a, b) => a.depth - b.depth);
      list.forEach((row, index) =>
        row.seats.forEach((f) => {
          f.properties.el =
            level === 0 ? 0 : (BASE[level] ?? BASE[3]) + index * RISE;
        }),
      );
    }
    // Seating faces perpendicular to its actual SVG row, toward the bowl.
    // The event stage does not rotate permanent arena seats.
    for (const run of venue.adjacency.runs) {
      run.forEach((index, i) => {
        const f = venue.seats.features[index], p = f.geometry.coordinates;
        const a = venue.seats.features[run[Math.max(0, i - 1)]].geometry.coordinates;
        const b = venue.seats.features[run[Math.min(run.length - 1, i + 1)]].geometry.coordinates;
        let nx = -(b[1] - a[1]), ny = b[0] - a[0];
        if (nx * p[0] + ny * p[1] < 0) { nx = -nx; ny = -ny; }
        f.properties.seatYaw = f.properties.el === 0 ? 0 : Math.atan2(nx, -ny);
      });
    }
    return venue;
  }
  function band(points, halfDepth = 0.095) {
    if (points.length < 2) return null;
    const up = [],
      down = [];
    points.forEach((p, i) => {
      const a = points[Math.max(0, i - 1)],
        b = points[Math.min(points.length - 1, i + 1)];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1,
        dx = (b[0] - a[0]) / len,
        dy = (b[1] - a[1]) / len;
      const end = i === 0 ? -0.095 : i === points.length - 1 ? 0.095 : 0;
      up.push([
        p[0] - dy * halfDepth + dx * end,
        p[1] + dx * halfDepth + dy * end,
      ]);
      down.push([
        p[0] + dy * halfDepth + dx * end,
        p[1] - dx * halfDepth + dy * end,
      ]);
    });
    return up.concat(down.reverse());
  }
  // Ticket SVG uses exaggerated white gutters. Compact only those empty bands
  // for the illustrative 3D room; keep ticket IDs, counts and the source map intact.
  function viewPoint(point) {
    const [x,y] = point;
    // Independent axes keep every straight side row straight. A depth-dependent
    // side squeeze previously bent the lower stands toward the rear corners.
    const ax = Math.abs(x);
    const cut = (from,to,amount) => amount*Math.max(0,Math.min(1,(ax-from)/(to-from)));
    const nx = Math.sign(x) * (ax - cut(7.65,9.15,.9)
      - cut(13.3,13.8,.35) - cut(14.4,16.5,1.85));
    const ny = y < -8.95 ? y + 3.15 * Math.min(1, (-y - 8.95) / 3.8) : y;
    return [nx, ny];
  }
  function forView(venue) {
    const copy = structuredClone(venue);
    for (const collection of [copy.seats, copy.tables])
      for (const f of collection.features) f.geometry.coordinates = viewPoint(f.geometry.coordinates);
    copy.stage.geometry.coordinates = copy.stage.geometry.coordinates.map(ring => ring.map(viewPoint));
    copy.focus = viewPoint(copy.focus);
    return apply(copy);
  }
  function terraces(venue) {
    const levels=new Map();
    for(const f of venue.seats.features) {
      const h=f.properties.el;if(!h)continue;
      const key=Number(h.toFixed(5));
      if(!levels.has(key))levels.set(key,[]);
      levels.get(key).push(f.geometry.coordinates);
    }
    const result=[];
    // Join neighboring treads across sector aisles, without spanning the bowl
    // or placing a high platform over a lower sector with fewer rows.
    for(const [height,points] of levels) {
      points.sort((a,b)=>Math.atan2(a[1],a[0])-Math.atan2(b[1],b[0]));
      for(let i=0;i<points.length;i++) {
        const a=points[i],b=points[(i+1)%points.length],distance=Math.hypot(b[0]-a[0],b[1]-a[1]);
        if(distance>.25 && distance<3.2)result.push({ring:band([a,b]),height});
      }
    }
    return result;
  }
  // ---- Завеси: чист изчислител (без three.js) ----
  // Връща триъгълниците на завесите в метри (x = X*scale, z = -Y*scale, y нагоре):
  //  rear - задна завеса през цялата зала, зад линията на екрана;
  //  hoods - по един "похлупак" за всеки затворен сектор до сцената: плоска покривка
  //          над местата (по равнината на трибуната) и пола по ръба ѝ.
  // Вертикална стена отпред на затворените блокове задължително закриваше погледа
  // от продаваемите места към сцената (затворените блокове са точно по пътя на
  // лъча), затова блоковете се покриват, а не се заграждат. venue е вече през
  // forView (същите координати като изгледа от място).
  function curtainPanels(venue, opts) {
    opts = opts || {};
    const S = opts.scale || SCALE, LIFT = opts.lift == null ? 1.0 : opts.lift, SKIRT_DROP = 1.2, GROW = 0.45, REAR_GAP = 0.9, H = opts.height || 25;
    const st = venue.stage.geometry.coordinates[0],
      stageBack = -Math.max.apply(null, st.map((p) => p[1])) * S,
      stageFront = -Math.min.apply(null, st.map((p) => p[1])) * S,
      free = (p) => !p.sold && !p.offsale && p.eur > 0,
      bySector = new Map();
    let faceMax = 0;
    for (const f of venue.seats.features) {
      const p = f.properties, x = f.geometry.coordinates[0] * S, z = -f.geometry.coordinates[1] * S, el = (p.el || 0) * S;
      faceMax = Math.max(faceMax, Math.abs(x));
      let e = bySector.get(p.s);
      if (!e) bySector.set(p.s, (e = { s: p.s, pts: [], free: 0 }));
      e.pts.push([x, z, el]);
      if (free(p)) e.free++;
    }
    const rearZ = stageBack - REAR_GAP;
    const rear = { x0: -faceMax - 0.8, x1: faceMax + 0.8, z: rearZ, height: H };
    const hull = (pts) => {
      const a = pts.map((p) => [p[0], p[1]]).sort((u, v) => u[0] - v[0] || u[1] - v[1]), cr = (o, u, v) => (u[0] - o[0]) * (v[1] - o[1]) - (u[1] - o[1]) * (v[0] - o[0]);
      const lo = [], up = [];
      for (const p of a) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
      for (const p of a.slice().reverse()) { while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
      return lo.slice(0, -1).concat(up.slice(0, -1));
    };
    const hoods = [];
    for (const e of bySector.values()) {
      if (e.free > 0) continue;
      // Само затворените блокове, които се виждат от продаваемите места: пред задната
      // завеса и не по-далече от сцената в дълбочина (ложите по страните не се пипат).
      const zMax = Math.max.apply(null, e.pts.map((p) => p[1]));
      if (zMax < rearZ + 0.5 || zMax > stageFront + 3 || e.pts.length < 3) continue;
      // Равнина на трибуната (най-малки квадрати): el = a*x + b*z + c.
      let n = e.pts.length, sx = 0, sz = 0, sy = 0, sxx = 0, sxz = 0, szz = 0, sxy = 0, szy = 0;
      for (const [x, z, y] of e.pts) { sx += x; sz += z; sy += y; sxx += x * x; sxz += x * z; szz += z * z; sxy += x * y; szy += z * y; }
      const D = n * (sxx * szz - sxz * sxz) - sx * (sx * szz - sxz * sz) + sz * (sx * sxz - sxx * sz) || 1,
        a = (n * (sxy * szz - sxz * szy) - sy * (sx * szz - sxz * sz) + sz * (sx * szy - sxy * sz)) / D,
        b = (n * (sxx * szy - sxy * sxz) - sx * (sx * szy - sxy * sz) + sy * (sx * sxz - sxx * sz)) / D,
        c = (sy - a * sx - b * sz) / n;
      let up = -Infinity, down = Infinity;
      for (const [x, z, y] of e.pts) { const r = y - (a * x + b * z + c); up = Math.max(up, r); down = Math.min(down, y); }
      const lift = up + LIFT, level = (x, z) => a * x + b * z + c + lift;
      const h = hull(e.pts), cx = h.reduce((t, p) => t + p[0], 0) / h.length, cz = h.reduce((t, p) => t + p[1], 0) / h.length;
      // Контурът се разширява навън, за да покрие и ръбовете на местата.
      const hp = h.map(([x, z]) => { const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz) || 1; return [x + (dx / d) * GROW, z + (dz / d) * GROW]; });
      const tris = [], P = (x, z) => [x, level(x, z), z];
      for (let i = 0; i < hp.length; i++) {
        const u = hp[i], w = hp[(i + 1) % hp.length];
        tris.push([[cx, level(cx, cz), cz], P(u[0], u[1]), P(w[0], w[1])]);
        // Пола: от ръба на покривката до малко под най-ниското място.
        const yb = down - SKIRT_DROP, pu = P(u[0], u[1]), pw = P(w[0], w[1]);
        tris.push([pu, pw, [w[0], yb, w[1]]], [pu, [w[0], yb, w[1]], [u[0], yb, u[1]]]);
      }
      hoods.push({ sector: e.s, tris });
    }
    const triangles = [[[rear.x0, 0, rearZ], [rear.x1, 0, rearZ], [rear.x1, H, rearZ]], [[rear.x0, 0, rearZ], [rear.x1, H, rearZ], [rear.x0, H, rearZ]]];
    for (const hd of hoods) for (const t of hd.tris) triangles.push(t);
    return { rear, hoods, triangles, stageBack, stageFront };
  }
  // ---- Барове и FOH: чист изчислител (без three.js) ----
  // Всичко е от успоредни на осите кутии {k, x, y, z, w, h, d} (център и размери в
  // метри; k е материалът), плюс бутилки, столове и табели. Рендерерът само ги
  // рисува, а тестът за линиите на зрение хвърля лъчи през същите кутии.
  // Позициите и ширините са от данните (venue.objectLabels: център и size на
  // правоъгълниците от плана). venue е суровият (без forView), както в изгледа.
  // FOH няма навес: висящ борд на 3 м закриваше сцената от B.1.3 (Codex r4), затова
  // има само подиум, пулт, рекове и ниска ограда с малка табела до 1.3 м.
  function floorProps(venue, opts) {
    opts = opts || {};
    const S = opts.scale || SCALE, BACK_IN = opts.backIn == null ? 2.1 : opts.backIn;
    const zone = ((venue.standing || {}).features || [])[0];
    const z1 = zone ? Math.max.apply(null, zone.geometry.coordinates[0].map((p) => -viewPoint(p)[1] * S)) : 27.5;
    const frontZ = z1 - BACK_IN + 1.0; // лицето на тезгяха
    const out = { boxes: [], bottles: [], stools: [], barSigns: [], fohSigns: [], frontZ };
    const add = (k, w, h, d, x, y, z) => out.boxes.push({ k, x, y, z, w, h, d });
    const labels = ((venue.objectLabels || {}).features || []).filter((f) => f.properties.label === "BAR" || f.properties.label === "FOH");
    function bar(cx, W) {
      const z0 = frontZ, zb = z0 + 1.5;
      add("dark", W, 1.08, .6, cx, .54, z0 + .3);
      add("ledWhite", W - .08, .05, .02, cx, 1.0, z0 - .01);
      add("goldGlow", W - .08, .03, .02, cx, .1, z0 - .01);
      add("gloss", W + .1, .07, .74, cx, 1.115, z0 + .3);
      add("chrome", W - .2, .04, .04, cx, .2, z0 - .12);
      add("dark", W - .4, 1.0, .55, cx, .5, zb + .275);
      add("backGlow", W - .7, 1.5, .02, cx, 1.9, zb + .56);
      for (const y of [1.4, 1.85, 2.3]) {
        add("fader", W - .7, .025, .3, cx, y, zb + .4);
        add("ledWhite", W - .7, .02, .02, cx, y - .03, zb + .24);
        for (let x = cx - (W - 1.1) / 2; x <= cx + (W - 1.1) / 2; x += .14) out.bottles.push({ x, y: y + .013, z: zb + .4 });
      }
      add("dark", .08, 1.5, .1, cx - (W - .6) / 2, 1.9, zb + .56);
      add("dark", .08, 1.5, .1, cx + (W - .6) / 2, 1.9, zb + .56);
      // Рамка (ферма) с лайтбокс: стълбове и греда. Височината е избрана да не пресича
      // лъчите към сцената от най-близките продаваемите места (виж теста).
      const px = (W - .6) / 2, top = opts.headerTop || 2.8, sy = opts.signY == null ? 1.5 : opts.signY;
      for (const sx of [-1, 1]) add("chrome", .14, top, .14, cx + sx * px, top / 2, z0 + .75);
      add("chrome", W - .46, .14, .14, cx, top, z0 + .75);
      add("chrome", W - .46, .14, .14, cx, top - .2, z0 + .75);
      out.barSigns.push({ x: cx, y: sy, z: z0 + .75, w: 2.7, h: 1.1 });
      add("lightbox", 2.7, 1.1, 2.7, cx, sy + .55, z0 + .75);
      for (const side of [-1, 1]) for (let k = 0; k < 3; k++) out.stools.push({ x: cx + side * (2.0 + k * .85), z: z0 - .48 });
    }
    function foh(cx, W) {
      const z0 = frontZ, D = 2.3, zc = z0 + D / 2, Wf = Math.min(8.4, W), Ry = .4;
      add("riser", Wf, Ry, D, cx, Ry / 2, zc);
      add("goldGlow", Wf, .04, .02, cx, Ry - .04, z0 - .01);
      add("riser", 1.4, .2, .4, cx, .1, z0 - .2);
      add("dark", 5.4, .72, .9, cx, Ry + .36, zc);
      add("gloss", 5.5, .05, 1.0, cx, Ry + .745, zc);
      for (let k = 0; k < 24; k++) add("fader", .06, .025, .24, cx - 2.3 + k * .2, Ry + .785, zc - .08);
      for (const dx of [-1.6, 0, 1.6]) add("screenGlow", .62, .36, .035, cx + dx, Ry + 1.0, zc + .38);
      for (const sx of [-1, 1]) {
        add("dark", .62, 1.25, .62, cx + sx * (Wf / 2 - .6), Ry + .625, zc + .5);
        add("ledWhite", .5, .04, .02, cx + sx * (Wf / 2 - .6), Ry + .95, zc + .19);
        add("goldGlow", .5, .04, .02, cx + sx * (Wf / 2 - .6), Ry + .6, zc + .19);
      }
      // Ниска ограда около подиума (отворена пред стъпалото) и малка табела на нея.
      const fy = Ry + .5 + .35;
      for (const [w, d, x, z] of [[Wf, .04, cx, zc + D / 2 - .05], [.04, D, cx - Wf / 2 + .05, zc], [.04, D, cx + Wf / 2 - .05, zc], [Wf / 2 - .8, .04, cx - Wf / 4 - .4, z0 + .05], [Wf / 2 - .8, .04, cx + Wf / 4 + .4, z0 + .05]]) add("chrome", w, .04, d, x, fy, z);
      // Табела „FOH": тъмен панел 1.6 x .4 на предната и задната ограда, до 1.3 м от пода.
      add("signbox", 1.6, .4, .05, cx, 1.0, z0 + .05);
      add("signbox", 1.6, .4, .05, cx, 1.0, zc + D / 2 - .05);
      out.fohSigns.push({ x: cx, y: 1.0, z: z0 + .05 - .03, w: 1.6, h: .4, toward: -1 }, { x: cx, y: 1.0, z: zc + D / 2 - .05 + .03, w: 1.6, h: .4, toward: 1 });
    }
    for (const f of labels) {
      const c = viewPoint(f.geometry.coordinates), cx = c[0] * S, W = Math.max(4, Math.min(11, (f.properties.size || [3.4, 1])[0] * S));
      if (f.properties.label === "BAR") bar(cx, W); else foh(cx, W);
    }
    return out;
  }
  // Платно за равнина planeW x planeH: височина preferredH, ширина по съотношението.
  // Ако е по-голямо от най-големия размер на текстурата, ИЗМЕРЕНИЯТА СЕ СВИВАТ
  // ЗАЕДНО (едно и също число) - иначе съотношението се къса и буквите се разтягат.
  function fitCanvas(planeW, planeH, preferredH, maxTex) {
    const aspect = planeW / planeH;
    const k = Math.min(1, maxTex / (preferredH * aspect), maxTex / preferredH);
    const w0 = preferredH * aspect * k, h0 = preferredH * k;
    // Търси се най-близката цяла двойка (до три пиксела надолу): с цели числа
    // съотношението рядко е точно, а така грешката е под един пиксел.
    let best = null;
    for (let dw = 0; dw <= 3; dw++)
      for (let dh = 0; dh <= 3; dh++) {
        const w = Math.floor(w0) - dw + (dw === 0 && w0 % 1 ? 1 : 0), h = Math.floor(h0) - dh + (dh === 0 && h0 % 1 ? 1 : 0);
        if (w < 1 || h < 1 || w > maxTex || h > maxTex) continue;
        const off = Math.abs(w - aspect * h);
        if (!best || off < best.off - 1e-9) best = { w, h, off };
      }
    return best ? { w: best.w, h: best.h } : { w: 1, h: 1 };
  }
  root.ArenaGeometry = { apply, band, forView, viewPoint, terraces, fitCanvas, curtainPanels, floorProps, SCALE, RISE, BASE };
})(typeof window === "undefined" ? globalThis : window);
