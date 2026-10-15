const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const base = path.join(__dirname, '..');
function app(saved) {
  const state = { picks: [], notices: [] };
  const storage = new Map();
  if(saved)storage.set("arena8888.selection.draft.v1",JSON.stringify(saved));
  const noop = () => {};
  const context = { console, URLSearchParams, setTimeout, matchMedia: () => ({ matches: false }),
    location: { hostname: 'test', search: '', pathname: '/' },
    history: { replaceState: noop }, sessionStorage: { getItem: k => storage.get(k), setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k) },
    document: { readyState: 'complete', getElementById: () => null, querySelector: () => null },
    MutationObserver: class { observe() {} disconnect() {} },
    CustomEvent: class { constructor(name, options) { this.type=name; this.detail=options.detail; } },
  };
  context.window = { location: context.location, matchMedia: context.matchMedia, addEventListener: noop, dispatchEvent: noop };
  vm.createContext(context);
  for (const file of ['venue-data-ceca.js','seatfinder.js']) vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),context);
  const ui = { openGate: options => state.gate=options, renderFilterBar: (_,handlers) => state.filters=handlers,
    showPicks: (picks,handlers) => { state.picks=Array.from(picks,p=>p.mk); state.picksHandlers=handlers; },
    notify: notice => state.notices.push(notice) };
  context.window.UI = new Proxy(ui,{get:(obj,key)=>obj[key] || noop});
  context.window.SeatMap = new Proxy({init: options => { state.map=options; return { getZoom: () => 20 }; }},{get:(obj,key)=>obj[key] || noop});
  vm.runInContext(fs.readFileSync(path.join(base,'app.js'),'utf8'),context);
  return { state, window: context.window, storage };
}
test('two recommended seats can be cleared, manually reselected and moved as a pair', () => {
  const {state,window}=app();
  state.gate.onApply({quantity:2});
  const first=state.picks.slice();
  assert.equal(first.length,2);
  state.picksHandlers.onClearAll();
  assert.equal(state.picks.length,0);
  state.map.onSeatClick(first[0]);
  assert.equal(state.picks.length,2);
  assert.ok(state.picks.includes(first[0]));
  const other=window.SeatFinder.find({partySize:2,topK:1000}).find(g=>g.mks.every(mk=>!state.picks.includes(mk)));
  state.map.onSeatClick(other.mks[0]);
  assert.equal(state.picks.length,2);
  assert.ok(state.picks.includes(other.mks[0]));
  state.picksHandlers.onRemove(state.picks[0]);
  assert.equal(state.picks.length,0);
  state.map.onSeatClick(first[0]);
  assert.equal(state.picks.length,2);
});
test('manual groups honour quantity 1–10, and unavailable seats leave selection intact', () => {
  const {state,window}=app();
  for(let quantity=1;quantity<=10;quantity++) {
    state.gate.onApply({quantity});
    const anchor=state.picks[0];
    state.picksHandlers.onClearAll();
    state.map.onSeatClick(anchor);
    assert.equal(state.picks.length,quantity);
    assert.ok(state.picks.includes(anchor));
  }
  const before=state.picks.slice();
  const unavailable=window.VENUE.seats.features.find(f=>f.properties.offsale || f.properties.sold);
  state.map.onSeatClick(unavailable.properties.mk);
  assert.deepEqual(state.picks,before);
});
test('manual group never crosses aisles, blocked seats or active price/category filters', () => {
  const {window}=app();
  const features=Array.from({length:10},(_,i)=>({properties:{mk:String(i),s:'A',r:1,t:i,eur:i===6?75:40,tier:i===7?1:0,sold:i===3,offsale:i===4,obstructed:i===8},geometry:{coordinates:[i,0]}}));
  window.SeatFinder.init({seats:{features},adjacency:{runs:[[0,1,2,3,4],[5,6,7,8,9]]}});
  const options={partySize:2};
  assert.deepEqual(Array.from(window.SeatFinder.findAround('2',options)),[]);
  assert.deepEqual(Array.from(window.SeatFinder.findAround('5',{...options,price:{max:50}})),[]);
  assert.deepEqual(Array.from(window.SeatFinder.findAround('7',{...options,tiers:[0]})),[]);
  assert.deepEqual(Array.from(window.SeatFinder.findAround('9',{...options,excludeObstructed:true})),[]);
  assert.deepEqual(Array.from(window.SeatFinder.findAround('4',options)),[]);
});
test('tapping a selected group clears it and a whole table can be combined with a pair up to ten tickets', () => {
  const {state,window}=app();
  state.gate.onApply({quantity:2});
  const pair=state.picks.slice();
  state.map.onSeatClick(pair[0]);
  assert.deepEqual(state.picks,[]);
  const table=window.VENUE.tables.features.find(f=>!f.properties.sold && !f.properties.offsale);
  state.map.onTableClick(table.properties.mk);
  const before=state.picks.slice();
  state.map.onSeatClick(pair[0]);
  assert.equal(state.picks.length,3);
  assert.ok(state.picks.includes(before[0]));
});
test('ten seats are allowed and an eleventh is rejected', () => {
  const {state,window}=app();
  state.gate.onApply({quantity:10});
  assert.equal(state.picks.length,10);
  state.filters.onQuantityPick(1);
  const extra=window.VENUE.seats.features.find(f=>!state.picks.includes(f.properties.mk) && !f.properties.sold && !f.properties.offsale && f.properties.eur>0);
  state.map.onSeatClick(extra.properties.mk);
  assert.equal(state.picks.length,10);
  assert.match(state.notices.at(-1).text,/най-много 10/);
});
test('eight out of nine free seats cannot isolate the ninth; ten out of twelve can', () => {
  const {window}=app();
  const setup=n=>window.SeatFinder.init({seats:{features:Array.from({length:n},(_,i)=>({properties:{mk:String(i),s:'A',r:1,t:i,eur:40,tier:0},geometry:{coordinates:[i,0]}}))},adjacency:{runs:[Array.from({length:n},(_,i)=>i)]}});
  setup(9);
  assert.equal(window.SeatFinder.leavesIsolatedSeat(['0','1','2','3','4','5','6','7']),true);
  assert.deepEqual(Array.from(window.SeatFinder.findAround('0',{partySize:8})),[]);
  setup(12);
  assert.equal(window.SeatFinder.leavesIsolatedSeat(Array.from({length:10},(_,i)=>String(i))),false);
  assert.equal(window.SeatFinder.leavesIsolatedSeat(Array.from({length:10},(_,i)=>String(i+1))),true);
});
test('category boundaries do not falsely create physical orphan seats',()=>{
 const {window}=app();
 window.SeatFinder.init({seats:{features:Array.from({length:5},(_,i)=>({properties:{mk:String(i),s:'A',r:1,t:i,eur:40,tier:i<3?0:1},geometry:{coordinates:[i,0]}}))},adjacency:{runs:[[0,1,2,3,4]]}});
 assert.deepEqual(Array.from(window.SeatFinder.findAround('0',{partySize:2,tiers:[0]})),['0','1']);
 assert.ok(window.SeatFinder.find({partySize:2,tiers:[0]}).some(g=>g.mks.join(',')==='0,1'));
});
test('checkout rejects Cyrillic and malformed email addresses, while accepting ordinary Latin addresses',()=>{
 const source=fs.readFileSync(path.join(base,'checkout/checkout.js'),'utf8');
 const body=source.slice(source.indexOf('  function contactErrors()'),source.indexOf('  function markContactErrors('));
 const context={state:{contact:{firstName:'Test',lastName:'Visitor',phone:'888123456'}}};vm.createContext(context);vm.runInContext(body,context);
 for(const email of ['иван@example.com','ivan@пример.com','ivan@example.бг','a..b@example.com','.ivan@example.com','ivan.@example.com','ivan@-example.com']){
  context.state.contact.email=email;assert.ok(context.contactErrors().email,email);
 }
 for(const email of ['ivan@example.com','ivan.petrov+arena@example.co.uk']){
  context.state.contact.email=email;assert.equal(context.contactErrors().email,undefined,email);
 }
});

