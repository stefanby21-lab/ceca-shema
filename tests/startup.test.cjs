const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function boot(options = {}) {
 const events={}, scripts=[], timers=[];
 const status={hidden:false,textContent:''}, failure={hidden:true,focus(){}}, detail={textContent:''}, retry={}, alternative={hidden:true,href:''}, hint={textContent:''};
 const nodes={'startup-status':status,'startup-failure':failure,'startup-detail':detail,'startup-retry':retry,'startup-2d':alternative,'startup-hint':hint,'startup-try3d':options.try3d,'map-boot':options.mapBoot,'map':options.pane};
 const document={body:{children:[]},querySelectorAll:()=>options.sources || [{dataset:{src:'vendor.js?v=1'}},{dataset:{src:'app.js?v=2'}}],getElementById:id=>nodes[id],createElement:()=>({remove(){},getContext:options.getContext || (()=>({getExtension:()=>null}))}),head:{appendChild:s=>scripts.push(s)}};
 const store=options.store || {}, replaced=[];
 const window={matchMedia:options.matchMedia,addEventListener:(name,cb)=>events[name]=cb,location:{reload(){},replace:u=>replaced.push(u),href:options.url || 'https://example.test/'},sessionStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>{if(options.noStorage)throw new Error('blocked');store[k]=String(v);},removeItem:k=>{delete store[k];}}};
 const context={window,document,URL,Date,console,setTimeout:cb=>(timers.push(cb),timers.length),clearTimeout(){}};
 vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, '../startup.js'),'utf8'),context);
 return {window,events,scripts,timers,status,failure,detail,alternative,hint,replaced,store,retry};
}
// Пазачът срещу цикъл: време и адресът, от който се е паднало (без view, fallback, retry и хеш).
const guard=(from,age=0)=>JSON.stringify({t:Date.now()-age,from:from||'https://example.test/'});
const KEY='ceca.fallback2d.v1';
test('failed dependency is retried before the app is started; repeat failure offers recovery',()=>{
 const b=boot({store:{[KEY]:guard()}}); assert.equal(b.scripts.length,1);
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
 const b=boot({store:{[KEY]:guard()}}); b.scripts[0].onload(); b.scripts[1].onload();
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
 const b=boot({url:'https://example.test/shema/?event=concert#selection',store:{[KEY]:guard('https://example.test/shema/?event=concert')}});
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
 b.events.error({message:'Script error.',filename:undefined});
 assert.equal(b.failure.hidden,true); assert.deepEqual(b.replaced,[]);
});
test('an error from another origin or a masked file is ignored',()=>{
 const b=boot({url:'https://example.test/?view=2d'});
 b.events.error(own({filename:'https://cdn.other.test/inject.js'}));
 b.events.error(own({filename:'webkit-masked-url://hidden/'}));
 assert.equal(b.failure.hidden,true);
});
test('an own-origin error is fatal even without a line number',()=>{
 const b=boot({url:'https://example.test/?view=2d'});
 b.events.error(own({lineno:0,colno:0}));
 assert.equal(b.failure.hidden,false); assert.match(b.detail.textContent,/x is not a function/);
 const c=boot({url:'https://example.test/?view=2d'});
 c.events.error({message:'Script error.',filename:'https://example.test/app.js'});
 assert.equal(c.failure.hidden,false);
});
test('explicit startup failures show the error screen for any reason, with or without a stack',()=>{
 for (const [reason,pattern] of [[{code:7,why:'no stack'},/no stack/],[undefined,/undefined/],[42,/42/],['plain text',/plain text/],[new Error('init broke'),/init broke/],[null,/null/]]) {
  const b=boot({url:'https://example.test/?view=2d'});
  b.window.SeatMapStartup.fail(reason);
  assert.equal(b.failure.hidden,false); assert.match(b.detail.textContent,pattern);
 }
});
test('a foreign rejection without a stack is still ignored by the global handler',()=>{
 const b=boot({url:'https://example.test/?view=2d'});
 b.events.unhandledrejection({reason:{message:'no stack here'}});
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
 assert.equal(b.failure.hidden,true);
 const saved=JSON.parse(b.store[KEY]); assert.equal(saved.from,'https://example.test/'); assert.ok(Math.abs(Date.now()-saved.t)<5000);
 assert.equal(new URL(b.replaced[0]).searchParams.get('fallback'),'1');
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
test('the guard belongs to one attempt: it expires and it is tied to the page it fell back from',()=>{
 // Прясно паднала страница: не се върти.
 const fresh=boot({store:{[KEY]:guard()}}); fresh.events.error(own());
 assert.equal(fresh.replaced.length,0); assert.equal(fresh.failure.hidden,false);
 // След 2 минути същият адрес пак може да се възстанови.
 const old=boot({store:{[KEY]:guard('https://example.test/',3*60*1000)}}); old.events.error(own());
 assert.equal(old.replaced.length,1);
 // Друг адрес в същата сесия не е блокиран от чужд опит.
 const other=boot({url:'https://example.test/?event=other',store:{[KEY]:guard('https://example.test/?event=concert')}}); other.events.error(own());
 assert.equal(other.replaced.length,1);
 // Остарял формат ('1') и повреден запис не блокират нищо.
 for (const junk of ['1','{','null','{"t":"x"}']) { const j=boot({store:{[KEY]:junk}}); j.events.error(own()); assert.equal(j.replaced.length,1,junk); }
 // Часовник назад (запис от бъдещето) не блокира.
 const future=boot({store:{[KEY]:guard('https://example.test/',-60000)}}); future.events.error(own());
 assert.equal(future.replaced.length,1);
});
test('the retry button clears the guard and the automatically added 2D mode, keeping other parameters',()=>{
 const b=boot({url:'https://example.test/s/?view=2d&fallback=1&event=concert#selection',store:{[KEY]:guard('https://example.test/s/?event=concert')}}); b.retry.onclick();
 assert.equal(b.store[KEY],undefined);
 const url=new URL(b.window.location.href);
 assert.equal(url.searchParams.get('view'),null); assert.equal(url.searchParams.get('fallback'),null);
 assert.equal(url.searchParams.get('event'),'concert'); assert.ok(url.searchParams.get('retry')); assert.equal(url.hash,'#selection');
 // Ръчно избран 2D остава 2D.
 const manual=boot({url:'https://example.test/?view=2d'}); manual.retry.onclick();
 assert.equal(new URL(manual.window.location.href).searchParams.get('view'),'2d');
});
test('after an automatic fallback a small control returns to 3D; a manual 2D does not show it',()=>{
 const button={hidden:true};
 const auto=boot({url:'https://example.test/s/?view=2d&fallback=1&event=concert#selection',try3d:button,store:{[KEY]:guard('https://example.test/s/?event=concert')}});
 assert.equal(button.hidden,false); button.onclick();
 assert.equal(auto.store[KEY],undefined);
 const url=new URL(auto.window.location.href);
 assert.equal(url.searchParams.get('view'),null); assert.equal(url.searchParams.get('fallback'),null);
 assert.equal(url.searchParams.get('retry'),null); assert.equal(url.searchParams.get('event'),'concert');
 const hidden={hidden:true};
 boot({url:'https://example.test/?view=2d',try3d:hidden}); assert.equal(hidden.hidden,true);
 const plain={hidden:true};
 boot({url:'https://example.test/',try3d:plain}); assert.equal(plain.hidden,true);
});

// Моментална картинка (#map-boot): фалшив елемент със същите куки, които ползва startup.js.
function fakeBoot() {
 const attrs={'data-plan-desktop':'assets/plan-d.webp?v=1','data-plan-desktop-size':'1040x836','data-plan-mobile':'assets/plan-m.webp?v=1','data-plan-mobile-size':'780x1298'};
 const source={attrs:{srcset:'assets/map-m.webp?v=1',width:'780',height:'1298'},setAttribute(k,v){this.attrs[k]=String(v);},getAttribute(k){return this.attrs[k];}};
 const img={attrs:{src:'assets/map-d.webp?v=1',width:'1440',height:'836'},setAttribute(k,v){this.attrs[k]=String(v);},getAttribute(k){return this.attrs[k];}};
 const picture={querySelector:sel=>sel==='source'?source:null};
 const classes=new Set(), listeners={};
 const el={source,img,classes,listeners,removed:false,parentNode:null,
  querySelector:sel=>sel==='picture'?picture:sel==='img'?img:null,
  getAttribute:k=>attrs[k],classList:{add:c=>classes.add(c)},
  addEventListener:(n,cb)=>{listeners[n]=cb;},
  parentNode:{removeChild(){el.removed=true;el.parentNode=null;}}};
 return el;
}
const pane=()=>{const p={cls:new Set()};p.classList={add:c=>p.cls.add(c)};return p;};
test('with WebGL the HTML preview stays as it is and the pane keeps its normal layout',()=>{
 const mapBoot=fakeBoot(), p=pane();
 boot({mapBoot,pane:p});
 assert.equal(mapBoot.img.attrs.src,'assets/map-d.webp?v=1'); assert.equal(mapBoot.source.attrs.srcset,'assets/map-m.webp?v=1');
 assert.equal(p.cls.size,0);
});
test('without WebGL (or with ?view=2d) the plan previews replace the map previews, sizes included, and the pane takes SVG layout at once',()=>{
 for (const options of [{getContext:()=>null},{url:'https://example.test/?view=2d'}]) {
  const mapBoot=fakeBoot(), p=pane();
  boot(Object.assign({mapBoot,pane:p},options));
  assert.equal(mapBoot.img.attrs.src,'assets/plan-d.webp?v=1'); assert.equal(mapBoot.img.attrs.width,'1040'); assert.equal(mapBoot.img.attrs.height,'836');
  assert.equal(mapBoot.source.attrs.srcset,'assets/plan-m.webp?v=1'); assert.equal(mapBoot.source.attrs.width,'780'); assert.equal(mapBoot.source.attrs.height,'1298');
  assert.ok(p.cls.has('map-svg'));
 }
});
test('a missing or malformed preview never breaks startup',()=>{
 const b=boot({getContext:()=>null}); assert.equal(b.failure.hidden,true);
 const broken=fakeBoot(); broken.getAttribute=()=>'nonsense'; const c=boot({mapBoot:broken,getContext:()=>null});
 assert.equal(c.failure.hidden,true); assert.equal(broken.img.attrs.src,'assets/map-d.webp?v=1');
});
test('when the map is ready the preview fades out over its own transition and is then removed',()=>{
 const mapBoot=fakeBoot(), b=boot({mapBoot,matchMedia:()=>({matches:false})});
 b.scripts[0].onload(); b.scripts[1].onload();
 b.window.SeatMapStartup.appReady(); b.window.SeatMapStartup.mapReady();
 assert.equal(mapBoot.classes.has('is-leaving'),true); assert.equal(mapBoot.removed,false);
 mapBoot.listeners.transitionend(); assert.equal(mapBoot.removed,true);
 // Резервният таймер не пречи, ако transitionend не дойде.
 const slow=fakeBoot(), s=boot({mapBoot:slow,matchMedia:()=>({matches:false})});
 s.scripts[0].onload(); s.scripts[1].onload(); s.window.SeatMapStartup.appReady(); s.window.SeatMapStartup.mapReady();
 assert.equal(slow.removed,false); s.timers[s.timers.length-1](); assert.equal(slow.removed,true);
});
test('it is not removed before everything is ready',()=>{
 const mapBoot=fakeBoot(), b=boot({mapBoot,matchMedia:()=>({matches:false})});
 b.window.SeatMapStartup.appReady(); b.window.SeatMapStartup.mapReady();
 assert.equal(mapBoot.classes.has('is-leaving'),false); assert.equal(mapBoot.removed,false);
});
test('reduced motion removes the preview at once, without a fade',()=>{
 const mapBoot=fakeBoot(), b=boot({mapBoot,matchMedia:q=>({matches:/reduce/.test(q)})});
 b.scripts[0].onload(); b.scripts[1].onload(); b.window.SeatMapStartup.appReady(); b.window.SeatMapStartup.mapReady();
 assert.equal(mapBoot.removed,true); assert.equal(mapBoot.classes.has('is-leaving'),false);
});
test('a startup failure removes the preview immediately so the error screen is not covered',()=>{
 const mapBoot=fakeBoot(), b=boot({mapBoot,url:'https://example.test/?view=2d'});
 b.window.SeatMapStartup.fail('boom'); assert.equal(mapBoot.removed,true); assert.equal(b.failure.hidden,false);
});
