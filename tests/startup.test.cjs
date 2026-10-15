const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function boot(options = {}) {
 const events={}, scripts=[], timers=[];
 const status={hidden:false,textContent:''}, failure={hidden:true,focus(){}}, detail={textContent:''}, retry={}, alternative={hidden:true,href:''}, hint={textContent:''};
 const nodes={'startup-status':status,'startup-failure':failure,'startup-detail':detail,'startup-retry':retry,'startup-2d':alternative,'startup-hint':hint};
 const document={body:{children:[]},querySelectorAll:()=>options.sources || [{dataset:{src:'vendor.js?v=1'}},{dataset:{src:'app.js?v=2'}}],getElementById:id=>nodes[id],createElement:()=>({remove(){},getContext:options.getContext || (()=>({getExtension:()=>null}))}),head:{appendChild:s=>scripts.push(s)}};
 const window={addEventListener:(name,cb)=>events[name]=cb,location:{reload(){},href:options.url || 'https://example.test/'}};
 const context={window,document,URL,Date,console,setTimeout:cb=>(timers.push(cb),timers.length),clearTimeout(){}};
 vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, '../startup.js'),'utf8'),context);
 return {window,events,scripts,timers,status,failure,detail,alternative,hint};
}
test('failed dependency is retried before the app is started; repeat failure offers recovery',()=>{
 const b=boot(); assert.equal(b.scripts.length,1);
 b.scripts[0].onerror(); assert.equal(b.scripts.length,2);
 assert.match(b.scripts[1].src,/retry=/);
 b.scripts[1].onerror(); assert.equal(b.failure.hidden,false);
 assert.match(b.detail.textContent,/vendor.js/);
 assert.equal(b.scripts.length,2);
});

test('loading indicator waits for both application and rendered map',()=>{
 const b=boot(); b.scripts[0].onload(); assert.equal(b.scripts.length,2);
 b.window.SeatMapStartup.appReady(); assert.equal(b.status.hidden,false);
 b.window.SeatMapStartup.mapReady(); assert.equal(b.status.hidden,false);
 b.scripts[1].onload(); assert.equal(b.status.hidden,true);
});
test('startup exception exposes a usable recovery state',()=>{
 const b=boot(); b.failure.inert=true;
 b.events.error({message:'Failed to initialize WebGL'});
 assert.equal(b.failure.hidden,false); assert.equal(b.failure.inert,false);
 assert.match(b.detail.textContent,/WebGL/);
});
test('stalled graphics loading cannot stay gray indefinitely',()=>{
 const b=boot(); b.window.SeatMapStartup.appReady(); b.timers[0]();
 assert.equal(b.failure.hidden,false); assert.match(b.detail.textContent,/timeout/);
});

test('failure in the last dependency remains recoverable after map initialization',()=>{
 const b=boot(); b.scripts[0].onload();
 b.window.SeatMapStartup.appReady(); b.window.SeatMapStartup.mapReady();
 b.scripts[1].onerror(); b.scripts[2].onerror();
 assert.equal(b.failure.hidden,false);
});

test('graphics loss after startup can recover without reloading the selection',()=>{
 const b=boot(); b.scripts[0].onload(); b.scripts[1].onload();
 b.window.SeatMapStartup.appReady(); b.window.SeatMapStartup.mapReady();
 b.window.SeatMapStartup.graphicsLost(); assert.equal(b.status.hidden,false);
 b.window.SeatMapStartup.mapReady(); assert.equal(b.status.hidden,true);
 assert.equal(b.failure.hidden,true);
});
test('unrecovered graphics loss offers retry instead of an indefinitely blank map',()=>{
 const b=boot(); b.scripts[0].onload(); b.scripts[1].onload();
 b.window.SeatMapStartup.appReady(); b.window.SeatMapStartup.mapReady();
 b.window.SeatMapStartup.graphicsLost(); b.timers[1]();
 assert.equal(b.failure.hidden,false); assert.match(b.detail.textContent,/WebGL context lost/);
});

const graphicsSources = [
 {dataset:{src:'vendor/maplibre-gl.js?v=1',webgl:'true'}},
 {dataset:{src:'venue-data-arena.js?v=1'}},
 {dataset:{src:'arena-plan-svg.js?v=1',svg:'true'}},
 {dataset:{src:'map.js?v=1',fallback:'map-svg.js?v=1'}},
 {dataset:{src:'arena-seatview.js?v=1',webgl:'true'}},
 {dataset:{src:'app.js?v=1'}}
];
test('denied WebGL loads the functional SVG map and skips graphics-only dependencies',()=>{
 const b=boot({sources:graphicsSources,getContext:()=>null});
 assert.match(b.scripts[0].src,/venue-data/);
 b.scripts[0].onload(); assert.match(b.scripts[1].src,/arena-plan-svg/);
 b.scripts[1].onload(); assert.match(b.scripts[2].src,/map-svg/);
 b.scripts[2].onload(); assert.match(b.scripts[3].src,/app.js/);
 b.window.SeatMapStartup.appReady(); b.window.SeatMapStartup.mapReady(); b.scripts[3].onload();
 assert.equal(b.status.hidden,true); assert.equal(b.failure.hidden,true);
});
test('a blocked context API also falls back without a fatal startup screen',()=>{
 const b=boot({sources:graphicsSources,getContext:()=>{throw new Error('not allowed');}});
 assert.match(b.scripts[0].src,/venue-data/); assert.equal(b.failure.hidden,true);
});
test('WebGL1 remains enabled when only WebGL2 is denied',()=>{
 const b=boot({sources:graphicsSources,getContext:type=>type==='webgl'?{getExtension:()=>null}:null});
 assert.match(b.scripts[0].src,/vendor/);
 b.scripts[0].onload(); b.scripts[1].onload(); assert.match(b.scripts[2].src,/map.js/);
});
test('a graphics failure after probing offers the original 2D plan and preserves the current URL',()=>{
 const b=boot({url:'https://example.test/shema/?event=concert#selection'});
 b.events.error({message:'Failed to initialize WebGL'});
 assert.equal(b.alternative.hidden,false);
 assert.equal(b.alternative.href,'https://example.test/shema/?event=concert&view=2d#selection');
 assert.match(b.hint.textContent,/2D/);
});
test('a 2D download failure retains retry without offering the same failed mode again',()=>{
 const b=boot({sources:graphicsSources,url:'https://example.test/shema/?view=2d'});
 assert.match(b.scripts[0].src,/venue-data/);
 b.scripts[0].onerror(); b.scripts[1].onerror();
 assert.equal(b.failure.hidden,false);
 assert.equal(b.alternative.hidden,true);
});
