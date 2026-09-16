import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';
import { recordEnterpriseAudit } from '@/lib/auditTrailEnterprise';

export const dynamic = 'force-dynamic';

interface Comp { componentSku: string; componentName?: string; quantity: number; unit?: string; }

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const orgId = await getCurrentOrgId();
    const admin = getServiceSupabase();
    const body = await req.json();
    const { bomId, quantity, action } = body; // action: 'ASSEMBLE' | 'DISASSEMBLE'
    const buildQty = Math.max(1, Number(quantity) || 1);
    const actor = (session.user as any)?.name || session.user?.email || 'Warehouse';

    const { data: bomRow, error: bomErr } = await admin
      .from('bill_of_materials').select('*').eq('org_id', orgId).eq('id', bomId).maybeSingle();
    if (bomErr) throw bomErr;
    if (!bomRow) return NextResponse.json({ error: 'ไม่พบสูตรชุดสินค้า (BOM)' }, { status: 404 });

    const components: Comp[] = Array.isArray(bomRow.components) ? bomRow.components : [];
    const isAssemble = action !== 'DISASSEMBLE';

    // อ่านสต็อกชิ้นส่วนปัจจุบัน
    const skus = components.map(c => c.componentSku).filter(Boolean);
    const { data: prods } = await admin
      .from('products').select('sku, name, stock, price, location').eq('org_id', orgId).in('sku', skus.length ? skus : ['__none__']);
    const stockMap = new Map((prods || []).map((p: any) => [p.sku, p]));

    if (isAssemble) {
      // 1. เช็คชิ้นส่วนพอมั้ย
      const missing = components.filter(c => Number(stockMap.get(c.componentSku)?.stock || 0) < c.quantity * buildQty)
        .map(c => ({ sku: c.componentSku, required: c.quantity * buildQty, available: Number(stockMap.get(c.componentSku)?.stock || 0) }));
      if (missing.length > 0) {
        return NextResponse.json({ error: 'ชิ้นส่วนในสต็อกไม่เพียงพอสำหรับการรวมชุด', missingComponents: missing }, { status: 400 });
      }
    }

    const txns: any[] = [];
    // 2. ปรับสต็อกชิ้นส่วน (ASSEMBLE = ตัดออก, DISASSEMBLE = คืนเข้า)
    for (const c of components) {
      const p: any = stockMap.get(c.componentSku);
      const delta = c.quantity * buildQty * (isAssemble ? -1 : 1);
      const current = Number(p?.stock || 0);
      if (p) {
        await admin.from('products').update({ stock: Math.max(0, current + delta), updated_at: new Date().toISOString() })
          .eq('org_id', orgId).eq('sku', c.componentSku);
      }
      txns.push({
        org_id: orgId, type: isAssemble ? 'OUT' : 'IN', sku: c.componentSku,
        product_name: c.componentName || p?.name || c.componentSku, qty: c.quantity * buildQty,
        unit_price: Number(p?.price || 0), doc_ref: `KIT-${bomRow.kit_sku}`,
        location: p?.location || '', user_name: actor,
      });
    }

    // 3. ปรับสต็อกชุดสินค้า (ASSEMBLE = เพิ่ม, DISASSEMBLE = ตัด) — สร้าง product ชุดถ้ายังไม่มี
    const { data: kitProd } = await admin.from('products').select('sku, stock, price').eq('org_id', orgId).eq('sku', bomRow.kit_sku).maybeSingle();
    const kitCurrent = Number(kitProd?.stock || 0);
    const kitDelta = buildQty * (isAssemble ? 1 : -1);
    if (kitProd) {
      await admin.from('products').update({ stock: Math.max(0, kitCurrent + kitDelta), updated_at: new Date().toISOString() })
        .eq('org_id', orgId).eq('sku', bomRow.kit_sku);
    } else if (isAssemble) {
      await admin.from('products').insert({
        org_id: orgId, sku: bomRow.kit_sku, name: bomRow.kit_name, category: 'Kit',
        stock: buildQty, min_stock: 0, unit: 'ชุด', price: 0, location: 'KIT',
      });
    }
    txns.push({
      org_id: orgId, type: isAssemble ? 'IN' : 'OUT', sku: bomRow.kit_sku,
      product_name: bomRow.kit_name, qty: buildQty, unit_price: Number(kitProd?.price || 0),
      doc_ref: `KIT-${bomRow.kit_sku}`, location: 'KIT', user_name: actor,
    });

    if (txns.length) await admin.from('stock_transactions').insert(txns);

    await recordEnterpriseAudit({
      orgId, entityName: 'bill_of_materials', entityId: bomRow.id, action: 'UPDATE',
      beforeState: { kitSku: bomRow.kit_sku, action: isAssemble ? 'BEFORE_ASSEMBLE' : 'BEFORE_DISASSEMBLE' },
      afterState: { kitSku: bomRow.kit_sku, qty: buildQty, componentsMoved: components },
      performedBy: (session.user as any)?.id || 'admin', userEmail: session.user?.email || 'admin@nexus.com',
      reason: `${isAssemble ? 'รวมชุดสินค้า (Kitting)' : 'แยกชุดสินค้า (De-kitting)'}: ${bomRow.kit_name} x ${buildQty} ชุด`,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: isAssemble
        ? `รวมชุดสินค้า ${bomRow.kit_name} สำเร็จ ${buildQty} ชุด (ตัดสต็อกชิ้นส่วน + เพิ่มสต็อกชุดแล้ว)`
        : `แยกชุดสินค้า ${bomRow.kit_name} ${buildQty} ชุด คืนชิ้นส่วนเข้าสต็อกแล้ว`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
