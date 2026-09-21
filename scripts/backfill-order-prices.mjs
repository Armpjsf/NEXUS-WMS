#!/usr/bin/env node
// Backfill per-line price + total_amount on migrated outbound orders from
// products.price (the import only carried sku/qty, so order value showed ฿0).
// Idempotent. Run:  node scripts/backfill-order-prices.mjs --commit
import fs from 'fs';

const ORG = '00000000-0000-0000-0000-000000000001';
const COMMIT = process.argv.includes('--commit');
const env = fs.readFileSync('.env.local', 'utf8');
const pick = (k) => (env.split('\n').find(l => l.startsWith(k + '=')) || '').split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '');
const URL = pick('NEXT_PUBLIC_SUPABASE_URL'), KEY = pick('SUPABASE_SERVICE_ROLE_KEY');
const H = { apikey: KEY, authorization: `Bearer ${KEY}`, 'content-type': 'application/json' };
async function rest(m, p, b, x = {}) { const r = await fetch(URL + '/rest/v1/' + p, { method: m, headers: { ...H, ...x }, body: b ? JSON.stringify(b) : undefined }); if (!r.ok) throw new Error(`${m} ${p.slice(0,50)} ${r.status} ${(await r.text()).slice(0,200)}`); return r; }
const page = async (path) => { let out = [], f = 0; for (;;) { const r = await rest('GET', path, null, { Range: `${f}-${f + 999}` }); const d = await r.json(); out = out.concat(d); if (d.length < 1000) break; f += 1000; } return out; };
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };

console.log('MODE:', COMMIT ? 'COMMIT' : 'DRY-RUN');
const prods = await page(`products?select=sku,price&org_id=eq.${ORG}`);
const priceBy = new Map(prods.map(p => [p.sku, Number(p.price || 0)]));
const orders = await page(`outbound_orders?select=id,order_no,items_json,total_amount&org_id=eq.${ORG}`);

const updates = [];
let noPriceSkus = new Set();
for (const o of orders) {
  const items = Array.isArray(o.items_json) ? o.items_json : [];
  if (items.length === 0) continue;
  let changed = false, total = 0;
  const newItems = items.map(it => {
    const price = priceBy.has(it.sku) ? priceBy.get(it.sku) : Number(it.price || 0);
    if (priceBy.has(it.sku) && !(priceBy.get(it.sku) > 0)) noPriceSkus.add(it.sku);
    total += (Number(it.qty) || 0) * price;
    if (Number(it.price || 0) !== price) changed = true;
    return { ...it, price };
  });
  if (changed || Number(o.total_amount || 0) !== total) {
    updates.push({ id: o.id, items_json: newItems, total_amount: total });
  }
}
const grand = updates.reduce((a, u) => a + u.total_amount, 0);
console.log(`orders ${orders.length} | to update ${updates.length} | มูลค่ารวมใหม่ ฿${grand.toLocaleString()} | SKU ไม่มีราคา ${noPriceSkus.size}`);
if (!COMMIT) { console.log('SAMPLE:', updates.slice(0, 2).map(u => ({ id: u.id.slice(0,8), total: u.total_amount }))); console.log('\nDRY-RUN. add --commit to write.'); process.exit(0); }

let done = 0;
for (const c of chunk(updates, 25)) {
  await Promise.all(c.map(u => rest('PATCH', `outbound_orders?id=eq.${u.id}`, { items_json: u.items_json, total_amount: u.total_amount }, { Prefer: 'return=minimal' })));
  done += c.length; process.stdout.write(`\r  ${done}/${updates.length}`);
}
console.log(`\n✅ DONE. priced ${updates.length} orders | มูลค่ารวม ฿${grand.toLocaleString()}`);
