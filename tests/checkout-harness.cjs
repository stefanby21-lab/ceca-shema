// Помощник за тестовете (не е тест): checkout.js върху фалшив DOM.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const base = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(base, file), 'utf8');
function checkout(cart, venue = true) {
  const html = {};
  const element = (id) => new Proxy(function () {}, {
    get(target, key) {
      if (key === 'innerHTML') return html[id] || '';
      if (key === 'classList') return { toggle() {}, add() {}, remove() {} };
      if (key === 'style' || key === 'dataset') return {};
      if (key === 'querySelector') return () => element('child');
      if (key === 'querySelectorAll') return () => [];
      if (typeof key === 'symbol') return undefined;
      return target[key] || (() => {});
    },
    set(target, key, value) { if (key === 'innerHTML') html[id] = value; else target[key] = value; return true; },
  });
  const storage = new Map([['arena8888.checkout.cart.v1', JSON.stringify(cart)]]);
  const context = { console, setTimeout, clearTimeout, URLSearchParams, Intl, Number, Math, matchMedia: () => ({ matches: true }),
    location: { hostname: 'test', search: '' },
    sessionStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) },
    requestAnimationFrame: fn => fn(),
    document: { getElementById: id => element(id), querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, body: element('body'), activeElement: null },
  };
  context.window = context;
  context.window.addEventListener = () => {};
  vm.createContext(context);
  if (venue) vm.runInContext(read('venue-data-ceca.js'), context);
  vm.runInContext(read('checkout/checkout.js'), context);
  return { html, storage };
}
module.exports = { checkout, read };
