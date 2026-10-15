const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../checkout/index.html'), 'utf8');
const bootstrap = html.match(/<script>([\s\S]*?)<\/script>/)[1];
for (const [route, directory] of [
  ['/checkout', '/checkout/'],
  ['/checkout/', '/checkout/'],
  ['/checkout/index.html', '/checkout/'],
  ['/site/shema/checkout?restore=1', '/site/shema/checkout/'],
]) {
  test('checkout scripts and styles resolve from ' + route, () => {
    const location = new URL(route, 'https://arena.example');
    let base;
    const document = { createElement: () => ({}), head: { appendChild: el => { base = el.href; } } };
    vm.runInNewContext(bootstrap, { location, document });
    for (const file of ['checkout.js', 'checkout.css']) {
      assert.equal(new URL(file, base).href, 'https://arena.example' + directory + file);
    }
  });
}
