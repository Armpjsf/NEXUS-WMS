import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';

export const dynamic = 'force-dynamic';

// Stock movement card for one SKU, built from Supabase stock_transactions.
// Row shape returned: { date, docRef, type, in, out, balance }
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sku = searchParams.get('sku');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!sku) {
      return NextResponse.json({ error: 'SKU is required' }, { status: 400 });
    }

    const normalized = sku.trim().toLowerCase();

    const orgId = await getCurrentOrgId();
    const { data: rows, error } = await supabase
      .from('stock_transactions')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Supabase stock-card Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Match by SKU or product name (legacy sheets keyed on name).
    const productMovs = (rows || [])
      .filter((r: any) => {
        const s = String(r.sku ?? '').trim().toLowerCase();
        const n = String(r.product_name ?? '').trim().toLowerCase();
        return s === normalized || n === normalized;
      })
      .map((r: any) => {
        const qty = Number(r.qty ?? 0);
        const isIn = r.type === 'IN';
        const isDamage = r.type === 'DAMAGE';
        return {
          date: r.created_at,
          docRef: isDamage ? `Damage: ${r.notes || ''}` : (r.doc_ref || (isIn ? 'Inbound' : 'Outbound')),
          type: r.type,
          in: isIn ? qty : 0,
          out: isIn ? 0 : qty, // OUT and DAMAGE both reduce stock
          balance: 0,
        };
      });

    productMovs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Starting balance before the selected range + range filtering
    const startTs = startDate ? new Date(startDate).getTime() : 0;
    const endTs = endDate ? new Date(endDate).getTime() + 24 * 60 * 60 * 1000 - 1 : Number.MAX_SAFE_INTEGER;

    let startingBalance = 0;
    let inRange = productMovs;
    if (startDate) {
      startingBalance = productMovs.reduce((acc, m) => {
        return new Date(m.date).getTime() < startTs ? acc + m.in - m.out : acc;
      }, 0);
      inRange = productMovs.filter((m) => {
        const d = new Date(m.date).getTime();
        return d >= startTs && d <= endTs;
      });
    }

    let currentBalance = startingBalance;
    const finalMovements = inRange.map((m) => {
      currentBalance += m.in - m.out;
      return { ...m, balance: currentBalance };
    });

    return NextResponse.json(finalMovements);
  } catch (error: any) {
    console.error('Stock Card API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
