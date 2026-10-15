const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function boot(options = {}) {
 const events={}, scripts=[], timers=[];
 const status={hidden:false,textContent:''}, failure={hidden:true,focus(){}}, detail={textContent:''}, retry={}, alternative={hidden:true,href:''}, hint={textContent:''};
 const nodes={'startup-status':status,'startup-failure':failure,'startup-detail':detail,'startup-retry':retry,'startup-2d':alternative,'startup-hint':hint};
 const document={body:{children:[]},querySelectorAll:()=>options.sources || [{dataset:{src:'vendor.js?v=1'}},{dataset:{src:'app.js?v=2'}}],getElementById:id=>nodes[id],createElement:()=>({remove(){},getContext:options.getContext || (()=>({getExtension:()=>null}))}),head:{appendChild:s=>scripts.push(s)}};
 const store=options.store || {}, replaced=[];
 const window={addEventListener:(name,cb)=>events[name]=cb,location:{reload(){},replace:u=>replaced.push(u),href:options.url || 'https://example.test/'},sessionStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>{if(options.noStorage)throw new Error('blocked');store[k]=String(v);},removeItem:k=>{delete store[k];}}};
 const context={window,document,URL,Date,console,setTimeout:cb=>(timers.push(cb),timers.length),clearTimeout(){}};
 vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, '../startup.js'),'utf8'),context);
 return {window,events,scripts,timers,status,failure,detail,alternative,hint,replaced,store,retry};
}
test('failed dependency is retried before the app is started; repeat failure offers recovery',()=>{
 const b=boot({store:{'ceca.fallback2d.v1':'1'}}); assert.equal(b.scripts.length,1);
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
 const b=boot({url:'https://example.test/?view=2d'}); b.failure.inert=true;
 b.events.error({message:'Failed to initialize WebGL',filename:'https://example.test/map.js?v=1',lineno:12,colno:3});
 assert.equal(b.failure.hidden,false); assert.equal(b.failure.inert,false);
 assert.match(b.detail.textContent,/WebGL/); assert.match(b.detail.textContent,/map\.js:12:3/);
});
test('stalled graphics loading cannot stay gray indefinitely',()=>{
 const b=boot({url:'https://example.test/?view=2d'}); b.window.SeatMapStartup.appReady(); b.timers[0]();
 assert.equal(b.failure.hidden,false); assert.match(b.detail.textContent,/timeout/);
});

test('failure in the last dependency remains recoverable after map initialization',()=>{
 const b=boot({url:'https://example.test/?view=2d'}); b.scripts[0].onload();
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
 const b=boot({store:{'ceca.fallback2d.v1':'1'}}); b.scripts[0].onload(); b.scripts[1].onload();
 b.window.SeatMapStartup.appReady(); b.window.SeatMapStartup.mapReady();
 b.window.SeatMapStartup.graphicsLost(); b.timers[1]();
 assert.equal(b.failure.hidden,false); assert.match(b.detail.textContent,/WebGL context lost/);
});

const graphicsSources = [
 {dataset:{src:'vendor/maplibre-gl.js?v=1',webgl:'true'}},
 {dataset:{src:'venue-data-ceca.js?v=1'}},
 {dataset:{src:'ceca-plan-svg.js?v=1',svg:'true'}},
 {dataset:{src:'map.js?v=1',fallback:'map-svg.js?v=1'}},
 {dataset:{src:'arena-seatview.js?v=1',webgl:'true'}},
 {dataset:{src:'app.js?v=1'}}
];
test('denied WebGL loads the functional SVG map and skips graphics-only dependencies',()=>{
 const b=boot({sources:graphicsSources,getContext:()=>null});
 assert.match(b.scripts[0].src,/venue-data/);
 b.scripts[0].onload(); assert.match(b.scripts[1].src,/ceca-plan-svg/);
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
 const b=boot({url:'https://example.test/shema/?event=concert#selection',store:{'ceca.fallback2d.v1':'1'}});
 b.events.error({message:'Failed to initialize WebGL',filename:'https://example.test/map.js?v=1',lineno:12,colno:3});
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

const own=(extra)=>Object.assign({message:'x is not a function',filename:'https://example.test/app.js?v=3',lineno:41,colno:7},extra);
test('"Script error." with an empty filename (WebKit, injected scripts) is ignored',()=>{
 const b=boot({url:'https://example.test/?view=2d'});
 b.events.error({message:'Script error.',filename:'',lineno:0,colno:0});
 b.events.error({message:'Script error.',filename:'https://example.test/app.js',lineno:9});
 assert.equal(b.failure.hidden,true); assert.deepEqual(b.replaced,[]);
});
test('an error from another origin is ignored; an own-origin error without a line is ignored',()=>{
 const b=boot({url:'https://example.test/?view=2d'});
 b.events.error(own({filename:'https://cdn.other.test/inject.js'}));
 b.events.error(own({filename:'webkit-masked-url://hidden/'}));
 b.events.error(own({lineno:0}));
 assert.equal(b.failure.hidden,true);
});
test('an own-origin error with a line is fatal, and the detail names file, line and column',()=>{
 const b=boot({url:'https://example.test/?view=2d'});
 b.events.error(own());
 assert.equal(b.failure.hidden,false); assert.match(b.detail.textContent,/app\.js:41:7/);
});
test('rejections: only those whose stack names our origin are fatal',()=>{
 const b=boot({url:'https://example.test/?view=2d'});
 b.events.unhandledrejection({reason:{message:'boom',stack:'Error: boom\n at https://brave-shields.invalid/x.js:1:1'}});
 b.events.unhandledrejection({reason:'plain string'});
 b.events.unhandledrejection({reason:null});
 assert.equal(b.failure.hidden,true);
 b.events.unhandledrejection({reason:{message:'ours',stack:'Error: ours\n at https://example.test/ui.js?v=1:5:2'}});
 assert.equal(b.failure.hidden,false);
});
test('a fatal error on the WebGL path switches once to the SVG plan instead of the error screen',()=>{
 const b=boot(); b.events.error(own());
 assert.equal(b.replaced.length,1); assert.match(b.replaced[0],/view=2d/);
 assert.equal(b.failure.hidden,true); assert.equal(b.store['ceca.fallback2d.v1'],'1');
});
test('the timeout and a lost WebGL context also fall back; the flag prevents a loop',()=>{
 const t=boot(); t.window.SeatMapStartup.appReady(); t.timers[0](); assert.equal(t.replaced.length,1);
 // Втори провал в същата сесия: екранът с грешка, без нов преход.
 const again=boot({store:t.store}); again.events.error(own());
 assert.equal(again.replaced.length,0); assert.equal(again.failure.hidden,false);
 // Блокирано хранилище: не се върти, показва се грешката.
 const blocked=boot({noStorage:true}); blocked.events.error(own());
 assert.equal(blocked.replaced.length,0); assert.equal(blocked.failure.hidden,false);
 // Провал вече на самия 2D път: екран с грешка.
 const flat=boot({url:'https://example.test/?view=2d'}); flat.events.error(own());
 assert.equal(flat.replaced.length,0); assert.equal(flat.failure.hidden,false);
});
test('the retry button clears the fallback flag',()=>{
 const b=boot({store:{'ceca.fallback2d.v1':'1'}}); b.retry.onclick();
 assert.equal(b.store['ceca.fallback2d.v1'],undefined);
});
