import { NextResponse } from 'next/server';
import { supabase, getServiceSupabase } from '@/lib/supabase';
import { getDamageRecords } from '@/lib/data/wms';
import { getCurrentOrgId } from '@/lib/orgContext';
import { requireManagement } from '@/lib/apiAuth';
import { binConsume } from '@/lib/stockLocations';

export const dynamic = 'force-dynamic';

const APPROVED_STATUSES = new Set(['อนุมัติ', 'อนุมัติแล้ว', 'APPROVED']);

export async function GET() {
  try {
    const records = await getDamageRecords();
    return NextResponse.json(records);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch damage records' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { date, product_name, quantity, unit, reason, notes, reported_by } = body;
    const location = String(body.location || '').trim().toUpperCase();

    if (!product_name || !quantity || !reason) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const row: Record<string, any> = {
      org_id: await getCurrentOrgId(),
      report_date: date || new Date().toISOString().split('T')[0],
      product_name,
      quantity: Number(quantity) || 0,
      unit: unit || 'ชิ้น',
      reason,
      notes: notes || '',
      reported_by: reported_by || 'System',
      status: 'รอดำเนินการ',
    };
    // bin the goods were taken from (column from 20261022_damage_location.sql)
    if (location) row.location = location;
    let { error } = await supabase.from('damage_records').insert(row);
    if (error && location && /location/i.test(error.message || '')) {
      // SQL not run yet: keep the record, just without the bin
      delete row.location;
      ({ error } = await supabase.from('damage_records').insert(row));
    }

    if (error) {
      console.error('Supabase add damage Error:', error);
      return NextResponse.json({ error: 'Failed to add record' }, { status: 500 });
    }

    try {
      const { logAction } = await import('@/lib/auditTrail');
      await logAction({
        userId: reported_by || 'System',
        userName: reported_by || 'System',
        action: 'CREATE',
        module: 'Damage',
        description: `Reported damage: ${product_name} x${quantity} (${reason})`,
        newValues: { product_name, quantity, reason } as any,
      });
    } catch (err) {
      console.warn('Audit Log Failed:', err);
    }

    return NextResponse.json({ message: 'Damage record added successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const guard = await requireManagement();
    if (guard.error) return guard.error;

    const body = await req.json();
    const { rowIndex, id, status, approver, sent_to_hq } = body;

    // Resolve the target row id. Frontend still sends a 0-based rowIndex; map it
    // to the actual record via the same created_at DESC ordering used on read.
    let targetId = id as string | undefined;
    if (!targetId) {
      if (rowIndex === undefined) {
        return NextResponse.json({ error: 'Missing rowIndex or id' }, { status: 400 });
      }
      const records = await getDamageRecords();
      targetId = records[rowIndex]?.id;
      if (!targetId) {
        return NextResponse.json({ error: 'Record not found' }, { status: 404 });
      }
    }

    const orgId = await getCurrentOrgId();
    const admin = getServiceSupabase();

    const { data: existing } = await admin
      .from('damage_records')
      .select('*')
      .eq('id', targetId)
      .eq('org_id', orgId)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    let patch: Record<string, any>;
    if (sent_to_hq) {
      patch = { sent_to_hq };
    } else if (status) {
      patch = {
        status,
        approved_by: approver || guard.user?.name || 'Admin',
        approved_date: new Date().toISOString().split('T')[0],
      };
    } else {
      return NextResponse.json({ error: 'Missing status or sent_to_hq' }, { status: 400 });
    }

    const { error } = await admin
      .from('damage_records')
      .update(patch)
      .eq('id', targetId)
      .eq('org_id', orgId);

    if (error) {
      console.error('Supabase update damage Error:', error);
      return NextResponse.json({ error: 'Failed to update record' }, { status: 500 });
    }

    // Deduct stock and record a DAMAGE stock_transaction when transitioning from
    // a non-approved status to an approved status.
    const wasApproved = APPROVED_STATUSES.has(String(existing.status || '').trim());
    const nowApproved = status ? APPROVED_STATUSES.has(String(status).trim()) : false;
    if (!wasApproved && nowApproved) {
      const dmgQty = Number(existing.quantity || 0);
      const rawSkuOrName = String(existing.sku || existing.product_name || '').trim();
      if (rawSkuOrName && dmgQty > 0) {
        let resolvedSku = rawSkuOrName;
        let resolvedName = String(existing.product_name || rawSkuOrName);
        let resolvedPrice = 0;
        let resolvedLoc = '';
        try {
          const { data: bySku } = await admin
            .from('products')
            .select('sku, name, price, location')
            .eq('org_id', orgId)
            .eq('sku', rawSkuOrName)
            .maybeSingle();
          const prod = bySku || (
            await admin
              .from('products')
              .select('sku, name, price, location')
              .eq('org_id', orgId)
              .eq('name', existing.product_name)
              .maybeSingle()
          ).data;
          if (prod) {
            resolvedSku = prod.sku;
            resolvedName = prod.name || resolvedName;
            resolvedPrice = Number(prod.price || 0);
            resolvedLoc = prod.location || '';
          }
        } catch {
          /* fallback to existing.sku || existing.product_name */
        }

        try {
          await binConsume(orgId, resolvedSku, dmgQty, {
            // the bin chosen when reporting wins; blank = automatic FEFO/FIFO
            preferBin: existing.location || undefined,
            docRef: 'DMG-' + targetId,
            party: existing.reason,
          });
          await admin.from('stock_transactions').insert({
            org_id: orgId,
            type: 'DAMAGE',
            sku: resolvedSku,
            product_name: resolvedName,
            qty: dmgQty,
            unit_price: resolvedPrice,
            doc_ref: 'DMG-' + targetId,
            location: resolvedLoc,
            notes: existing.reason || '',
            user_name: approver || guard.user?.name || 'Admin',
          });
        } catch (stockErr) {
          console.warn('Damage stock deduction warning:', stockErr);
        }
      }
    }

    return NextResponse.json({ message: sent_to_hq ? 'HQ status updated successfully' : 'Status updated' });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const guard = await requireManagement();
    if (guard.error) return guard.error;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const orgId = await getCurrentOrgId();
    const { error } = await getServiceSupabase()
      .from('damage_records')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) {
      return NextResponse.json({ error: 'Failed to delete record' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
