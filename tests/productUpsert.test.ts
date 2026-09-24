import { describe, it, expect, vi, beforeEach } from 'vitest';

// Fake `products` table shared by two orgs, with a switch for whether the
// (org_id, sku) unique index exists yet (42P10 when it doesn't).
const db = vi.hoisted(() => ({
  rows: [] as Array<Record<string, any>>,
  hasTenantIndex: true,
  skuGloballyUnique: false,
}));

vi.mock('@/lib/supabase', () => {
  const from = () => {
    const filters: Record<string, any> = {};
    let inSkus: string[] | null = null;
    let op: 'select' | 'update' | 'insert' | 'upsert' = 'select';
    let payload: any = null;
    const run = () => {
      if (op === 'upsert') {
        if (!db.hasTenantIndex) return { data: null, error: { code: '42P10', message: 'no unique constraint' } };
        const out = [];
        for (const r of payload) {
          const hit = db.rows.find(x => x.org_id === r.org_id && x.sku === r.sku);
          if (hit) Object.assign(hit, r); else db.rows.push({ ...r });
          out.push(r);
        }
        return { data: out, error: null };
      }
      if (op === 'insert') {
        for (const r of payload) {
          if (db.skuGloballyUnique && db.rows.some(x => x.sku === r.sku)) {
            return { data: null, error: { code: '23505', message: 'duplicate key sku' } };
          }
        }
        db.rows.push(...payload.map((r: any) => ({ ...r })));
        return { data: payload, error: null };
      }
      const match = db.rows.filter(x =>
        Object.entries(filters).every(([k, v]) => x[k] === v) && (!inSkus || inSkus.includes(x.sku)));
      if (op === 'update') { match.forEach(x => Object.assign(x, payload)); return { data: match, error: null }; }
      return { data: match, error: null };
    };
    const q: any = {
      select: () => q,
      eq: (k: string, v: any) => { filters[k] = v; return q; },
      in: (_k: string, v: string[]) => { inSkus = v; return q; },
      update: (p: any) => { op = 'update'; payload = p; return q; },
      insert: (p: any) => { op = 'insert'; payload = p; return q; },
      upsert: (p: any) => { op = 'upsert'; payload = p; return q; },
      then: (resolve: any, reject: any) => Promise.resolve(run()).then(resolve, reject),
    };
    return q;
  };
  const client = { from };
  return { getServiceSupabase: () => client, supabase: client };
});

import { upsertProductsForOrg } from '@/lib/data/productUpsert';

beforeEach(() => {
  db.rows = [{ org_id: 'org-a', sku: 'SKU-1', name: 'A product', stock: 10 }];
  db.hasTenantIndex = true;
  db.skuGloballyUnique = false;
});

describe('upsertProductsForOrg', () => {
  it('never touches another org’s product with the same SKU', async () => {
    const { error } = await upsertProductsForOrg('org-b', [{ sku: 'SKU-1', name: 'B product', stock: 3 }]);
    expect(error).toBeNull();
    expect(db.rows.find(r => r.org_id === 'org-a')).toMatchObject({ name: 'A product', stock: 10 });
    expect(db.rows.find(r => r.org_id === 'org-b')).toMatchObject({ name: 'B product', stock: 3 });
  });

  it('stamps the caller org even if a row claims another org', async () => {
    await upsertProductsForOrg('org-b', [{ sku: 'SKU-9', name: 'x', org_id: 'org-a' }]);
    expect(db.rows.find(r => r.sku === 'SKU-9')?.org_id).toBe('org-b');
  });

  it('falls back to scoped update/insert before the tenant index exists', async () => {
    db.hasTenantIndex = false;
    const { error } = await upsertProductsForOrg('org-a', [
      { sku: 'SKU-1', name: 'renamed', stock: 11 },
      { sku: 'SKU-2', name: 'new', stock: 1 },
    ]);
    expect(error).toBeNull();
    expect(db.rows.filter(r => r.org_id === 'org-a').map(r => r.sku).sort()).toEqual(['SKU-1', 'SKU-2']);
    expect(db.rows.find(r => r.sku === 'SKU-1')).toMatchObject({ name: 'renamed', stock: 11 });
  });

  it('reports (not overwrites) a SKU owned by another org while sku is globally unique', async () => {
    db.hasTenantIndex = false;
    db.skuGloballyUnique = true;
    const { error } = await upsertProductsForOrg('org-b', [{ sku: 'SKU-1', name: 'B product' }]);
    expect(error?.message).toMatch(/SKU ซ้ำกับองค์กรอื่น/);
    expect(db.rows).toHaveLength(1);
    expect(db.rows[0]).toMatchObject({ org_id: 'org-a', name: 'A product' });
  });
});
