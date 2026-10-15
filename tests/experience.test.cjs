const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const base = path.join(__dirname, "..");
const context = { window: {}, console };
vm.createContext(context);
for (const file of [
  "venue-data-arena.js",
  "arena-geometry.js",
  "seatfinder.js",
])
  vm.runInContext(fs.readFileSync(path.join(base, file), "utf8"), context);
const { VENUE, SeatFinder, ArenaGeometry } = context.window;
SeatFinder.init(VENUE);
test("recommendation respects budget, quantity, contiguous SVG runs, and availability for every price tier", () => {
  for (let tier = 0; tier < 7; tier++)
    for (let partySize = 1; partySize <= 8; partySize++) {
      const results = SeatFinder.find({
        partySize,
        tiers: [tier],
        sortBy: "view",
      });
      for (const result of results) {
        assert.equal(result.mks.length, partySize);
        assert.equal(new Set(result.mks).size, partySize);
        assert.ok(Number.isFinite(result.score));
        assert.ok(result.seats.every((seat) => seat.tier === tier));
        const indices = result.mks.map((mk) =>
          VENUE.seats.features.findIndex((f) => f.properties.mk === mk),
        );
        assert.ok(
          VENUE.adjacency.runs.some((run) =>
            run.some((_, i) => indices.every((v, j) => run[i + j] === v)),
          ),
        );
        assert.ok(
          indices.every(
            (i) =>
              !VENUE.seats.features[i].properties.sold &&
              !VENUE.seats.features[i].properties.offsale,
          ),
        );
      }
    }
});
test("unavailable, offsale and obstructed seats break adjacent groups before ranking", () => {
  const f = {
    meta: {},
    seats: {
      features: Array.from({ length: 8 }, (_, i) => ({
        properties: {
          mk: String(i),
          s: "A",
          r: 1,
          t: i,
          eur: 40,
          tier: 0,
          view: 0.5,
          offsale: i === 3,
          obstructed: i === 6,
        },
        geometry: { coordinates: [i, 0] },
      })),
    },
    adjacency: { runs: [[0, 1, 2, 3, 4, 5, 6, 7]] },
  };
  SeatFinder.init(f);
  const results = SeatFinder.find({
    partySize: 2,
    excludeObstructed: true,
    allowOrphan: true,
  });
  assert.ok(results.length);
  assert.ok(results.every((r) => !r.mks.includes("3") && !r.mks.includes("6")));
  SeatFinder.init(VENUE);
});
test("floor is flat and each grandstand rises away from the bowl", () => {
  ArenaGeometry.apply(VENUE);
  const sectors = new Map();
  for (const f of VENUE.seats.features) {
    const p = f.properties;
    if (p.s.includes(".0.")) assert.equal(p.el, 0);
    else assert.ok(p.el > 0);
    if (!sectors.has(p.s)) sectors.set(p.s, new Map());
    const rows = sectors.get(p.s);
    if (!rows.has(p.r)) rows.set(p.r, []);
    rows.get(p.r).push(f);
  }
  for (const [sector, rows] of sectors) {
    if (sector.includes(".0.")) continue;
    const levels = [...rows.values()]
      .map((row) => ({
        depth:
          row.reduce(
            (sum, f) => sum + Math.hypot(...f.geometry.coordinates),
            0,
          ) / row.length,
        height: row[0].properties.el,
      }))
      .sort((a, b) => a.depth - b.depth);
    for (let i = 1; i < levels.length; i++)
      assert.ok(levels[i].height > levels[i - 1].height);
  }
});
test('permanent seats face into the bowl perpendicular to their SVG row', () => {
  ArenaGeometry.apply(VENUE);
  for(const run of VENUE.adjacency.runs){
    if(run.length<2)continue;
    run.forEach((index,i)=>{
      const f=VENUE.seats.features[index];if(!f.properties.el)return;
      const a=VENUE.seats.features[run[Math.max(0,i-1)]].geometry.coordinates;
      const b=VENUE.seats.features[run[Math.min(run.length-1,i+1)]].geometry.coordinates;
      const back=[Math.sin(f.properties.seatYaw),-Math.cos(f.properties.seatYaw)];
      assert.ok(Math.abs(back[0]*(b[0]-a[0])+back[1]*(b[1]-a[1]))<1e-8);
      assert.ok(back[0]*f.geometry.coordinates[0]+back[1]*f.geometry.coordinates[1]>=0);
    });
  }
});
test('3D compact gutters preserve floor seats, ticket identities, source coordinates and FOH gap',()=>{
  context.structuredClone=structuredClone;
  const before=JSON.stringify(VENUE), view=ArenaGeometry.forView(VENUE);
  assert.equal(JSON.stringify(VENUE),before);
  assert.equal(view.seats.features.length,VENUE.seats.features.length);
  assert.equal(view.tables.features.length,VENUE.tables.features.length);
  view.seats.features.forEach((f,i)=>{assert.equal(f.properties.mk,VENUE.seats.features[i].properties.mk);if(f.properties.el===0)assert.deepEqual(f.geometry.coordinates,VENUE.seats.features[i].geometry.coordinates);});
  const bounds=s=>{const points=view.seats.features.filter(f=>f.properties.s===s).map(f=>f.geometry.coordinates);return [Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[1]))]};
  const gap=(bounds('F.0.1')[0]-bounds('B.1.2')[1])*ArenaGeometry.SCALE;
  assert.ok(gap>2&&gap<3.5,`rear center-to-center gutter ${gap}`);
  assert.equal(view.seats.features.filter(f=>f.properties.s==='F.0.2').length,65);
  for(const f of view.seats.features){assert.ok(f.geometry.coordinates.every(Number.isFinite));assert.ok(Number.isFinite(f.properties.seatYaw));}
});
test('3D side stands stay straight and retain a uniform floor setback', () => {
  context.structuredClone=structuredClone;
  const view=ArenaGeometry.forView(VENUE);
  for(const side of ['A','C']) {
    const front=view.seats.features.filter(f=>f.properties.s.startsWith(side+'.1.') && f.properties.r==='1');
    const xs=front.map(f=>f.geometry.coordinates[0]);
    assert.ok(Math.max(...xs)-Math.min(...xs)<.001,'the front edge must not bend toward the rear');
  }
  assert.ok(Math.max(...view.seats.features.map(f=>f.properties.el))<5.5);
});
test('sector aisle infill stays local and keeps the central floor open', () => {
  const view=ArenaGeometry.forView(VENUE), terraces=ArenaGeometry.terraces(view);
  assert.ok(terraces.length>10);
  for(const tread of terraces) {
    assert.ok(tread.height>0);
    assert.ok(tread.ring.flat().every(Number.isFinite));
    for(const p of tread.ring)assert.ok(Math.hypot(...p)>7,'infill must stay outside the central floor');
    const xs=tread.ring.map(p=>p[0]),ys=tread.ring.map(p=>p[1]);
    assert.ok(Math.hypot(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys))<3.5,'no slab may span distant sectors');
  }
});
