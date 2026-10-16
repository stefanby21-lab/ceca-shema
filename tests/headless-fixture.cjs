'use strict';
// Помощник на tests/headless.test.cjs (не е тест): стартира tools/headless.cjs с лъжлив браузър -
// истински процес, който носи --user-data-dir=<профил> - и чака сигнал.
const fs = require('node:fs');
const cp = require('node:child_process');
const { configure, launchSession } = require('../tools/headless.cjs');

const [profile, mode] = process.argv.slice(2);
configure({
  profile,
  closeTimeoutMs: 500,
  launcher: async (dir) => {
    fs.mkdirSync(dir, { recursive: true });
    const child = cp.spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)', '--', '--user-data-dir=' + dir], { detached: true, stdio: 'ignore' });
    child.unref();
    await new Promise((resolve) => setTimeout(resolve, mode === 'pending' ? 1500 : 100));
    return { close: () => new Promise(() => {}) }; // close() увисва: остава само убиването по профила
  },
});
console.log('starting');
launchSession().then(() => console.log('launched'), (error) => { console.error(error); process.exit(1); });
setInterval(() => {}, 1000);
