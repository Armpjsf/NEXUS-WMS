// Regression: a 12m-wide saved floor may contain racks placed at X +/-14m.
// Validate wall containment using independently transformed rack corners.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const code = ts.transpileModule(fs.readFileSync(path.join(root, 'lib/warehouseProcessBounds.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const output = { exports: {} };
new Function('exports', 'require', 'module', code)(output.exports, require, output);
const { getProcessBuildingBounds } = output.exports;
const racks = [
  { posX: 0, posZ: -14.5, rotationY: 0 },
  { posX: -14.5, posZ: -2, rotationY: Math.PI / 2 },
  { posX: 14, posZ: -2, rotationY: Math.PI * 1.5 },
].map(r => ({ ...r, bays: 4, bayWidth: 4.5, rackDepth: 1.5 }));
const layout = { widthM: 12, lengthM: 30, racks };
const snapshot = JSON.stringify(layout);
const bounds = getProcessBuildingBounds(layout);
for (const r of racks) {
  for (const x of [-r.bays * r.bayWidth / 2, r.bays * r.bayWidth / 2]) {
    for (const z of [-r.rackDepth / 2, r.rackDepth / 2]) {
      const wx = r.posX + x * Math.cos(r.rotationY) + z * Math.sin(r.rotationY);
      const wz = r.posZ - x * Math.sin(r.rotationY) + z * Math.cos(r.rotationY);
      assert(wx > bounds.minX && wx < bounds.maxX, 'Side wall intersects rack');
      assert(wz > bounds.minZ && wz < bounds.maxZ, 'End wall intersects rack');
    }
  }
}
assert.equal(JSON.stringify(layout), snapshot, 'Saved layout must remain unchanged');
assert.equal(bounds.centerX, (bounds.minX + bounds.maxX) / 2, 'Asymmetric floor must be centred correctly');
const empty = getProcessBuildingBounds({ widthM: 12, lengthM: 30, racks: [] });
assert.deepEqual([empty.minX, empty.maxX, empty.minZ, empty.maxZ], [-6, 6, -15, 15]);
assert(getProcessBuildingBounds(null).width > 0);
console.log('Process bounds regression passed: saved floor, rotated racks, asymmetric bounds and immutability.');
