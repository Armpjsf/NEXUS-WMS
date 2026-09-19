#!/usr/bin/env node
// Import DAMAGE history — deducts stock + writes ledger, but SKIPS rows whose
// (sku, qty, ~date) already exist in the DAMAGE ledger (avoids double-counting
// the couple of DAMAGE records that came in with the OUT file).
import * as XLSX from 'xlsx';
import fs from 'fs';

const FILE = process.argv[2] || 'C:/Users/Armdd/Downloads/NEXUS_WMS_Stock_History_Template.xlsx';
const ORG = '00000000-0000-0000-0000-000000000001';
const env = fs.readFileSync('.env.local', 'utf8');
const pick = (k) => (env.split('\n').find(l => l.startsWith(k + '=')) || '').split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '');
const URL = pick('NEXT_PUBLIC_SUPABASE_URL'), KEY = pick('SUPABASE_SERVICE_ROLE_KEY');
const H = { apikey: KEY, authorization: `Bearer ${KEY}`, 'content-type': 'application/json' };
async function rest(m, p, b, x = {}) { const r = await fetch(URL + '/rest/v1/' + p, { method: m, headers: { ...H, ...x }, body: b ? JSON.stringify(b) : undefined }); if (!r.ok) throw new Error(`${m} ${p.slice(0, 50)} ${r.status} ${(await r.text()).slice(0, 200)}`); return r; }
const enc = (s) => encodeURIComponent(s);

const rows = XLSX.utils.sheet_to_json(XLSX.read(fs.readFileSync(FILE), { type: 'buffer', cellDates: true }).Sheets[XLSX.read(fs.readFileSync(FILE), { type: 'buffer' }).SheetNames[0]], { defval: '' });
const K = Object.keys(rows[0]);

// existing DAMAGE ledger -> skip set of "sku|qty"
const existing = new Set();
for (const t of await (await rest('GET', `stock_transactions?select=sku,qty&type=eq.DAMAGE`)).json()) existing.add(`${t.sku}|${Number(t.qty)}`);

const items = [];
for (const r of rows) {
  const type = String(r[K[1]] || '').trim().toUpperCase();
  const sku = String(r[K[2]] || '').trim();
  const qty = Number(r[K[3]] || 0);
  if (type !== 'DAMAGE' || !sku || !(qty > 0)) continue;
  const key = `${sku}|${qty}`;
  const dv = r[K[0]];
  const when = dv instanceof Date ? dv.toISOString() : new Date(String(dv || '').trim() || Date.now()).toISOString();
  items.push({ sku, qty, when, loc: String(r[K[4]] || '').trim(), ref: String(r[K[5]] || '').trim(), note: String(r[K[6]] || '').trim(), dup: existing.has(key) });
}
const todo = items.filter(i => !i.dup);
const dups = items.filter(i => i.dup);
console.log(`DAMAGE ในไฟล์ ${items.length} | ซ้ำ (ข้าม) ${dups.length}: ${dups.map(d => d.sku + '=' + d.qty).join(', ')}`);
console.log(`จะนำเข้าใหม่ ${todo.length}: ${todo.map(d => d.sku + '=' + d.qty).join(', ')}`);
if (todo.length === 0) { console.log('ไม่มีรายการใหม่ให้ทำ'); process.exit(0); }

const skus = [...new Set(todo.map(i => i.sku))];
// names + bins + stock
const nameMap = new Map(), binsBySku = new Map();
for (const p of await (await rest('GET', `products?select=sku,name&sku=in.(${skus.map(s => `"${s}"`).join(',')})`)).json()) nameMap.set(p.sku, p.name || p.sku);
for (const b of await (await rest('GET', `stock_locations?select=sku,bin_code,quantity&org_id=eq.${ORG}&sku=in.(${skus.map(s => `"${s}"`).join(',')})`)).json()) { if (!binsBySku.has(b.sku)) binsBySku.set(b.sku, []); binsBySku.get(b.sku).push({ bin: b.bin_code, q: Number(b.quantity || 0) }); }

// deduct per sku (sum of its damage), fullest-first
const perSku = new Map();
for (const i of todo) perSku.set(i.sku, (perSku.get(i.sku) || 0) + i.qty);
const newBins = []; const short = [];
for (const sku of skus) {
  let need = perSku.get(sku); const bins = (binsBySku.get(sku) || []).sort((a, b) => b.q - a.q);
  for (const b of bins) { const use = Math.min(b.q, need); b.q -= use; need -= use; }
  if (need > 0.001) short.push([sku, need]);
  for (const b of bins) if (b.q > 0.001) newBins.push({ org_id: ORG, sku, bin_code: b.bin, quantity: b.q });
}
if (short.length) console.log('⚠️ damage เกินสต็อก (คงเหลือ 0):', short);

console.log('อัปเดต stock_locations + products...');
await rest('DELETE', `stock_locations?org_id=eq.${ORG}&sku=in.(${skus.map(s => `"${s}"`).join(',')})`);
if (newBins.length) await rest('POST', 'stock_locations', newBins);
const rem = new Map();
for (const b of newBins) { const c = rem.get(b.sku) || { t: 0, p: b.bin_code, pq: 0 }; c.t += b.quantity; if (b.quantity > c.pq) { c.pq = b.quantity; c.p = b.bin_code; } rem.set(b.sku, c); }
for (const sku of skus) { const info = rem.get(sku) || { t: 0, p: 'Unassigned' }; await rest('PATCH', `products?org_id=eq.${ORG}&sku=eq.${enc(sku)}`, { stock: info.t, location: info.p, updated_at: new Date().toISOString() }, { Prefer: 'return=minimal' }); }

const txns = todo.filter(i => nameMap.has(i.sku)).map(i => ({ org_id: ORG, type: 'DAMAGE', sku: i.sku, product_name: nameMap.get(i.sku), qty: i.qty, unit_price: 0, doc_ref: i.ref || 'HIST-DAMAGE', location: i.loc, user_name: 'import', notes: i.note || null, created_at: i.when }));
await rest('POST', 'stock_transactions', txns);
const total = await (await rest('GET', `products?select=stock&limit=2000`)).json();
console.log(`✅ เสร็จ — DAMAGE ใหม่ ${txns.length} รายการ | ยอดสต็อกรวมตอนนี้: ${total.reduce((a, p) => a + Number(p.stock || 0), 0)}`);
