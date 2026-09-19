#!/usr/bin/env node
// Split each SKU's current bins into per-lot rows (mixed-lot bins).
// Greedy FIFO: fill each bin from the SKU's remaining lots (oldest first),
// so every bin row carries a real lot while each bin's total and each lot's
// remaining qty are preserved exactly (Σ unchanged). Idempotent.
//
// PREREQUISITE: apply sql/20260919_mixed_lot_bins.sql first (needs the
// (org,sku,bin,lot_no) unique key). Run: node scripts/split-bins-by-lot.mjs --commit
import fs from 'fs';

const ORG = '00000000-0000-0000-0000-000000000001';
const COMMIT = process.argv.includes('--commit');
const env = fs.readFileSync('.env.local', 'utf8');
const pick = (k) => (env.split('\n').find(l => l.startsWith(k + '=')) || '').split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '');
const URL = pick('NEXT_PUBLIC_SUPABASE_URL'), KEY = pick('SUPABASE_SERVICE_ROLE_KEY');
const H = { apikey: KEY, authorization: `Bearer ${KEY}`, 'content-type': 'application/json' };
async function rest(m, p, b, x = {}) { const r = await fetch(URL + '/rest/v1/' + p, { method: m, headers: { ...H, ...x }, body: b ? JSON.stringify(b) : undefined }); if (!r.ok) throw new Error(`${m} ${p.slice(0,60)} ${r.status} ${(await r.text()).slice(0,200)}`); return r; }
const page = async (path) => { let out = [], f = 0; for (;;) { const r = await rest('GET', path, null, { Range: `${f}-${f + 999}` }); const d = await r.json(); out = out.concat(d); if (d.length < 1000) break; f += 1000; } return out; };
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };

console.log('MODE:', COMMIT ? 'COMMIT' : 'DRY-RUN');

const locs = await page(`stock_locations?select=sku,bin_code,quantity&org_id=eq.${ORG}`);
const lots = await page(`product_lots?select=sku,lot_number,current_qty,mfg_date&org_id=eq.${ORG}&current_qty=gt.0`);

// bins per sku (grouped by bin, summed — stable/idempotent)
const binsBySku = new Map();
for (const l of locs) {
  const q = Number(l.quantity || 0); if (q <= 0) continue;
  if (!binsBySku.has(l.sku)) binsBySku.set(l.sku, new Map());
  const m = binsBySku.get(l.sku); m.set(l.bin_code, (m.get(l.bin_code) || 0) + q);
}
// lots per sku, FIFO
const lotsBySku = new Map();
for (const l of lots) {
  if (!lotsBySku.has(l.sku)) lotsBySku.set(l.sku, []);
  lotsBySku.get(l.sku).push({ lot: l.lot_number, qty: Number(l.current_qty || 0), mfg: l.mfg_date || '' });
}
for (const arr of lotsBySku.values()) arr.sort((a, b) => String(a.mfg).localeCompare(String(b.mfg)));

let totalRows = 0, mixedBins = 0, skusNoLot = 0;
const plan = new Map(); // sku -> [{bin_code, lot_no, quantity}]
for (const [sku, binMap] of binsBySku) {
  const bins = [...binMap.entries()].sort((a, b) => b[1] - a[1]); // fullest bin first
  const lotQ = (lotsBySku.get(sku) || []).map(x => ({ ...x })); // clone
  const rows = [];
  let li = 0;
  for (const [bin, binTotalRaw] of bins) {
    let binNeed = binTotalRaw;
    while (binNeed > 0.0001 && li < lotQ.length) {
      const lot = lotQ[li];
      const use = Math.min(binNeed, lot.qty);
      rows.push({ org_id: ORG, sku, bin_code: bin, quantity: use, lot_no: lot.lot });
      binNeed -= use; lot.qty -= use;
      if (lot.qty <= 0.0001) li++;
    }
    if (binNeed > 0.0001) { // no lots left to cover — keep remainder unlotted
      rows.push({ org_id: ORG, sku, bin_code: bin, quantity: binNeed, lot_no: '' });
      if (!(lotsBySku.get(sku) || []).length) skusNoLot++;
    }
  }
  // count mixed bins (bin with >1 lot row)
  const perBin = {};
  for (const r of rows) perBin[r.bin_code] = (perBin[r.bin_code] || 0) + 1;
  mixedBins += Object.values(perBin).filter(c => c > 1).length;
  plan.set(sku, rows); totalRows += rows.length;
}
console.log(`SKUs ${plan.size} | new bin-lot rows ${totalRows} | mixed-lot bins ${mixedBins} | SKUs w/o lots (kept unlotted) ${skusNoLot}`);

// show a mixed-lot example
for (const [sku, rows] of plan) {
  const perBin = {}; for (const r of rows) (perBin[r.bin_code] ||= []).push(r);
  const mb = Object.entries(perBin).find(([, rs]) => rs.length > 1);
  if (mb) { console.log(`ตัวอย่าง mixed-lot: ${sku} @ bin ${mb[0]}:`, mb[1].map(r => `${r.lot_no}=${r.quantity}`).join(', ')); break; }
}

if (!COMMIT) { console.log('\nDRY-RUN. add --commit to write.'); process.exit(0); }

let done = 0;
for (const c of chunk([...plan.keys()], 20)) {
  await Promise.all(c.map(async (sku) => {
    await rest('DELETE', `stock_locations?org_id=eq.${ORG}&sku=eq.${encodeURIComponent(sku)}`);
    const rows = plan.get(sku).filter(r => Number(r.quantity) > 0);
    if (rows.length) await rest('POST', 'stock_locations', rows, { Prefer: 'return=minimal' });
  }));
  done += c.length; process.stdout.write(`\r  ${done}/${plan.size}`);
}
console.log('');

// verify invariant Σ bins == products.stock
const prods = await page(`products?select=sku,stock&org_id=eq.${ORG}`);
const locs2 = await page(`stock_locations?select=sku,quantity&org_id=eq.${ORG}`);
const sumBy = new Map(); for (const l of locs2) sumBy.set(l.sku, (sumBy.get(l.sku) || 0) + Number(l.quantity || 0));
let bad = 0; for (const p of prods) { if (Math.abs((sumBy.get(p.sku) || 0) - Number(p.stock || 0)) > 0.001) bad++; }
console.log(`✅ DONE. bin-lot rows ${locs2.length} | invariant mismatches ${bad}`);
