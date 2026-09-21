#!/usr/bin/env node
// Classify migrated outbound orders into DELIVERY vs SELF_PICKUP.
// Rule (from the source file): the "ประวัติงานส่ง" tab is every delivered order.
// Those imported as order_no "S<Order>"; their ref_no is the real Order number.
// A "คลังข้อมูล" order counts as delivered when its ref_no (NO.Order) is in that
// set — otherwise it was a customer self-pickup.
// Run AFTER sql/20260921b_delivery_mode.sql. Idempotent.
//   node scripts/backfill-delivery-mode.mjs --commit
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
const orders = await page(`outbound_orders?select=id,order_no,ref_no,channel,delivery_mode&org_id=eq.${ORG}`);
// only classify migrated orders; leave manually-created ones as their form set them
const migrated = orders.filter(o => o.channel === 'MIGRATION');
const deliveredRefs = new Set(migrated.filter(o => String(o.order_no).startsWith('S')).map(o => String(o.ref_no || '').trim()).filter(Boolean));

const updates = [];
for (const o of migrated) {
  const isDelivery = String(o.order_no).startsWith('S') || deliveredRefs.has(String(o.ref_no || '').trim());
  const mode = isDelivery ? 'DELIVERY' : 'SELF_PICKUP';
  if (o.delivery_mode !== mode) updates.push({ id: o.id, delivery_mode: mode });
}
const nDeliv = updates.filter(u => u.delivery_mode === 'DELIVERY').length;
const nPickup = updates.filter(u => u.delivery_mode === 'SELF_PICKUP').length;
console.log(`migrated ${migrated.length} | จะตั้ง DELIVERY ${nDeliv} | SELF_PICKUP ${nPickup} | ไม่เปลี่ยน ${migrated.length - updates.length}`);
if (!COMMIT) { console.log('\nDRY-RUN. add --commit to write.'); process.exit(0); }

let done = 0;
for (const c of chunk(updates, 25)) {
  await Promise.all(c.map(u => rest('PATCH', `outbound_orders?id=eq.${u.id}`, { delivery_mode: u.delivery_mode }, { Prefer: 'return=minimal' })));
  done += c.length; process.stdout.write(`\r  ${done}/${updates.length}`);
}
console.log(`\n✅ DONE. classified ${updates.length} orders`);
