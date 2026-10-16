// tools/headless.cjs: сигнал по време на стартирането (профилът е вече направен, браузърът още не е
// върнат) и увиснало close() не оставят нито профил, нито процес.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const headless = require('../tools/headless.cjs');

function run(mode, waitFor) {
  const profile = path.join(os.tmpdir(), 'ceca-headless-test-' + process.pid + '-' + mode);
  headless.configure({ profile });
  return new Promise((resolve, reject) => {
    const child = cp.spawn(process.execPath, [path.join(__dirname, 'headless-fixture.cjs'), profile, mode], { stdio: ['ignore', 'pipe', 'inherit'] });
    let out = '';
    const guard = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('timeout: ' + out)); }, 20000);
    child.stdout.on('data', (chunk) => {
      out += chunk;
      if (out.includes(waitFor)) {
        // Профилът трябва да съществува и да има процес, преди сигналът да дойде.
        setTimeout(() => {
          const before = { dir: fs.existsSync(profile), pids: headless.profilePids().length };
          child.kill('SIGTERM');
          child.once('close', (code) => { clearTimeout(guard); resolve({ code, before, profile }); });
        }, 300);
        child.stdout.removeAllListeners('data');
      }
    });
  });
}

for (const [mode, waitFor, title] of [
  ['pending', 'starting', 'a signal while the browser is still launching'],
  ['hang', 'launched', 'a signal when close() hangs'],
]) {
  test(`${title} leaves no profile directory and no process`, async () => {
    const result = await run(mode, waitFor);
    assert.equal(result.code, 130);
    assert.equal(result.before.dir, true, 'the profile existed at signal time');
    assert.ok(result.before.pids >= 1, 'a browser process existed at signal time');
    assert.equal(fs.existsSync(result.profile), false);
    assert.deepEqual(headless.profilePids(), []);
  });
}
