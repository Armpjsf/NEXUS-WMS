import type { RackConfig } from './warehouseLayout';

/** Same Y-axis rotation convention as THREE.Group.rotation.y. */
export function rackFloorPoint(rack: Pick<RackConfig, 'posX' | 'posZ' | 'rotationY'>, alongBay: number, front: number): [number, number] {
  const angle = Number(rack.rotationY) || 0;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  return [rack.posX + alongBay * cos + front * sin,
    rack.posZ - alongBay * sin + front * cos];
}
