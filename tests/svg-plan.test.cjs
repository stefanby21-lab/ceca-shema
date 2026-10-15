const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const base=path.join(__dirname,'..');
const context={window:{}};
vm.createContext(context);
for(const file of ['venue-data-ceca.js','ceca-plan-svg.js'])vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),context);
const {VENUE,CecaPlanSVG,CecaPlanSource}=context.window;
const keysOf=(kind)=>[...CecaPlanSVG.matchAll(new RegExp('<(?:circle|g|polygon|path|rect)\\b[^>]*\\bdata-key="([^"]+)"[^>]*\\bdata-kind="'+kind+'"','g'))].map(m=>m[1]);
const sorted=(list)=>[...list].sort();
test('every venue seat is in the plan exactly once and nothing else is a seat',()=>{
 const ids=keysOf('seat');
 const actual=Array.from(VENUE.seats.features,f=>f.properties.mk);
 assert.equal(ids.length,actual.length);
 assert.equal(new Set(ids).size,ids.length);
 assert.deepEqual(sorted(ids),sorted(actual));
 // Всеки кръг в чертежа е място: няма немаркирани кръгове.
 assert.equal([...CecaPlanSVG.matchAll(/<circle\b/g)].length,ids.length);
});
test('every table, sector and the standing zone are in the plan exactly once',()=>{
 const tables=keysOf('table');
 assert.equal(tables.length,180);
 assert.deepEqual(sorted(tables),sorted(Array.from(VENUE.tables.features,f=>f.properties.mk)));
 const sections=keysOf('section');
 assert.deepEqual(sorted(sections),sorted(Array.from(VENUE.sections.features,f=>f.properties.mk)));
 assert.equal(new Set(sections).size,sections.length);
 assert.deepEqual(keysOf('standing'),['z:Standing']);
 assert.deepEqual(Array.from(VENUE.standing.features,f=>f.properties.mk),['z:Standing']);
 // Таблица: един оцветяван път (масата със столчетата) и една площ за натискане.
 assert.equal([...CecaPlanSVG.matchAll(/class="table"/g)].length,180);
 assert.equal([...CecaPlanSVG.matchAll(/class="table-hit"/g)].length,180);
 assert.equal([...CecaPlanSVG.matchAll(/class="standing-hit"/g)].length,1);
 assert.equal([...CecaPlanSVG.matchAll(/class="standing"/g)].length,1);
 assert.equal([...CecaPlanSVG.matchAll(/class="sec-shape"/g)].length,71);
});
test('the plan carries no admin traces, prices or sale status',()=>{
 assert.doesNotMatch(CecaPlanSVG,/<script|<foreignObject|\son\w+=|<metadata|<title|Corel|xodm/i);
 // Единственият id е на самия чертеж; цените и статусите идват от VENUE.
 assert.deepEqual([...CecaPlanSVG.matchAll(/\sid="([^"]*)"/g)].map(m=>m[1]),['ceca-plan-svg']);
 assert.doesNotMatch(CecaPlanSVG,/class="[^"]*\b(color[-\w]*|multiplace|kur)\b/);
 assert.doesNotMatch(CecaPlanSVG,/<circle\b[^>]*\bclass=/);
 assert.doesNotMatch(CecaPlanSVG,/Администратор|Изход/);
 assert.match(CecaPlanSVG,/^<svg\b[^>]*\bviewBox="0 0 2500 2500"/);
});
test('SVG styles are scoped to the plan and cannot affect page icons',()=>{
 const styles=[...CecaPlanSVG.matchAll(/<style>([\s\S]*?)<\/style>/g)];
 assert.equal(styles.length,1);
 for(const rule of styles[0][1].matchAll(/([^{}]+)\{/g)) {
  assert.ok(rule[1].split(',').every(selector=>selector.trim().startsWith('#ceca-plan-svg')),rule[1]);
 }
});
test('the plan is the one generated from the current admin drawing (when the private page exists)',{skip:!fs.existsSync(path.join(process.env.HOME||'','Downloads','ceca shema','ceca shema.html'))},()=>{
 const page=fs.readFileSync(path.join(process.env.HOME,'Downloads','ceca shema','ceca shema.html'),'utf8');
 const original=page.slice(page.indexOf('<svg'),page.indexOf('</svg>')+6);
 assert.equal(CecaPlanSource.sha256,crypto.createHash('sha256').update(original).digest('hex'));
 assert.equal(CecaPlanSource.seats,VENUE.seats.features.length);
});
test('exporter output is byte-identical on a second run (when the private page exists)',{skip:!fs.existsSync(path.join(process.env.HOME||'','Downloads','ceca shema','ceca shema.html'))},()=>{
 const {spawnSync}=require('node:child_process');
 const out=path.join(require('node:os').tmpdir(),'ceca-plan-rerun-'+process.pid+'.js');
 try{
  const run=spawnSync('python3',[path.join(base,'tools','export-ceca-plan.py'),'','',out],{encoding:'utf8',timeout:120000});
  assert.equal(run.status,0,run.stderr);
  assert.ok(Buffer.compare(fs.readFileSync(out),fs.readFileSync(path.join(base,'ceca-plan-svg.js')))===0);
 }finally{fs.rmSync(out,{force:true});}
});
