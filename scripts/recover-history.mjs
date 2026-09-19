#!/usr/bin/env node
// One-off recovery for the interrupted stock-history import (all-IN opening load).
// Resets the file's SKUs to 0, rebuilds stock_locations + products.stock from the
// file (source of truth), and writes the full stock_transactions ledger with the
// original dates. Runs against Supabase directly (no Vercel timeout).
//
//   node scripts/recover-history.mjs "C:/path/NEXUS_WMS_Stock_History_Template.xlsx"

import * as XLSX from 'xlsx';
import fs from 'fs';

const FILE = process.argv[2] || 'C:/Users/Armdd/Downloads/NEXUS_WMS_Stock_History_Template.xlsx';
const ORG = '00000000-0000-0000-0000-000000000001';

// --- env ---
const env = fs.readFileSync('.env.local', 'utf8');
const pick = (k) => (env.split('\n').find(l => l.startsWith(k + '=')) || '').split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '');
const URL = pick('NEXT_PUBLIC_SUPABASE_URL');
const KEY = pick('SUPABASE_SERVICE_ROLE_KEY');
const H = { apikey: KEY, authorization: `Bearer ${KEY}`, 'content-type': 'application/json' };

async function rest(method, path, body, extraHeaders = {}) {
  const res = await fetch(URL + '/rest/v1/' + path, { method, headers: { ...H, ...extraHeaders }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) { const t = await res.text(); throw new Error(`${method} ${path.slice(0, 60)} -> ${res.status} ${t.slice(0, 200)}`); }
  return res;
}
const chunk = (arr, n) => { const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o; };

// --- read file ---
const wb = XLSX.read(fs.readFileSync(FILE), { type: 'buffer', cellDates: true });
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
const H0 = Object.keys(rows[0]);
const col = (r, i) => r[H0[i]];
const norm = (b) => { const s = String(b ?? '').trim(); return s || 'UNASSIGNED'; };

const binQty = new Map();      // key `${sku}|${bin}` -> qty
const skuTotal = new Map();    // sku -> total
const ledger = [];             // stock_transactions rows
let skipped = 0;
for (const r of rows) {
  const type = String(col(r, 1) || '').trim().toUpperCase();
  const sku = String(col(r, 2) || '').trim();
  const qty = Number(col(r, 3) || 0);
  if (type !== 'IN' || !sku || !(qty > 0)) { skipped++; continue; }
  const bin = norm(col(r, 4));
  const dv = col(r, 0);
  const when = dv instanceof Date ? dv.toISOString() : (String(dv || '').trim() ? new Date(String(dv).trim()).toISOString() : new Date().toISOString());
  binQty.set(`${sku}|${bin}`, (binQty.get(`${sku}|${bin}`) || 0) + qty);
  skuTotal.set(sku, (skuTotal.get(sku) || 0) + qty);
  ledger.push({ sku, qty, bin, when, ref: String(col(r, 5) || '').trim(), note: String(col(r, 6) || '').trim() });
}
const skus = [...skuTotal.keys()];
console.log(`ไฟล์: ${rows.length} แถว | IN ใช้ได้ ${ledger.length} | ข้าม ${skipped} | SKU ${skus.length} | ยอดรวม ${[...skuTotal.values()].reduce((a, b) => a + b, 0)}`);

// --- product names ---
const nameMap = new Map();
for (const c of chunk(skus, 60)) {
  const res = await rest('GET', `products?select=sku,name&sku=in.(${c.map(s => `"${s}"`).join(',')})`);
  for (const p of await res.json()) nameMap.set(p.sku, p.name || p.sku);
}
const missing = skus.filter(s => !nameMap.has(s));
if (missing.length) console.log(`⚠️ SKU ไม่พบใน products ${missing.length} ตัว (จะข้าม): ${missing.slice(0, 5).join(', ')}...`);

// ============ RESET ============
console.log('\n[1] รีเซ็ต stock_locations + ledger ของ SKU ในไฟล์...');
for (const c of chunk(skus.filter(s => nameMap.has(s)), 40)) {
  const inlist = c.map(s => `"${s}"`).join(',');
  await rest('DELETE', `stock_locations?org_id=eq.${ORG}&sku=in.(${inlist})`);
  await rest('DELETE', `stock_transactions?org_id=eq.${ORG}&user_name=eq.import&sku=in.(${inlist})`);
}

// ============ REBUILD BINS ============
console.log('[2] สร้าง stock_locations ใหม่จากไฟล์...');
const binRows = [];
for (const [k, q] of binQty) { const [sku, bin] = k.split('|'); if (nameMap.has(sku)) binRows.push({ org_id: ORG, sku, bin_code: bin, quantity: q }); }
for (const c of chunk(binRows, 500)) await rest('POST', 'stock_locations', c);

// ============ RECONCILE products.stock + location ============
console.log('[3] ปรับ products.stock = ผลรวม + location = bin ใหญ่สุด...');
let done = 0;
const skuList = skus.filter(s => nameMap.has(s));
for (const c of chunk(skuList, 25)) {
  await Promise.all(c.map(async (sku) => {
    const bins = [...binQty].filter(([k]) => k.startsWith(sku + '|')).map(([k, q]) => ({ bin: k.split('|')[1], q }));
    const total = bins.reduce((a, b) => a + b.q, 0);
    const primary = bins.sort((a, b) => b.q - a.q)[0]?.bin || 'UNASSIGNED';
    await rest('PATCH', `products?org_id=eq.${ORG}&sku=eq.${encodeURIComponent(sku)}`,
      { stock: total, location: primary, updated_at: new Date().toISOString() }, { Prefer: 'return=minimal' });
  }));
  done += c.length; process.stdout.write(`\r   ${done}/${skuList.length}`);
}
console.log('');

// ============ LEDGER ============
console.log('[4] ลง ledger stock_transactions (พร้อมวันที่จริง)...');
const txns = ledger.filter(l => nameMap.has(l.sku)).map(l => ({
  org_id: ORG, type: 'IN', sku: l.sku, product_name: nameMap.get(l.sku), qty: l.qty, unit_price: 0,
  doc_ref: l.ref || 'HIST-IN', location: l.bin === 'UNASSIGNED' ? '' : l.bin, user_name: 'import',
  notes: l.note || null, created_at: l.when,
}));
for (const c of chunk(txns, 500)) await rest('POST', 'stock_transactions', c);

// ============ VERIFY ============
const trCount = await (await rest('GET', `stock_transactions?select=id&org_id=eq.${ORG}&user_name=eq.import`, null, { Prefer: 'count=exact', Range: '0-0' })).headers.get('content-range');
const sample = await (await rest('GET', `products?select=sku,stock&sku=in.("A03200UN082977D","A00464UN082977D","A00933UN082977D")`)).json();
console.log(`\n✅ เสร็จ — ledger rows: ${trCount} | ตัวอย่างสต็อก:`, sample.map(p => `${p.sku}=${p.stock}`).join(', '));
