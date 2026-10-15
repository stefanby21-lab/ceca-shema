// Общите мишени за тестовете на линиите на зрение (завеси и подиум): те гледат
// ПОВЪРХНОСТТА на сцената, на височината, на която я рисува изгледът
// (ArenaGeometry.STAGE_HEIGHT_M), а не само предния ѝ ръб.
'use strict';
function inside(ring, x, y) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
// Равномерна мрежа (стъпка step метра) от точки върху горната повърхност на сцената,
// само вътре в нейния контур (подиумът за артистите също е сцена). Точките са във
// вида, в който ги ползват тестовете: [x, y, z] в метри, z = -y_на_плана * scale.
function stageSurfaceTargets(G, venue, step) {
  const S = G.SCALE, ring = venue.stage.geometry.coordinates[0];
  const xs = ring.map((p) => p[0] * S), zs = ring.map((p) => -p[1] * S);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
  const ringM = ring.map((p) => [p[0] * S, -p[1] * S]);
  const nx = Math.max(2, Math.round((x1 - x0) / step)), nz = Math.max(2, Math.round((z1 - z0) / step));
  const out = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const x = x0 + (x1 - x0) * (i + .5) / nx, z = z0 + (z1 - z0) * (j + .5) / nz;
    if (inside(ringM, x, z)) out.push([x, G.STAGE_HEIGHT_M + .05, z]);
  }
  return out;
}
module.exports = { stageSurfaceTargets, inside };
