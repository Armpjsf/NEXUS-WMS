import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory stand-in for the wms_next_doc_seq RPC + an "existing numbers" table.
const state = vi.hoisted(() => ({
  counters: new Map<string, number>(),
  existing: [] as string[],
  rpcFails: false,
}));

vi.mock('@/lib/supabase', () => {
  const client = {
    rpc: async (_fn: string, args: { p_key: string; p_floor: number }) => {
      if (state.rpcFails) return { data: null, error: { message: 'function does not exist' } };
      const next = Math.max(state.counters.get(args.p_key) || 0, args.p_floor || 0) + 1;
      state.counters.set(args.p_key, next);
      return { data: next, error: null };
    },
    from: () => {
      let prefix = '';
      const q: any = {
        select: () => q,
        like: (_c: string, pattern: string) => { prefix = pattern.replace(/%$/, ''); return q; },
        eq: () => q,
        order: () => q,
        limit: async () => ({ data: state.existing.filter(v => v.startsWith(prefix)).map(v => ({ doc_no: v })) }),
      };
      return q;
    },
  };
  return { getServiceSupabase: () => client, supabase: client };
});

import { bangkokDate, formatDocNumber, nextDocNumber, nextMasterCode } from '@/lib/docNumber';

const NOON_UTC = new Date('2026-09-24T05:00:00Z');   // 12:00 Bangkok
const LATE_UTC = new Date('2026-09-23T18:30:00Z');   // 01:30 Bangkok, next day

beforeEach(() => {
  state.counters.clear();
  state.existing = [];
  state.rpcFails = false;
});

describe('bangkokDate', () => {
  it('formats yymmdd and yyyymmdd', () => {
    expect(bangkokDate('yymmdd', NOON_UTC)).toBe('260924');
    expect(bangkokDate('yyyymmdd', NOON_UTC)).toBe('20260924');
  });
  it('uses the Bangkok calendar day, not UTC', () => {
    expect(bangkokDate('yymmdd', LATE_UTC)).toBe('260924');
  });
});

describe('formatDocNumber', () => {
  it('zero-pads the sequence', () => {
    expect(formatDocNumber('ORD', '260924', 7)).toBe('ORD-260924-007');
    expect(formatDocNumber('ADJ', '20260924', 12, 4)).toBe('ADJ-20260924-0012');
  });
});

describe('nextDocNumber', () => {
  it('issues strictly increasing, distinct numbers under concurrency', async () => {
    const nums = await Promise.all(Array.from({ length: 25 }, () => nextDocNumber('ORD', { now: NOON_UTC })));
    expect(new Set(nums).size).toBe(25);
    expect(nums.sort()[0]).toBe('ORD-260924-001');
    expect(nums.sort()[24]).toBe('ORD-260924-025');
  });

  it('continues after numbers that already exist for the day', async () => {
    state.existing = ['ORD-260924-001', 'ORD-260924-014', 'ORD-260923-099'];
    const n = await nextDocNumber('ORD', { now: NOON_UTC, existing: { table: 'outbound_orders', column: 'doc_no' } });
    expect(n).toBe('ORD-260924-015');
  });

  it('falls back to a time-based suffix when the RPC is missing', async () => {
    state.rpcFails = true;
    const n = await nextDocNumber('GRN', { now: NOON_UTC });
    expect(n).toMatch(/^GRN-260924-T\d{7}$/);
  });
});

describe('nextMasterCode', () => {
  it('numbers codes per org', async () => {
    expect(await nextMasterCode('CUST', 'org-a', { table: 'customers', column: 'doc_no' })).toBe('CUST-0001');
    expect(await nextMasterCode('CUST', 'org-a', { table: 'customers', column: 'doc_no' })).toBe('CUST-0002');
    expect(await nextMasterCode('CUST', 'org-b', { table: 'customers', column: 'doc_no' })).toBe('CUST-0001');
  });
});
