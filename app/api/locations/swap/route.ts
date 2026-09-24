import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';
import { recordEnterpriseAudit } from '@/lib/auditTrailEnterprise';
import { binMoveAll } from '@/lib/stockLocations';
import { errorMessage } from '@/lib/errors';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const orgId = await getCurrentOrgId();
    const body = await req.json();
    const { mode, sourceId, targetId, newLocation, reason } = body;
    const actorName = session.user?.name || session.user?.email || 'Warehouse Operator';

    if (mode === 'SWAP') {
      if (!sourceId || !targetId) {
        return NextResponse.json({ error: 'ต้องระบุสินค้าทั้งสองรายการเพื่อสลับพิกัด' }, { status: 400 });
      }

      if (sourceId === targetId) {
        return NextResponse.json({ error: 'ไม่สามารถสลับพิกัดกับสินค้าตัวเดียวกันได้' }, { status: 400 });
      }

      // 1. Fetch both products
      const { data: products, error: fetchErr } = await supabase
        .from('products')
        .select('*')
        .in('id', [sourceId, targetId])
        .eq('org_id', orgId);

      if (fetchErr || !products || products.length < 2) {
        return NextResponse.json({ error: 'ไม่พบข้อมูลสินค้าหนึ่งในสองรายการ' }, { status: 404 });
      }

      const sourceProduct = products.find(p => String(p.id) === String(sourceId));
      const targetProduct = products.find(p => String(p.id) === String(targetId));

      if (!sourceProduct || !targetProduct) {
        return NextResponse.json({ error: 'ข้อมูลสินค้าไม่ครบถ้วน' }, { status: 404 });
      }

      const locA = sourceProduct.location || 'Unassigned';
      const locB = targetProduct.location || 'Unassigned';

      // 2. Move the stock itself between the bins (stock_locations). Writing
      //    products.location directly was undone by the next bin reconcile,
      //    and the per-bin balances never moved. products.location/stock are
      //    re-derived from the bins inside binMoveAll.
      await binMoveAll(orgId, sourceProduct.sku, locA, locB);
      await binMoveAll(orgId, targetProduct.sku, locB, locA);

      // 3. Log stock transactions
      const swapRef = `SWAP-${Date.now()}`;
      await supabase.from('stock_transactions').insert([
        {
          org_id: orgId,
          type: 'RELOCATE',
          sku: sourceProduct.sku,
          product_name: sourceProduct.name,
          qty: sourceProduct.stock || 0,
          unit_price: Number(sourceProduct.price || 0),
          doc_ref: swapRef,
          location: locB,
          user_name: actorName,
          created_at: new Date().toISOString()
        },
        {
          org_id: orgId,
          type: 'RELOCATE',
          sku: targetProduct.sku,
          product_name: targetProduct.name,
          qty: targetProduct.stock || 0,
          unit_price: Number(targetProduct.price || 0),
          doc_ref: swapRef,
          location: locA,
          user_name: actorName,
          created_at: new Date().toISOString()
        }
      ]);

      // 4. Immutable Audit Trail
      await recordEnterpriseAudit({
        orgId,
        entityName: 'products',
        entityId: String(sourceProduct.id),
        action: 'UPDATE',
        beforeState: { location: locA, swappedWith: targetProduct.sku },
        afterState: { location: locB },
        performedBy: session.user?.id || 'user',
        userEmail: session.user?.email || '',
        reason: reason || `สลับตำแหน่งจัดเก็บ 1-Click ระหว่าง [${sourceProduct.sku}] (${locA} ➔ ${locB}) และ [${targetProduct.sku}] (${locB} ➔ ${locA})`
      });

      return NextResponse.json({
        success: true,
        message: `สลับพิกัดจัดเก็บสำเร็จ! [${sourceProduct.name}] ย้ายไป ${locB} และ [${targetProduct.name}] ย้ายมา ${locA}`,
        source: { id: sourceProduct.id, name: sourceProduct.name, sku: sourceProduct.sku, oldLocation: locA, newLocation: locB },
        target: { id: targetProduct.id, name: targetProduct.name, sku: targetProduct.sku, oldLocation: locB, newLocation: locA }
      });
    } else {
      // Mode: RELOCATE (Single product to new/empty location)
      if (!sourceId || !newLocation) {
        return NextResponse.json({ error: 'ต้องระบุสินค้าและพิกัดตำแหน่งใหม่' }, { status: 400 });
      }

      const { data: product, error: fetchErr } = await supabase
        .from('products')
        .select('*')
        .eq('id', sourceId)
        .eq('org_id', orgId)
        .single();

      if (fetchErr || !product) {
        return NextResponse.json({ error: 'ไม่พบสินค้าที่ต้องการย้าย' }, { status: 404 });
      }

      const oldLocation = product.location || 'Unassigned';

      // Move the SKU's stock from its current bin to the new one (see SWAP).
      await binMoveAll(orgId, product.sku, oldLocation, newLocation.trim());

      await supabase.from('stock_transactions').insert({
        org_id: orgId,
        type: 'RELOCATE',
        sku: product.sku,
        product_name: product.name,
        qty: product.stock || 0,
        unit_price: Number(product.price || 0),
        doc_ref: `RELOC-${Date.now()}`,
        location: newLocation.trim(),
        user_name: actorName,
        created_at: new Date().toISOString()
      });

      await recordEnterpriseAudit({
        orgId,
        entityName: 'products',
        entityId: String(product.id),
        action: 'UPDATE',
        beforeState: { location: oldLocation },
        afterState: { location: newLocation.trim() },
        performedBy: session.user?.id || 'user',
        userEmail: session.user?.email || '',
        reason: reason || `ย้ายพิกัดสินค้า [${product.sku}] จาก ${oldLocation} ➔ ${newLocation.trim()}`
      });

      return NextResponse.json({
        success: true,
        message: `ย้ายพิกัดสินค้า [${product.name}] จาก ${oldLocation} ไปยัง ${newLocation.trim()} สำเร็จ`,
        product: { id: product.id, name: product.name, sku: product.sku, oldLocation, newLocation: newLocation.trim() }
      });
    }
  } catch (err) {
    console.error('Location Swap Error:', err);
    return NextResponse.json({ error: errorMessage(err) || 'Internal Server Error' }, { status: 500 });
  }
}
