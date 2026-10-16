// Нивата на детайл на местата в изгледа (arena-seatview.js): пазачи на формата на кода,
// защото самият изглед иска WebGL. Числата са мерени в браузър (виж task_plan.md).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'arena-seatview.js'), 'utf8');

test('growing a wedge frees the uploaded instance buffer before the attribute is replaced', () => {
  // three r160 няма InstancedMesh.dispose(): без това събитие всяко нарастване оставя буфер във видеопамет.
  assert.match(source, /if \(mesh\.instanceMatrix\.count < ids\.length\) \{\s*(?:\/\/[^\n]*\n\s*)*mesh\.dispatchEvent\(\{ type: "dispose" \}\);\s*mesh\.instanceMatrix = new T\.InstancedBufferAttribute\(/);
  // Запас над нужното, за да е нарастването рядко.
  assert.match(source, /Math\.ceil\(ids\.length \* 1\.25\) \* 16/);
});

test('three levels of detail are re-applied for every viewpoint, near seats keep the full model', () => {
  assert.match(source, /const SEAT_LOD = \[\{ maxD: 12, wedges: 1 \}, \{ maxD: 30, wedges: 8 \}, \{ maxD: Infinity, wedges: 16 \}\]/);
  assert.match(source, /applySeatLod\(camera\.position\.x,camera\.position\.z\);\s*setDrinkOwn/);
  assert.match(source, /tier === 0 \? roundedBox\(w, h, d, r\)/);
});
