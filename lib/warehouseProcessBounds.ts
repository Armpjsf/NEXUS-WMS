import type { WarehouseLayout } from './warehouseLayout';

/** Display bounds only. Never rescale racks or overwrite the saved building. */
export function getProcessBuildingBounds(layout: Partial<WarehouseLayout> | null) {
  const width = Math.max(1, Number(layout?.widthM) || 38);
  const length = Math.max(1, Number(layout?.lengthM) || 44);
  let minX = -width / 2, maxX = width / 2;
  let minZ = -length / 2, maxZ = length / 2;
  for (const rack of layout?.racks || []) {
    const span = Math.max(1, Math.floor(Number(rack.bays) || 1)) * (Number(rack.bayWidth) || 2.5);
    const depth = Number(rack.rackDepth) || 2;
    const angle = Number(rack.rotationY) || 0;
    const halfX = (Math.abs(span * Math.cos(angle)) + Math.abs(depth * Math.sin(angle))) / 2;
    const halfZ = (Math.abs(span * Math.sin(angle)) + Math.abs(depth * Math.cos(angle))) / 2;
    // Include the upright feet, not just the nominal rack footprint.
    const clearance = 0.15;
    minX = Math.min(minX, rack.posX - halfX - clearance);
    maxX = Math.max(maxX, rack.posX + halfX + clearance);
    minZ = Math.min(minZ, rack.posZ - halfZ - clearance);
    maxZ = Math.max(maxZ, rack.posZ + halfZ + clearance);
  }
  return { minX, maxX, minZ, maxZ, width: maxX - minX, length: maxZ - minZ,
    centerX: (minX + maxX) / 2, centerZ: (minZ + maxZ) / 2 };
}
