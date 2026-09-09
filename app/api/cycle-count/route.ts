
import { NextResponse } from 'next/server';
import { getCycleCountLogs, addCycleCountEntry, type CycleCountRecord } from '@/lib/data/wms';
import { supabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const records = await getCycleCountLogs();
    
    // Sort by Date Descending (Newest First)
    records.sort((a, b) => {
        const dateA = new Date(a.count_date).getTime();
        const dateB = new Date(b.count_date).getTime();
        return dateB - dateA;
    });

    return NextResponse.json(records);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch cycle count logs' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      product_name, 
      location, 
      system_qty, 
      actual_qty, 
      inspector, 
      notes,
      variance_reason,
      photo_url 
    } = body;

    if (!product_name || actual_qty === undefined) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const sysQty = parseFloat(system_qty || '0');
    const actQty = parseFloat(actual_qty);
    const variance = actQty - sysQty;
    const status = variance === 0 ? 'Match' : 'Discrepancy';

    // Combine notes with variance reason if provided
    let fullNotes = notes || '';
    if (variance_reason) {
      fullNotes = fullNotes ? `${fullNotes} | Reason: ${variance_reason}` : `Reason: ${variance_reason}`;
    }
    if (photo_url) {
      fullNotes = fullNotes ? `${fullNotes} | Photo: ${photo_url}` : `Photo: ${photo_url}`;
    }

    const newRecord: CycleCountRecord = {
        product_name,
        location: location || '-',
        due_date: new Date().toISOString().split('T')[0],
        count_date: new Date().toISOString().split('T')[0],
        inspector: inspector || 'System',
        notes: fullNotes,
        system_qty: sysQty,
        actual_qty: actQty,
        variance,
        status
    };

    const success = await addCycleCountEntry(newRecord);

    if (success) {
        return NextResponse.json({ 
          message: 'Count recorded successfully', 
          variance,
          has_variance: variance !== 0 
        });
    } else {
        return NextResponse.json({ error: 'Failed to record count' }, { status: 500 });
    }

  } catch (error) {
    console.error('Error recording cycle count:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    // Clear all cycle count log rows
    const orgId = await getCurrentOrgId();
    const { error } = await supabase
      .from('cycle_count_logs')
      .delete()
      .eq('org_id', orgId);

    if (error) {
      console.error('Error clearing cycle count log:', error);
      return NextResponse.json({ error: 'Failed to clear log' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Cycle Count Log cleared successfully' });
  } catch (error) {
    console.error('Error clearing cycle count log:', error);
    return NextResponse.json({ error: 'Failed to clear log' }, { status: 500 });
  }
}
