/**
 * Kitting & Bundling Engine (Bill of Materials - BOM)
 * Assembles child items into kits and handles disassembly.
 */

export interface BomComponent {
  componentSku: string;
  componentName: string;
  quantity: number;
  unit: string;
}

export interface BillOfMaterials {
  id: string;
  kitSku: string;
  kitName: string;
  version: string;
  components: BomComponent[];
  assemblyLaborCost: number;
  status: 'ACTIVE' | 'OBSOLETE';
}

export const initialBOMs: BillOfMaterials[] = [];

export function validateKitAssembly(
  bom: BillOfMaterials,
  buildQuantity: number,
  stockMap: Record<string, number>
): { canBuild: boolean; missingComponents: { sku: string; required: number; available: number }[] } {
  const missingComponents: { sku: string; required: number; available: number }[] = [];

  for (const comp of bom.components) {
    const required = comp.quantity * buildQuantity;
    const available = stockMap[comp.componentSku] || 0;
    if (available < required) {
      missingComponents.push({
        sku: comp.componentSku,
        required,
        available
      });
    }
  }

  return {
    canBuild: missingComponents.length === 0,
    missingComponents
  };
}
