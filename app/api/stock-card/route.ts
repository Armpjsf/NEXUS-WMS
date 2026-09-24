import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';
import { fetchAllRows } from '@/lib/data/fetchAll';
import { txDelta } from '@/lib/ledger';
import { errorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

// Stock movement card for one SKU, built from Supabase stock_transactions.
// Row shape returned: { date, docRef, type, in, out, balance }
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sku = searchParams.get('sku');
    const name = searchParams.get('name');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!sku && !name) {
      return NextResponse.json({ error: 'SKU or name is required' }, { status: 400 });
    }

    const orgId = await getCurrentOrgId();
    const queryTerms = Array.from(new Set([sku, name].filter(Boolean).map(x => x!.trim()))).filter(Boolean);

    const queryPromises = [];
    for (const term of queryTerms) {
      queryPromises.push(
        fetchAllRows((f, t) => supabase.from('stock_transactions').select('*')
          .eq('org_id', orgId).ilike('sku', term)
          .order('created_at', { ascending: true }).range(f, t)),
        fetchAllRows((f, t) => supabase.from('stock_transactions').select('*')
          .eq('org_id', orgId).ilike('product_name', term)
          .order('created_at', { ascending: true }).range(f, t))
      );
    }

    const queryResults = await Promise.all(queryPromises);
    const seen = new Set<string>();
    const rows = queryResults.flat().filter((r: any) => {
      if (r.id && seen.has(r.id)) return false;
      if (r.id) seen.add(r.id);
      return true;
    });

    const normalizedTerms = queryTerms.map(t => t.toLowerCase());

    // Match by SKU or product name (legacy sheets keyed on name).
    const productMovs = (rows || [])
      .filter((r: any) => {
        const s = String(r.sku ?? '').trim().toLowerCase();
        const n = String(r.product_name ?? '').trim().toLowerCase();
        return normalizedTerms.some(term => s === term || n === term);
      })
      .map((r: any) => {
        // Signed effect per type (lib/ledger): ADJUST is a signed correction,
        // RELOCATE only moves bins and doesn't change the total.
        const delta = txDelta(r.type, r.qty);
        const isIn = r.type === 'IN';
        const isDamage = r.type === 'DAMAGE';
        return {
          date: r.created_at,
          docRef: isDamage ? `Damage: ${r.notes || ''}` : (r.doc_ref || (isIn ? 'Inbound' : r.type === 'OUT' ? 'Outbound' : r.type)),
          type: r.type,
          in: delta > 0 ? delta : 0,
          out: delta < 0 ? -delta : 0,
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
  } catch (error) {
    console.error('Stock Card API Error:', error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
