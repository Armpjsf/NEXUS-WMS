#!/usr/bin/env node
// Backfill outbound_orders.freight_cost from the migrated note ("ค่าขนส่ง=1600").
// Run AFTER sql/20260921_freight_cost.sql. Idempotent.
//   node scripts/backfill-freight.mjs --commit
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
const orders = await page(`outbound_orders?select=id,notes,freight_cost&org_id=eq.${ORG}`);
const updates = [];
for (const o of orders) {
  const m = String(o.notes || '').match(/ค่าขนส่ง\s*=?\s*([\d,]+(?:\.\d+)?)/);
  const freight = m ? Number(m[1].replace(/,/g, '')) || 0 : 0;
  if (freight > 0 && Number(o.freight_cost || 0) !== freight) updates.push({ id: o.id, freight_cost: freight });
}
console.log(`orders ${orders.length} | to set freight_cost ${updates.length} | รวม ฿${updates.reduce((a, u) => a + u.freight_cost, 0).toLocaleString()}`);
if (!COMMIT) { console.log('SAMPLE:', updates.slice(0, 3)); console.log('\nDRY-RUN. add --commit to write.'); process.exit(0); }

let done = 0;
for (const c of chunk(updates, 25)) {
  await Promise.all(c.map(u => rest('PATCH', `outbound_orders?id=eq.${u.id}`, { freight_cost: u.freight_cost }, { Prefer: 'return=minimal' })));
  done += c.length; process.stdout.write(`\r  ${done}/${updates.length}`);
}
console.log(`\n✅ DONE. freight_cost set on ${updates.length} orders`);
