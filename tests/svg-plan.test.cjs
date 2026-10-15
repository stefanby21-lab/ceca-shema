const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const base=path.join(__dirname,'..');
const context={window:{}};
vm.createContext(context);
for(const file of ['venue-data-arena.js','arena-plan-svg.js'])vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),context);
const {VENUE,ArenaPlanSVG,ArenaPlanSource}=context.window;
test('fallback is exported from the approved map page, not a second drawing',()=>{
 const page=fs.readFileSync(path.join(base,'../prototype/map.html'),'utf8');
 const original=page.match(/<svg[^>]*\bid="seatmap"[\s\S]*?<\/svg>/)[0];
 assert.equal(ArenaPlanSource.sha256,crypto.createHash('sha256').update(original).digest('hex'));
 // Every original circle and path keeps its exact geometry.
 const geometry=svg=>[...svg.matchAll(/<(circle|path|polygon)\b[^>]*>/g)].map(([tag,type])=>[type,...[...tag.matchAll(/\b(d|points|cx|cy|r)="([^"]*)"/g)].map(m=>[m[1],m[2]])]);
 assert.deepEqual(geometry(ArenaPlanSVG),geometry(original));
});
test('all 13,617 original chairs map one-to-one to real venue seat IDs',()=>{
 const ids=[...ArenaPlanSVG.matchAll(/<circle\b[^>]*data-key="([^"]+)"/g)].map(m=>m[1]);
 const actual=Array.from(VENUE.seats.features,f=>f.properties.mk);
 assert.equal(ids.length,13617);
 assert.equal(new Set(ids).size,ids.length);
 assert.deepEqual(ids.sort(),actual.sort());
});
test('all tables retain their original key and SVG styles cannot affect page icons',()=>{
 const tables=[...ArenaPlanSVG.matchAll(/data-key="(t:[^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(tables.sort(),Array.from(VENUE.tables.features,f=>f.properties.mk).sort());
 for(const rule of ArenaPlanSVG.match(/<style>([\s\S]*?)<\/style>/)[1].matchAll(/([^{}]+)\{/g)) {
  assert.ok(rule[1].split(',').every(selector=>selector.trim().startsWith('#arena-plan-svg ')));
 }
 assert.doesNotMatch(ArenaPlanSVG,/<script|<foreignObject|\son\w+=/);
});
