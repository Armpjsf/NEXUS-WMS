import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getDamageRecords } from '@/lib/data/wms';
import { getCurrentOrgId } from '@/lib/orgContext';

export const dynamic = 'force-dynamic';

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

    if (!product_name || !quantity || !reason) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { error } = await supabase.from('damage_records').insert({
      org_id: await getCurrentOrgId(),
      report_date: date || new Date().toISOString().split('T')[0],
      product_name,
      quantity: Number(quantity) || 0,
      unit: unit || 'ชิ้น',
      reason,
      notes: notes || '',
      reported_by: reported_by || 'System',
      status: 'รอดำเนินการ',
    });

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

    let patch: Record<string, any>;
    if (sent_to_hq) {
      patch = { sent_to_hq };
    } else if (status) {
      patch = {
        status,
        approved_by: approver || 'Admin',
        approved_date: new Date().toISOString().split('T')[0],
      };
    } else {
      return NextResponse.json({ error: 'Missing status or sent_to_hq' }, { status: 400 });
    }

    const { error } = await supabase.from('damage_records').update(patch).eq('id', targetId);
    if (error) {
      console.error('Supabase update damage Error:', error);
      return NextResponse.json({ error: 'Failed to update record' }, { status: 500 });
    }

    return NextResponse.json({ message: sent_to_hq ? 'HQ status updated successfully' : 'Status updated' });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
