#!/usr/bin/env node
// Bulk-attach product image URLs (from the old system's export) into products.image_url.
//   node scripts/attach-images.mjs "C:/path/imgmap.json"
import fs from 'fs';

const MAP = process.argv[2] || 'C:/Users/Armdd/AppData/Local/Temp/imgmap.json';
const ORG = '00000000-0000-0000-0000-000000000001';
const env = fs.readFileSync('.env.local', 'utf8');
const pick = (k) => (env.split('\n').find(l => l.startsWith(k + '=')) || '').split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '');
const URL = pick('NEXT_PUBLIC_SUPABASE_URL'), KEY = pick('SUPABASE_SERVICE_ROLE_KEY');
const H = { apikey: KEY, authorization: `Bearer ${KEY}`, 'content-type': 'application/json' };
async function rest(m, p, b, x = {}) { const r = await fetch(URL + '/rest/v1/' + p, { method: m, headers: { ...H, ...x }, body: b ? JSON.stringify(b) : undefined }); if (!r.ok) throw new Error(`${m} ${p.slice(0,50)} ${r.status} ${(await r.text()).slice(0,200)}`); return r; }
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };

const map = JSON.parse(fs.readFileSync(MAP, 'utf8'));
const skus = Object.keys(map);
// only SKUs that exist in products
const exist = new Set();
for (const c of chunk(skus, 60)) for (const p of await (await rest('GET', `products?select=sku&org_id=eq.${ORG}&sku=in.(${c.map(s => `"${s}"`).join(',')})`)).json()) exist.add(p.sku);
const todo = skus.filter(s => exist.has(s) && String(map[s] || '').startsWith('http'));
console.log(`ในไฟล์ ${skus.length} | พบใน products ${exist.size} | จะแปะรูป ${todo.length}`);

let done = 0;
for (const c of chunk(todo, 20)) {
  await Promise.all(c.map(async (sku) => { await rest('PATCH', `products?org_id=eq.${ORG}&sku=eq.${encodeURIComponent(sku)}`, { image_url: map[sku], updated_at: new Date().toISOString() }, { Prefer: 'return=minimal' }); }));
  done += c.length; process.stdout.write(`\r   ${done}/${todo.length}`);
}
console.log('');
const withImg = await (await rest('GET', `products?select=sku&org_id=eq.${ORG}&image_url=not.is.null&limit=2000`)).json();
console.log(`✅ เสร็จ — สินค้าที่มีรูปตอนนี้: ${withImg.length}`);
