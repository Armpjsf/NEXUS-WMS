#!/usr/bin/env node
// Build product_lots from the IN history: one lot per (sku, receive-date), then
// FIFO-consume each SKU's total OUT+DAMAGE (oldest lot first) so Σ current_qty
// per SKU == products.stock. Also stamps stock_locations.lot_no with each SKU's
// oldest still-remaining lot so live FEFO references a real lot (a bin holds one
// lot — org_id,sku,bin_code is unique — so mixed-lot bins take the FIFO front).
//
//   node scripts/build-lots-from-history.mjs           # dry-run
//   node scripts/build-lots-from-history.mjs --commit   # write
import fs from 'fs';

const ORG = '00000000-0000-0000-0000-000000000001';
const COMMIT = process.argv.includes('--commit');
const env = fs.readFileSync('.env.local', 'utf8');
const pick = (k) => (env.split('\n').find(l => l.startsWith(k + '=')) || '').split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '');
const URL = pick('NEXT_PUBLIC_SUPABASE_URL'), KEY = pick('SUPABASE_SERVICE_ROLE_KEY');
const H = { apikey: KEY, authorization: `Bearer ${KEY}`, 'content-type': 'application/json' };
async function rest(m, p, b, x = {}) { const r = await fetch(URL + '/rest/v1/' + p, { method: m, headers: { ...H, ...x }, body: b ? JSON.stringify(b) : undefined }); if (!r.ok) throw new Error(`${m} ${p.slice(0,60)} ${r.status} ${(await r.text()).slice(0,200)}`); return r; }
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
const page = async (path) => { let out = [], f = 0; for (;;) { const r = await rest('GET', path, null, { Range: `${f}-${f + 999}` }); const d = await r.json(); out = out.concat(d); if (d.length < 1000) break; f += 1000; } return out; };
const ymd = (iso) => new Date(iso).toISOString().slice(0, 10);

console.log('MODE:', COMMIT ? 'COMMIT' : 'DRY-RUN');

// pull ledger
const IN = await page(`stock_transactions?select=sku,qty,created_at,product_name&type=eq.IN&org_id=eq.${ORG}`);
const OUT = await page(`stock_transactions?select=sku,qty&type=eq.OUT&org_id=eq.${ORG}`);
const DMG = await page(`stock_transactions?select=sku,qty&type=eq.DAMAGE&org_id=eq.${ORG}`);
const prods = await page(`products?select=sku,stock&org_id=eq.${ORG}`);
const stockBy = new Map(prods.map(p => [p.sku, Number(p.stock || 0)]));

// consumed per sku
const consumed = new Map();
for (const t of [...OUT, ...DMG]) consumed.set(t.sku, (consumed.get(t.sku) || 0) + Number(t.qty || 0));

// lots per (sku, receive-date), merged
const lotMap = new Map(); // key sku|date -> {sku,date,qty,name}
for (const t of IN) {
  const d = ymd(t.created_at); const k = `${t.sku}|${d}`;
  const e = lotMap.get(k) || { sku: t.sku, date: d, qty: 0, name: t.product_name || t.sku };
  e.qty += Number(t.qty || 0); lotMap.set(k, e);
}
// group by sku, sort by date asc, FIFO-consume
const bySku = new Map();
for (const e of lotMap.values()) { if (!bySku.has(e.sku)) bySku.set(e.sku, []); bySku.get(e.sku).push(e); }

const lots = []; const frontLot = new Map(); // sku -> oldest remaining lot_number
let mismatch = 0;
for (const [sku, arr] of bySku) {
  arr.sort((a, b) => a.date.localeCompare(b.date));
  let need = consumed.get(sku) || 0;
  for (const e of arr) {
    const use = Math.min(e.qty, need); const remaining = e.qty - use; need -= use;
    e.remaining = remaining;
    if (remaining > 0 && !frontLot.has(sku)) frontLot.set(sku, `RCV-${e.date.replace(/-/g, '')}`);
  }
  const sumRemain = arr.reduce((a, e) => a + e.remaining, 0);
  const stock = stockBy.get(sku) ?? 0;
  if (Math.abs(sumRemain - stock) > 0.001) { mismatch++; if (mismatch <= 10) console.log(`  ⚠ ${sku}: Σlot=${sumRemain} vs stock=${stock}`); }
  for (const e of arr) {
    lots.push({
      org_id: ORG, sku, lot_number: `RCV-${e.date.replace(/-/g, '')}`, batch_number: '',
      mfg_date: e.date, exp_date: null, status: e.remaining > 0 ? 'ACTIVE' : 'DEPLETED',
      received_qty: e.qty, current_qty: e.remaining, unit_cost: 0,
      notes: `รับเข้า ${e.date} (นำเข้าจากประวัติ)`, updated_at: new Date().toISOString(),
    });
  }
}
console.log(`IN rows ${IN.length} | lots ${lots.length} (active ${lots.filter(l=>l.current_qty>0).length}) | SKUs ${bySku.size} | mismatches ${mismatch}`);
console.log('SAMPLE:', lots.slice(0, 2));
console.log(`stock_locations to stamp: SKUs with a remaining front-lot = ${frontLot.size}`);

if (!COMMIT) { console.log('\nDRY-RUN. add --commit to write.'); process.exit(0); }

// upsert lots (unique org,sku,lot_number)
let n = 0;
for (const c of chunk(lots, 200)) { await rest('POST', 'product_lots', c, { Prefer: 'resolution=merge-duplicates,return=minimal' }); n += c.length; process.stdout.write(`\r  lots ${n}/${lots.length}`); }
console.log('');

// stamp stock_locations.lot_no = front (oldest remaining) lot per sku
const skus = [...frontLot.keys()];
let s = 0;
for (const c of chunk(skus, 25)) {
  await Promise.all(c.map(sku => rest('PATCH', `stock_locations?org_id=eq.${ORG}&sku=eq.${encodeURIComponent(sku)}&quantity=gt.0`, { lot_no: frontLot.get(sku) }, { Prefer: 'return=minimal' })));
  s += c.length; process.stdout.write(`\r  stamped ${s}/${skus.length}`);
}
console.log('');
const total = await page(`product_lots?select=id&org_id=eq.${ORG}`);
console.log(`✅ DONE. product_lots now ${total.length}`);
