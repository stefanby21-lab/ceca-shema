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
  root.ArenaGeometry = { apply, band, forView, viewPoint, terraces, SCALE, RISE, BASE };
})(typeof window === "undefined" ? globalThis : window);
