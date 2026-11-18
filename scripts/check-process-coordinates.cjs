const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const THREE = require('three');
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/warehouseProcessCoordinates.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const output = { exports: {} };
new Function('exports', 'require', 'module', code)(output.exports, require, output);
const { rackFloorPoint } = output.exports;
for (const rotationY of [0, Math.PI / 2, Math.PI, Math.PI * 1.5, 0.37]) {
  const rack = { posX: -14.5, posZ: -2, rotationY };
  const group = new THREE.Group();
  group.position.set(rack.posX, 0, rack.posZ); group.rotation.y = rotationY;
  group.updateMatrixWorld(true);
  for (const along of [-6.75, -2.25, 2.25, 6.75]) {
    for (const front of [0, 2.1]) {
      const expected = group.localToWorld(new THREE.Vector3(along, 0, front));
      const actual = rackFloorPoint(rack, along, front);
      assert(Math.abs(actual[0] - expected.x) < 1e-9);
      assert(Math.abs(actual[1] - expected.z) < 1e-9);
    }
  }
}
const aisle = rackFloorPoint({ posX: -14.5, posZ: -2, rotationY: Math.PI / 2 }, -6.75, 2.1);
assert(Math.abs(aisle[0] + 12.4) < 1e-9);
assert(Math.abs(aisle[1] - 4.75) < 1e-9);
const distance = Math.hypot(aisle[0] + 6.5, aisle[1] - 18.5) + Math.hypot(-4 - aisle[0], 20.9 - aisle[1]);
assert.equal(Math.round(distance * 10) / 10, 33.2);
console.log('Process coordinates match Three.js at 5 rotations; A-008 route regression: 33.2m (straight-line estimate).');
