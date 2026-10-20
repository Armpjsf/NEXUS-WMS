import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { calculateClientBilling } from '@/lib/billingEngine';
import { getCurrentOrgId } from '@/lib/orgContext';
import { getServiceSupabase } from '@/lib/supabase';
import { bangkokDate } from '@/lib/docNumber';
import { errorMessage } from '@/lib/errors';

async function computeLiveUsage(
  orgId: string,
  opts: { clientId?: string | null; clientCode?: string | null; clientName?: string | null; daysCount?: number }
) {
  const admin = getServiceSupabase();
  const days = Number(opts.daysCount) > 0 ? Number(opts.daysCount) : 30;
  const sinceIso = new Date(Date.now() - days * 86400000).toISOString();

  let clientCode = (opts.clientCode || '').trim();
  let clientName = (opts.clientName || '').trim();

  if (opts.clientId && (!clientCode || !clientName)) {
    const { data: cRow } = await admin
      .from('third_party_clients')
      .select('client_code, client_name')
      .eq('org_id', orgId)
      .eq('id', opts.clientId)
      .maybeSingle();
    if (cRow) {
      clientCode = clientCode || cRow.client_code || '';
      clientName = clientName || cRow.client_name || '';
    }
  }

  const { data: allProducts } = await admin
    .from('products')
    .select('sku, name, stock, owner')
    .eq('org_id', orgId);

  const products = allProducts || [];
  const codeLower = clientCode.toLowerCase();
  const nameLower = clientName.toLowerCase();

  let clientProducts = products.filter((p: any) => {
    const owner = String(p.owner || p.owner_code || '').trim().toLowerCase();
    if (!owner) return false;
    return (
      (codeLower && owner === codeLower) ||
      (nameLower && (owner === nameLower || owner.includes(nameLower) || nameLower.includes(owner)))
    );
  });

  const isScopedToClientOwner = clientProducts.length > 0;
  if (!isScopedToClientOwner) {
    clientProducts = products;
  }

  const clientSkus = new Set(clientProducts.map((p: any) => String(p.sku || '').trim().toLowerCase()).filter(Boolean));
  const totalStockUnits = clientProducts.reduce((sum: number, p: any) => sum + Math.max(0, Number(p.stock || 0)), 0);
  // Estimate 0.02 CBM per unit when per-SKU CBM is not stored
  const avgOccupiedCbm = Math.round(
    clientProducts.reduce(
      (sum: number, p: any) => sum + Math.max(0, Number(p.stock || 0)) * Number(p.cbm || p.volume_cbm || 0.02),
      0
    ) * 100
  ) / 100;

  const { data: ordersRows } = await admin
    .from('outbound_orders')
    .select('id, order_no, status, total_qty, items_json, created_at')
    .eq('org_id', orgId)
    .neq('status', 'CANCELLED')
    .gte('created_at', sinceIso);

  let ordersCount = 0;
  let itemsCount = 0;

  for (const ord of ordersRows || []) {
    const lines: any[] = Array.isArray(ord.items_json) ? ord.items_json : [];
    if (isScopedToClientOwner) {
      const matchingLines = lines.filter(l => clientSkus.has(String(l.sku || '').trim().toLowerCase()));
      if (matchingLines.length > 0) {
        ordersCount++;
        itemsCount += matchingLines.reduce((s, l) => s + (Number(l.qty) || 0), 0);
      }
    } else {
      ordersCount++;
      const lineSum = lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);
      itemsCount += lineSum > 0 ? lineSum : Number(ord.total_qty || 0);
    }
  }

  // Fallback to stock_transactions (OUT) if outbound_orders had 0 matches in the period
  if (ordersCount === 0 && itemsCount === 0) {
    const { data: outTxs } = await admin
      .from('stock_transactions')
      .select('sku, qty, doc_ref, created_at')
      .eq('org_id', orgId)
      .eq('type', 'OUT')
      .gte('created_at', sinceIso);

    const relevantTxs = (outTxs || []).filter((t: any) =>
      !isScopedToClientOwner || clientSkus.has(String(t.sku || '').trim().toLowerCase())
    );
    if (relevantTxs.length > 0) {
      const distinctDocs = new Set(relevantTxs.map((t: any) => t.doc_ref || t.created_at));
      ordersCount = distinctDocs.size;
      itemsCount = relevantTxs.reduce((s: number, t: any) => s + Math.max(0, Number(t.qty || 0)), 0);
    }
  }

  return {
    avgOccupiedCbm,
    ordersCount,
    itemsCount,
    totalStockUnits,
    matchedSkus: clientProducts.length,
    isScopedToClientOwner,
    daysCount: days,
  };
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const orgId = await getCurrentOrgId();
    const { searchParams } = new URL(req.url);
    const clientCode = searchParams.get('clientCode');
    const clientId = searchParams.get('clientId');
    const clientName = searchParams.get('clientName');
    const daysCount = Number(searchParams.get('daysCount') || 30);

    const usage = await computeLiveUsage(orgId, { clientId, clientCode, clientName, daysCount });
    return NextResponse.json({
      success: true,
      ...usage,
      usage,
    });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const orgId = await getCurrentOrgId();
    const body = await req.json();
    const clientId = body.clientId;
    // pull the real 3PL client from DB; fall back to the rates in the request
    const { data: row } = clientId
      ? await getServiceSupabase().from('third_party_clients').select('*').eq('org_id', orgId).eq('id', clientId).maybeSingle()
      : { data: null };
    const client = row ? {
      id: row.id, clientCode: row.client_code, clientName: row.client_name,
      storageRatePerCbmDay: Number(row.storage_rate_per_cbm_day || 15),
      storageRatePerPalletDay: Number(row.storage_rate_per_pallet_day || 25),
      pickFeeBase: Number(row.pick_fee_base || 12), pickFeePerItem: Number(row.pick_fee_per_item || 3.5),
      packMaterialFee: Number(row.pack_material_fee || 10), status: 'ACTIVE' as const,
    } : {
      id: clientId || 'cli-custom',
      clientCode: body.clientCode || 'CLI-CUSTOM',
      clientName: body.clientName || 'ผู้ว่าจ้างทั่วไป',
      storageRatePerCbmDay: Number(body.storageRatePerCbmDay) || 15,
      storageRatePerPalletDay: Number(body.storageRatePerPalletDay) || 25,
      pickFeeBase: Number(body.pickFeeBase) || 12,
      pickFeePerItem: Number(body.pickFeePerItem) || 3.5,
      packMaterialFee: Number(body.packMaterialFee) || 10,
      status: 'ACTIVE' as const
    };

    const daysCount = Number.isFinite(Number(body.daysCount)) && Number(body.daysCount) > 0 ? Number(body.daysCount) : 30;
    let avgOccupiedCbm = Number.isFinite(Number(body.avgOccupiedCbm)) ? Number(body.avgOccupiedCbm) : undefined;
    let ordersCount = Number.isFinite(Number(body.ordersCount)) ? Number(body.ordersCount) : undefined;
    let itemsCount = Number.isFinite(Number(body.itemsCount)) ? Number(body.itemsCount) : undefined;

    if (body.autoComputeUsage || (avgOccupiedCbm === undefined && ordersCount === undefined && itemsCount === undefined)) {
      const live = await computeLiveUsage(orgId, {
        clientId: client.id,
        clientCode: client.clientCode,
        clientName: client.clientName,
        daysCount,
      });
      if (avgOccupiedCbm === undefined) avgOccupiedCbm = live.avgOccupiedCbm;
      if (ordersCount === undefined) ordersCount = live.ordersCount;
      if (itemsCount === undefined) itemsCount = live.itemsCount;
    }

    const calculation = calculateClientBilling(client, {
      periodStart: body.periodStart || new Date(Date.now() - daysCount * 86400000).toISOString().slice(0, 10),
      periodEnd: body.periodEnd || new Date().toISOString().slice(0, 10),
      daysCount,
      avgOccupiedCbm: avgOccupiedCbm ?? 0,
      ordersCount: ordersCount ?? 0,
      itemsCount: itemsCount ?? 0,
    });

    // Proforma only — nothing is saved, so don't consume a real INV number
    // (gaps in invoice numbering are an accounting problem).
    const invoiceNumber = `PROFORMA-${bangkokDate('yyyymmdd')}`;

    return NextResponse.json({
      success: true,
      invoiceNumber,
      calculation
    });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
