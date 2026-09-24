// Tenant-safe product upsert (server only).
//
// Never upsert products with onConflict 'sku' alone: while `products.sku` was
// globally UNIQUE, that let one org's import overwrite — and re-home — another
// org's product with the same SKU. The conflict target must be (org_id, sku).
//
// sql/20260924_doc_sequences.sql adds that unique index. Until it has run,
// Postgres rejects onConflict 'org_id,sku' (42P10: no matching constraint), so
// we fall back to an explicit update-or-insert scoped to the org.
import { getServiceSupabase } from '@/lib/supabase';

type Row = Record<string, any> & { sku: string };

export async function upsertProductsForOrg(
  orgId: string,
  rows: Row[],
): Promise<{ data: any[]; error: { message: string } | null }> {
  const admin = getServiceSupabase();
  const scoped = rows.map(r => ({ ...r, org_id: orgId }));

  const first = await admin.from('products').upsert(scoped, { onConflict: 'org_id,sku' }).select();
  if (!first.error) return { data: first.data || [], error: null };
  if (first.error.code !== '42P10') return { data: [], error: first.error };

  // Fallback: tenant unique index not created yet.
  const skus = scoped.map(r => r.sku);
  const { data: existing, error: selErr } = await admin
    .from('products').select('sku').eq('org_id', orgId).in('sku', skus);
  if (selErr) return { data: [], error: selErr };
  const have = new Set((existing || []).map((r: any) => r.sku));

  const out: any[] = [];
  for (const row of scoped.filter(r => have.has(r.sku))) {
    const { data, error } = await admin.from('products').update(row)
      .eq('org_id', orgId).eq('sku', row.sku).select();
    if (error) return { data: out, error };
    out.push(...(data || []));
  }
  const fresh = scoped.filter(r => !have.has(r.sku));
  if (fresh.length) {
    const { data, error } = await admin.from('products').insert(fresh).select();
    if (error) {
      // 23505 here = the SKU exists in ANOTHER org while sku is still globally
      // unique. Report it instead of touching that org's row.
      const msg = error.code === '23505'
        ? `SKU ซ้ำกับองค์กรอื่น (ต้องรัน sql/20260924_doc_sequences.sql ก่อน): ${error.message}`
        : error.message;
      return { data: out, error: { message: msg } };
    }
    out.push(...(data || []));
  }
  return { data: out, error: null };
}
