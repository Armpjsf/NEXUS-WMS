// AI assistant tools — read-only functions the Gemini model can call to answer
// questions over the *entire* live warehouse (not just a sample). Each tool
// reuses the existing data layer (org-scoped, service-role) and returns compact
// JSON so the model can reason accurately.

import { getProducts, getTransactions } from '@/lib/data/wms';
import { getInventoryValuation } from '@/lib/data/valuation';
import { listOrders, getPendingFulfillment, ORDER_FLOW } from '@/lib/data/orders';
import { getCustomers } from '@/lib/data/customers';
import { getCarriers } from '@/lib/data/carriers';
import { getSuppliers } from '@/lib/data/suppliers';

// ---- Gemini function declarations (the "menu" the model sees) ----
export const AI_TOOL_DECLARATIONS = [
  {
    name: 'search_products',
    description: 'ค้นหาสินค้าในคลังทั้งหมดด้วยชื่อ/รหัส SKU/หมวดหมู่/ตำแหน่ง คืนรายการที่ตรง พร้อมสต็อกคงเหลือ ตำแหน่ง ราคา',
    parameters: {
      type: 'OBJECT',
      properties: { query: { type: 'STRING', description: 'คำค้น เช่น ชื่อสินค้า รหัส หรือหมวด' } },
      required: ['query'],
    },
  },
  {
    name: 'inventory_summary',
    description: 'ภาพรวมคลัง: จำนวน SKU, จำนวนชิ้นรวม, มูลค่าสต็อก (ทุน/ขาย), กำไรประมาณ, จำนวนของใกล้หมด/หมดสต็อก, dead stock',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'low_stock',
    description: 'รายการสินค้าที่ต้องสั่งเติม (สต็อกคงเหลือ ≤ ขั้นต่ำ)',
    parameters: { type: 'OBJECT', properties: { limit: { type: 'NUMBER', description: 'จำนวนสูงสุด (ค่าเริ่มต้น 30)' } } },
  },
  {
    name: 'out_of_stock',
    description: 'รายการสินค้าที่หมดสต็อก (คงเหลือ 0)',
    parameters: { type: 'OBJECT', properties: { limit: { type: 'NUMBER' } } },
  },
  {
    name: 'expiring_soon',
    description: 'สินค้าที่ใกล้หมดอายุภายใน N วัน (FEFO) พร้อม lot และวันหมดอายุ',
    parameters: {
      type: 'OBJECT',
      properties: { days: { type: 'NUMBER', description: 'ช่วงวันข้างหน้า (ค่าเริ่มต้น 30)' } },
    },
  },
  {
    name: 'orders_summary',
    description: 'สรุปจำนวนออเดอร์แยกตามสถานะ (NEW/PICKING/PICKED/PACKED/SHIPPED/DELIVERED/CANCELLED) และงานค้างหยิบ/แพ็ก',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'list_orders',
    description: 'รายการออเดอร์ตามสถานะ พร้อมลูกค้า จำนวนชิ้น ขนส่ง ที่อยู่ส่ง',
    parameters: {
      type: 'OBJECT',
      properties: {
        status: { type: 'STRING', description: 'NEW|PICKING|PICKED|PACKED|SHIPPED|DELIVERED|CANCELLED (เว้นว่าง=ทั้งหมด)' },
        limit: { type: 'NUMBER' },
      },
    },
  },
  {
    name: 'recent_movements',
    description: 'ประวัติการเคลื่อนไหวสต็อกล่าสุด (รับเข้า IN หรือจ่ายออก OUT)',
    parameters: {
      type: 'OBJECT',
      properties: {
        type: { type: 'STRING', description: 'IN หรือ OUT' },
        limit: { type: 'NUMBER' },
      },
      required: ['type'],
    },
  },
  {
    name: 'list_customers',
    description: 'ค้นหา/รายการลูกค้า (ชื่อ รหัส เบอร์โทร ที่อยู่)',
    parameters: { type: 'OBJECT', properties: { query: { type: 'STRING' } } },
  },
  {
    name: 'list_carriers',
    description: 'รายการผู้ให้บริการขนส่งที่ตั้งค่าไว้',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'list_suppliers',
    description: 'ค้นหา/รายการผู้จำหน่าย (vendor)',
    parameters: { type: 'OBJECT', properties: { query: { type: 'STRING' } } },
  },
];

const num = (v: any) => Number(v ?? 0);
const P = (p: any) => ({
  sku: p.id, name: p.name, stock: num(p.stock), unit: p.unit || 'ชิ้น',
  location: p.location || 'Unassigned', minStock: num(p.minStock), price: num(p.price),
  category: p.category || '', lot: p.lotNo || p.lot_no || undefined,
  expiry: p.expiryDate || p.expiry_date || undefined,
});

