import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { calculateClientBilling } from '@/lib/billingEngine';
import { getCurrentOrgId } from '@/lib/orgContext';
import { getServiceSupabase } from '@/lib/supabase';
import { bangkokDate } from '@/lib/docNumber';
import { errorMessage } from '@/lib/errors';

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
      clientCode: 'CLI-CUSTOM',
      clientName: body.clientName || 'ผู้ว่าจ้างทั่วไป',
      storageRatePerCbmDay: Number(body.storageRatePerCbmDay) || 15,
      storageRatePerPalletDay: Number(body.storageRatePerPalletDay) || 25,
      pickFeeBase: Number(body.pickFeeBase) || 12,
      pickFeePerItem: Number(body.pickFeePerItem) || 3.5,
      packMaterialFee: Number(body.packMaterialFee) || 10,
      status: 'ACTIVE' as const
    };

    const calculation = calculateClientBilling(client, {
      periodStart: body.periodStart || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
      periodEnd: body.periodEnd || new Date().toISOString().slice(0, 10),
      daysCount: body.daysCount || 30,
      avgOccupiedCbm: body.avgOccupiedCbm || 0,
      ordersCount: body.ordersCount || 0,
      itemsCount: body.itemsCount || 0
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
