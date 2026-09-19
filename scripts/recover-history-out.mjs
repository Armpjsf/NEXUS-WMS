#!/usr/bin/env node
// Bulk apply OUT/DAMAGE history (deduct stock) — companion to recover-history.mjs.
// Deducts each SKU's total from its bins (fullest-first), reconciles products,
// and writes the OUT/DAMAGE ledger with original dates. Direct-to-Supabase.
//
//   node scripts/recover-history-out.mjs "C:/path/history.xlsx"

import * as XLSX from 'xlsx';
import fs from 'fs';

const FILE = process.argv[2] || 'C:/Users/Armdd/Downloads/NEXUS_WMS_Stock_History_Template.xlsx';
const ORG = '00000000-0000-0000-0000-000000000001';
const env = fs.readFileSync('.env.local', 'utf8');
const pick = (k) => (env.split('\n').find(l => l.startsWith(k + '=')) || '').split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '');
const URL = pick('NEXT_PUBLIC_SUPABASE_URL'), KEY = pick('SUPABASE_SERVICE_ROLE_KEY');
const H = { apikey: KEY, authorization: `Bearer ${KEY}`, 'content-type': 'application/json' };
async function rest(m, p, b, x = {}) { const r = await fetch(URL + '/rest/v1/' + p, { method: m, headers: { ...H, ...x }, body: b ? JSON.stringify(b) : undefined }); if (!r.ok) throw new Error(`${m} ${p.slice(0, 50)} ${r.status} ${(await r.text()).slice(0, 200)}`); return r; }
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
const inlist = (arr) => arr.map(s => `"${s}"`).join(',');

const rows = XLSX.utils.sheet_to_json(XLSX.read(fs.readFileSync(FILE), { type: 'buffer', cellDates: true }).Sheets[XLSX.read(fs.readFileSync(FILE), { type: 'buffer' }).SheetNames[0]], { defval: '' });
const K = Object.keys(rows[0]);

const perSku = new Map();   // sku -> total to deduct
const ledger = [];
let skipped = 0;
for (const r of rows) {
  const type = String(r[K[1]] || '').trim().toUpperCase();
  const sku = String(r[K[2]] || '').trim();
  const qty = Number(r[K[3]] || 0);
  if (!['OUT', 'DAMAGE'].includes(type) || !sku || !(qty > 0)) { skipped++; continue; }
  const dv = r[K[0]];
  const when = dv instanceof Date ? dv.toISOString() : (String(dv || '').trim() ? new Date(String(dv).trim()).toISOString() : new Date().toISOString());
  perSku.set(sku, (perSku.get(sku) || 0) + qty);
  ledger.push({ type, sku, qty, when, loc: String(r[K[4]] || '').trim(), ref: String(r[K[5]] || '').trim(), note: String(r[K[6]] || '').trim() });
}
const skus = [...perSku.keys()];
console.log(`OUT/DAMAGE ใช้ได้ ${ledger.length} | ข้าม ${skipped} | SKU ${skus.length} | รวมจ่ายออก ${[...perSku.values()].reduce((a, b) => a + b, 0)}`);

// names + current bins
const nameMap = new Map(), binsBySku = new Map();
for (const c of chunk(skus, 50)) {
  for (const p of await (await rest('GET', `products?select=sku,name&sku=in.(${inlist(c)})`)).json()) nameMap.set(p.sku, p.name || p.sku);
  for (const b of await (await rest('GET', `stock_locations?select=sku,bin_code,quantity&org_id=eq.${ORG}&sku=in.(${inlist(c)})`)).json()) {
    if (!binsBySku.has(b.sku)) binsBySku.set(b.sku, []);
    binsBySku.get(b.sku).push({ bin: b.bin_code, q: Number(b.quantity || 0) });
  }
}

// deduct fullest-first, compute new bins + report shortfalls
console.log('\n[1] คำนวณตัดสต็อกต่อ bin (fullest-first)...');
const newBins = [];   // {sku,bin,qty}
const shortfalls = [];
for (const sku of skus) {
  let need = perSku.get(sku);
  const bins = (binsBySku.get(sku) || []).sort((a, b) => b.q - a.q);
  for (const b of bins) { const use = Math.min(b.q, need); b.q -= use; need -= use; }
  if (need > 0.001) shortfalls.push([sku, need]);
  for (const b of bins) if (b.q > 0.001) newBins.push({ org_id: ORG, sku, bin_code: b.bin, quantity: b.q });
}
if (shortfalls.length) console.log('⚠️ จ่ายเกินสต็อก (คงเหลือ 0):', shortfalls.slice(0, 10));

// rebuild bins for these SKUs (delete + insert remaining)
console.log('[2] อัปเดต stock_locations...');
for (const c of chunk(skus, 40)) await rest('DELETE', `stock_locations?org_id=eq.${ORG}&sku=in.(${inlist(c)})`);
for (const c of chunk(newBins, 500)) await rest('POST', 'stock_locations', c);

// reconcile products.stock + location
console.log('[3] ปรับ products.stock...');
const remain = new Map();
for (const b of newBins) { const cur = remain.get(b.sku) || { total: 0, primary: b.bin_code, pq: 0 }; cur.total += b.quantity; if (b.quantity > cur.pq) { cur.pq = b.quantity; cur.primary = b.bin_code; } remain.set(b.sku, cur); }
let done = 0;
for (const c of chunk(skus, 25)) {
  await Promise.all(c.map(async (sku) => {
    const info = remain.get(sku) || { total: 0, primary: 'Unassigned' };
    await rest('PATCH', `products?org_id=eq.${ORG}&sku=eq.${encodeURIComponent(sku)}`, { stock: info.total, location: info.primary, updated_at: new Date().toISOString() }, { Prefer: 'return=minimal' });
  }));
  done += c.length; process.stdout.write(`\r   ${done}/${skus.length}`);
}
console.log('');

// ledger
console.log('[4] ลง ledger OUT/DAMAGE...');
const txns = ledger.filter(l => nameMap.has(l.sku)).map(l => ({ org_id: ORG, type: l.type, sku: l.sku, product_name: nameMap.get(l.sku), qty: l.qty, unit_price: 0, doc_ref: l.ref || `HIST-${l.type}`, location: l.loc, user_name: 'import', notes: l.note || null, created_at: l.when }));
for (const c of chunk(txns, 500)) await rest('POST', 'stock_transactions', c);

const total = await (await rest('GET', `products?select=stock&limit=1000`)).json();
console.log(`\n✅ เสร็จ — ledger OUT/DAMAGE: ${txns.length} | ยอดสต็อกรวมทั้งคลังตอนนี้: ${total.reduce((a, p) => a + Number(p.stock || 0), 0)}`);
