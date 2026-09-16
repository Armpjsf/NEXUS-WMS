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

export const initialBOMs: BillOfMaterials[] = [
  {
    id: 'bom-001',
    kitSku: 'KIT-SOLAR-PRO-01',
    kitName: 'ชุดเซ็ตติดตั้งโซล่าร์เซลล์ครบวงจร Pro 5kW',
    version: '1.0',
    assemblyLaborCost: 250,
    status: 'ACTIVE',
    components: [
      { componentSku: 'SKU-SOLAR-5K', componentName: 'Heavy Duty Solar Inverter 5kW', quantity: 1, unit: 'เครื่อง' },
      { componentSku: 'SKU-ELEC-006', componentName: 'สายไฟ VCT 2x2.5 SQ.MM. (100 เมตร)', quantity: 2, unit: 'ม้วน' }
    ]
  },
  {
    id: 'bom-002',
    kitSku: 'KIT-HEALTH-GIFT-2026',
    kitName: 'กระเช้าเพื่อสุขภาพพรีเมียมปี 2026',
    version: '1.2',
    assemblyLaborCost: 80,
    status: 'ACTIVE',
    components: [
      { componentSku: 'SKU-BEV-002', componentName: 'นมสดพาสเจอร์ไรส์ 100%', quantity: 4, unit: 'ขวด' },
      { componentSku: 'SKU-PROD-001', componentName: 'พาราเซตามอล 500mg (กล่อง)', quantity: 2, unit: 'กล่อง' }
    ]
  }
];

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