// ---- Executor: run a tool by name, return compact JSON-serialisable data ----
export async function runAiTool(name: string, args: any): Promise<any> {
  args = args || {};
  switch (name) {
    case 'search_products': {
      const q = String(args.query || '').toLowerCase().trim();
      const all = await getProducts().catch(() => []);
      const hits = !q ? all.slice(0, 15) : all.filter((p: any) =>
        (p.id || '').toLowerCase().includes(q) ||
        (p.name || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        (p.location || '').toLowerCase().includes(q)
      ).slice(0, 15);
      return { count: hits.length, items: hits.map(P) };
    }
    case 'inventory_summary': {
      const [val, products] = await Promise.all([
        getInventoryValuation().catch(() => null as any),
        getProducts().catch(() => []),
      ]);
      const low = products.filter((p: any) => num(p.stock) <= num(p.minStock || 5)).length;
      const out = products.filter((p: any) => num(p.stock) <= 0).length;
      return {
        totalSkus: val?.totalSkus ?? products.length,
        totalUnits: val?.totalUnits ?? 0,
        totalCostValuation: val?.totalCostValuation ?? 0,
        totalRetailValuation: val?.totalRetailValuation ?? 0,
        estimatedMargin: val?.estimatedMargin ?? 0,
        lowStockCount: low,
        outOfStockCount: out,
        deadStock90DaysCount: val?.deadStock90DaysCount ?? 0,
        deadStockLockedCapital: val?.deadStockLockedCapital ?? 0,
      };
    }
    case 'low_stock': {
      const products = await getProducts().catch(() => []);
      const items = products.filter((p: any) => num(p.stock) <= num(p.minStock || 5))
        .sort((a: any, b: any) => num(a.stock) - num(b.stock))
        .slice(0, num(args.limit) || 30).map(P);
      return { count: items.length, items };
    }
    case 'out_of_stock': {
      const products = await getProducts().catch(() => []);
      const items = products.filter((p: any) => num(p.stock) <= 0).slice(0, num(args.limit) || 50).map(P);
      return { count: items.length, items };
    }
    case 'expiring_soon': {
      const days = num(args.days) || 30;
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() + days);
      const products = await getProducts().catch(() => []);
      const items = products
        .map((p: any) => ({ p, d: p.expiryDate || p.expiry_date }))
        .filter((x: any) => x.d && new Date(x.d) <= cutoff)
        .sort((a: any, b: any) => new Date(a.d).getTime() - new Date(b.d).getTime())
        .slice(0, 40)
        .map((x: any) => P(x.p));
      return { withinDays: days, count: items.length, items };
    }
    case 'orders_summary': {
      const [orders, pending] = await Promise.all([
        listOrders({ limit: 1000 }).catch(() => []),
        getPendingFulfillment().catch(() => ({ pending_tasks: [] })),
      ]);
      const stats: Record<string, number> = {};
      ORDER_FLOW.concat(['CANCELLED']).forEach((s) => (stats[s] = 0));
      orders.forEach((o: any) => { if (stats[o.status] !== undefined) stats[o.status]++; });
      return { byStatus: stats, pendingPickPack: pending.pending_tasks?.length ?? 0, total: orders.length };
    }
    case 'list_orders': {
      const status = args.status ? String(args.status).toUpperCase() : undefined;
      const orders = await listOrders({ status, limit: num(args.limit) || 20 }).catch(() => []);
      return {
        count: orders.length,
        items: orders.slice(0, num(args.limit) || 20).map((o: any) => ({
          orderNo: o.orderNo, customer: o.customerName, status: o.status,
          qty: o.totalQty, carrier: o.carrier, tracking: o.trackingNo,
          shipAddress: o.shipAddress, branch: o.branchCode,
        })),
      };
    }
    case 'recent_movements': {
      const type = String(args.type || 'OUT').toUpperCase() === 'IN' ? 'IN' : 'OUT';
      const rows = await getTransactions(type as any).catch(() => []);
      return {
        type, count: rows.length,
        items: rows.slice(0, num(args.limit) || 20).map((t: any) => ({
          date: t.date, product: t.product, qty: t.qty, docRef: t.docRef,
        })),
      };
    }
    case 'list_customers': {
      const rows = await getCustomers(args.query ? String(args.query) : undefined).catch(() => []);
      return { count: rows.length, items: rows.slice(0, 20).map((c: any) => ({
        code: c.code, name: c.name, phone: c.phone, address: c.address, defaultCarrier: c.defaultCarrier,
      })) };
    }
    case 'list_carriers': {
      const rows = await getCarriers().catch(() => []);
      return { count: rows.length, items: rows.map((c: any) => ({
        code: c.code, name: c.name, isDefault: c.isDefault, phone: c.phone,
      })) };
    }
    case 'list_suppliers': {
      const rows = await getSuppliers(args.query ? String(args.query) : undefined).catch(() => []);
      return { count: rows.length, items: rows.slice(0, 20).map((s: any) => ({
        code: s.code, name: s.name, phone: s.phone, contactPerson: s.contactPerson,
      })) };
    }
    default:
      return { error: `unknown tool: ${name}` };
  }
}