test('a table (6 tickets) and two seats survive restoration without exceeding ten tickets',()=>{
 const first=app(); first.state.gate.onApply({quantity:2});
 const pair=first.state.picks.slice();first.state.picksHandlers.onClearAll();
 const table=first.window.VENUE.tables.features.find(f=>!f.properties.sold && !f.properties.offsale);
 first.state.map.onTableClick(table.properties.mk);first.state.map.onSeatClick(pair[0]);first.window.__onBuy();
 const cart=JSON.parse(first.storage.get('arena8888.checkout.cart.v1'));
 assert.equal(cart.ticketCount,8);
 assert.equal(cart.items.find(item=>item.type==='table').quantity,6);
 const restored=app(cart);assert.equal(restored.state.picks.length,3);
 assert.ok(restored.state.picks.includes(table.properties.mk));
});

test('a table counts as its six seats: table plus four seats is ten, a fifth seat is rejected',()=>{
 const {state,window}=app();
 const table=window.VENUE.tables.features.find(f=>!f.properties.sold && !f.properties.offsale);
 assert.equal(table.properties.seats,6);
 state.gate.onApply({quantity:4});
 assert.equal(state.picks.length,4);
 state.map.onTableClick(table.properties.mk);
 assert.equal(state.picks.length,5);
 assert.ok(state.picks.includes(table.properties.mk));
 state.filters.onQuantityPick(1);
 const extra=window.VENUE.seats.features.find(f=>!state.picks.includes(f.properties.mk) && !f.properties.sold && !f.properties.offsale && f.properties.eur>0);
 state.map.onSeatClick(extra.properties.mk);
 assert.equal(state.picks.length,5);
 assert.match(state.notices.at(-1).text,/най-много 10/);
 assert.match(state.notices.at(-1).text,/6 души/);
});
test('a table cannot be added once the order already holds five seats',()=>{
 const {state,window}=app();
 state.gate.onApply({quantity:5});
 const before=state.picks.slice();
 const table=window.VENUE.tables.features.find(f=>!f.properties.sold && !f.properties.offsale);
 state.map.onTableClick(table.properties.mk);
 assert.deepEqual(state.picks,before);
 assert.match(state.notices.at(-1).text,/най-много 10/);
});
