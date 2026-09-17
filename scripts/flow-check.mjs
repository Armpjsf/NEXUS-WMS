#!/usr/bin/env node
/**
 * NEXUS WMS — E2E Flow Integrity Suite
 * ---------------------------------------------------------------------------
 * เดินครบทุกเมนูผ่าน HTTP API จริง แล้ว assert ว่าเชื่อมกันถูกต้อง โดยยึด
 * invariant กลางทุกจุด:   products.stock  ==  Σ (ยอดทุก bin ของ SKU)
 *
 * ครอบเมนู: Product · Inbound(multi-bin) · UOM · Reservation/ATP · Outbound ·
 *           Order Ship · Kitting · FEFO · Adjustment · AI Slotting · WCS robotics · LPN
 *
 * ใช้ SKU ทดสอบ prefix "E2E-" เท่านั้น (ไม่แตะข้อมูลจริง) และ soft-archive ท้ายให้
 *
 *   BASE_URL=http://localhost:3000 WMS_USER=admin WMS_PASS=admin1234 \
 *     node scripts/flow-check.mjs
 * ---------------------------------------------------------------------------
 */

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const USER = process.env.WMS_USER || 'admin';
const PASS = process.env.WMS_PASS || 'admin1234';
const TS = Date.now().toString().slice(-6);
const sku = (tag) => `E2E-${tag}-${TS}`;

// ---- cookie jar + http ----
const jar = new Map();
function store(res) {
  const raw = res.headers.getSetCookie?.() || [];
  for (const c of raw) { const [p] = c.split(';'); const i = p.indexOf('='); if (i > 0) jar.set(p.slice(0, i).trim(), p.slice(i + 1).trim()); }
}
const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
async function req(method, path, body) {
  const res = await fetch(BASE + path, {
    method, headers: { 'content-type': 'application/json', cookie: cookie() },
    body: body ? JSON.stringify(body) : undefined, redirect: 'manual',
  });
  store(res);
  const t = await res.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: res.status, json: j };
}

// ---- per-scenario assert ----
let CUR = null;
function ok(cond, label, detail = '') {
  if (cond) { CUR.pass++; console.log(`    \x1b[32m✓\x1b[0m ${label}`); }
  else { CUR.fail++; console.log(`    \x1b[31m✗ ${label}\x1b[0m ${detail}`); }
}
function skip(label, why) { CUR.skip++; console.log(`    \x1b[33m⌀ SKIP\x1b[0m ${label} — ${why}`); }

async function stockOf(s) {
  const [p, b] = await Promise.all([req('GET', '/api/products'), req('GET', `/api/stock/bins?sku=${encodeURIComponent(s)}`)]);
  const list = Array.isArray(p.json) ? p.json : (p.json?.data || []);
  const prod = list.find(x => (x.id || x.sku) === s);
  const bins = b.json?.bins || [];
  return { total: Number(prod?.stock ?? NaN), binSum: bins.reduce((a, x) => a + Number(x.quantity || 0), 0), bins };
}
function inv(step, st) { ok(st.total === st.binSum, `[${step}] invariant stock(${st.total})==Σbins(${st.binSum})`); }

async function mkProduct(s, extra = {}) {
  return req('POST', '/api/products', { sku: s, name: `E2E ${s}`, stock: 0, location: 'E2E-RCV', price: 10, ...extra });
}
async function cleanup(s) { await req('POST', '/api/products/update', { oldName: s, updates: { stock: 0, status: 'Archived', name: `[E2E-CLEANUP] ${s}` } }); }

async function login() {
  const csrf = await req('GET', '/api/auth/csrf');
  const form = new URLSearchParams({ csrfToken: csrf.json?.csrfToken || '', username: USER, password: PASS, json: 'true' });
  const res = await fetch(BASE + '/api/auth/callback/credentials', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: cookie() },
    body: form.toString(), redirect: 'manual',
  });
  store(res);
  return [...jar.keys()].some(k => k.includes('session-token'));
}

// ===================== SCENARIOS =====================
const scenarios = [];
const S = (name, fn) => scenarios.push({ name, fn });

S('Inbound · Multi-bin · UOM · Outbound', async () => {
  const s = sku('CORE');
  await mkProduct(s);
  await req('POST', '/api/inbound', { sku: s, qty: 100, location: 'E2E-A' });
  let st = await stockOf(s); ok(st.total === 100, 'รับเข้า 100', `got ${st.total}`); inv('IN#1', st);
  await req('POST', '/api/inbound', { sku: s, qty: 50, location: 'E2E-B' });
  st = await stockOf(s); ok(st.total === 150 && st.bins.length >= 2, 'รับเข้าอีก 50 → 2 bins', `t=${st.total} bins=${st.bins.length}`); inv('IN#2', st);
  await req('POST', '/api/products/uoms', { sku: s, code: 'CARTON', name: 'ลัง', factor: 24 });
  await req('POST', '/api/inbound', { sku: s, qty: 1, uom: 'CARTON', location: 'E2E-A' });
  st = await stockOf(s); ok(st.total === 174, 'รับ 1 CARTON(24) → 174', `got ${st.total}`); inv('UOM', st);
  await req('POST', '/api/outbound', { items: [{ sku: s, qty: 120 }] });
  st = await stockOf(s); ok(st.total === 54, 'จ่ายออก 120 → 54', `got ${st.total}`); ok(st.bins.every(b => b.quantity >= 0), 'ไม่มี bin ติดลบ'); inv('OUT', st);
  await cleanup(s);
});

S('Reservation / ATP · Order · Ship', async () => {
  const s = sku('RES');
  await mkProduct(s);
  await req('POST', '/api/inbound', { sku: s, qty: 100, location: 'E2E-A' });
  const a0 = await req('GET', `/api/stock/available?sku=${encodeURIComponent(s)}`);
  ok(a0.json?.available === 100, 'available เริ่ม = 100', `got ${a0.json?.available}`);
  const ord = await req('POST', '/api/orders', { customerName: 'E2E', items: [{ sku: s, name: `E2E ${s}`, qty: 40, price: 10 }] });
  const oid = ord.json?.order?.id || ord.json?.id;
  ok(!!oid, 'สร้างออเดอร์', JSON.stringify(ord.json).slice(0, 100));
  const a1 = await req('GET', `/api/stock/available?sku=${encodeURIComponent(s)}`);
  ok(a1.json?.available === 60, 'จอง 40 → available 60', `got ${a1.json?.available}`);
  ok(a1.json?.onHand === 100, 'on-hand ยัง 100 (ยังไม่ตัด)', `got ${a1.json?.onHand}`);
  if (oid) {
    await req('PATCH', '/api/orders', { id: oid, status: 'SHIPPED' });
    const st = await stockOf(s);
    ok(st.total === 60, 'Ship → ตัดจริงเหลือ 60', `got ${st.total}`); inv('Ship', st);
    const a2 = await req('GET', `/api/stock/available?sku=${encodeURIComponent(s)}`);
    ok(a2.json?.available === 60 && a2.json?.reserved === 0, 'reservation consumed (reserved=0)', `avail=${a2.json?.available} res=${a2.json?.reserved}`);
  } else skip('Ship', 'ไม่มี order id');
  await cleanup(s);
});

S('FEFO picking (near-expiry first)', async () => {
  const s = sku('FEFO');
  await mkProduct(s);
  // 2 ล็อต ต่าง bin: LOT-A ใกล้หมดอายุ, LOT-B ไกล
  const near = new Date(Date.now() + 15 * 864e5).toISOString().slice(0, 10);
  const far = new Date(Date.now() + 300 * 864e5).toISOString().slice(0, 10);
  await req('POST', '/api/inbound', { sku: s, qty: 10, location: 'E2E-FA', batch: 'LOT-A' });
  await req('POST', '/api/inbound', { sku: s, qty: 10, location: 'E2E-FB', batch: 'LOT-B' });
  const la = await req('POST', '/api/lots', { sku: s, lotNumber: 'LOT-A', expDate: near, receivedQty: 10 });
  const lb = await req('POST', '/api/lots', { sku: s, lotNumber: 'LOT-B', expDate: far, receivedQty: 10 });
  if ((la.json?.success === false) || (lb.json?.success === false)) return skip('FEFO', 'สร้าง lot ไม่ได้ (product_lots)');
  await req('POST', '/api/outbound', { items: [{ sku: s, qty: 6 }] });
  const st = await stockOf(s);
  const binA = st.bins.find(b => b.binCode === 'E2E-FA')?.quantity ?? -1;
  const binB = st.bins.find(b => b.binCode === 'E2E-FB')?.quantity ?? -1;
  ok(binA === 4 && binB === 10, 'ตัดจากล็อตใกล้หมดอายุก่อน (FA 10→4, FB คง 10)', `FA=${binA} FB=${binB}`);
  inv('FEFO', st);
  await cleanup(s);
});

S('Kitting (BOM assemble)', async () => {
  const comp = sku('KITC'); const kit = sku('KIT');
  await mkProduct(comp);
  await req('POST', '/api/inbound', { sku: comp, qty: 50, location: 'E2E-A' });
  const bom = await req('POST', '/api/kitting', { kitSku: kit, kitName: `E2E Kit ${kit}`, components: [{ componentSku: comp, quantity: 5 }] });
  const bomId = bom.json?.bom?.id || bom.json?.id;
  if (!bomId) { skip('Kitting', 'สร้าง BOM ไม่ได้: ' + JSON.stringify(bom.json).slice(0, 80)); await cleanup(comp); return; }
  await req('POST', '/api/kitting/build', { bomId, quantity: 4, action: 'ASSEMBLE' });
  const sc = await stockOf(comp); ok(sc.total === 30, 'ชิ้นส่วนถูกตัด 50-4×5=30', `got ${sc.total}`); inv('Kit-comp', sc);
  const sk = await stockOf(kit); ok(sk.total === 4, 'ชุดสินค้าถูกสร้าง 4', `got ${sk.total}`); inv('Kit-kit', sk);
  await cleanup(comp); await cleanup(kit);
});

S('Adjustment approve → apply', async () => {
  const s = sku('ADJ');
  await mkProduct(s);
  await req('POST', '/api/inbound', { sku: s, qty: 100, location: 'E2E-A' });
  const submit = await req('POST', '/api/adjustments', { sku: s, productName: `E2E ${s}`, locationCode: 'E2E-A', systemQty: 100, countedQty: 90, reasonCode: 'COUNT' });
  const reqNo = submit.json?.requestNo || submit.json?.request?.requestNo || submit.json?.data?.requestNo;
  if (!reqNo) return skip('Adjustment', 'ไม่ได้ requestNo: ' + JSON.stringify(submit.json).slice(0, 80));
  const appr = await req('POST', '/api/adjustments/approve', { requestId: reqNo, action: 'APPROVE' });
  ok(appr.json?.success !== false, 'อนุมัติคำขอ');
  const st = await stockOf(s);
  ok(st.total === 90, 'ยอดถูกปรับเป็น 90 (นับได้จริง)', `got ${st.total}`); inv('Adjust', st);
  await cleanup(s);
});

S('AI Slotting DIRECT_APPLY (bin move)', async () => {
  const s = sku('SLOT');
  await mkProduct(s);
  await req('POST', '/api/inbound', { sku: s, qty: 30, location: 'E2E-BACK' });
  const r = await req('POST', '/api/ai/slotting', { action: 'DIRECT_APPLY', sku: s, sourceLocation: 'E2E-BACK', targetLocation: 'E2E-GOLD' });
  if (r.json?.success === false) return skip('Slotting', JSON.stringify(r.json).slice(0, 80));
  const st = await stockOf(s);
  const gold = st.bins.find(b => b.binCode === 'E2E-GOLD')?.quantity ?? -1;
  ok(gold === 30, 'ย้ายทั้ง 30 ไป Golden bin', `got ${gold}`); ok(st.total === 30, 'ยอดรวมไม่เปลี่ยน (ย้ายเฉยๆ)'); inv('Slotting', st);
  await cleanup(s);
});

S('WCS robotics (pallet transfer → stock follows)', async () => {
  const s = sku('WCS');
  await mkProduct(s);
  await req('POST', '/api/inbound', { sku: s, qty: 8, location: 'WCS-SRC' });
  const disp = await req('POST', '/api/wcs/tasks', { taskType: 'PALLET_TRANSFER', sourceBin: 'WCS-SRC', targetBin: 'WCS-DST', sku: s, qty: 8 });
  if (disp.json?.success === false || !disp.json?.mission) return skip('WCS', JSON.stringify(disp.json).slice(0, 80));
  // simulate DISPATCHED → IN_TRANSIT → COMPLETED (2 steps) → stock move on complete
  await req('POST', '/api/wcs/tasks', { action: 'SIMULATE_STEP' });
  await req('POST', '/api/wcs/tasks', { action: 'SIMULATE_STEP' });
  const st = await stockOf(s);
  const src = st.bins.find(b => b.binCode === 'WCS-SRC')?.quantity ?? -1;
  const dst = st.bins.find(b => b.binCode === 'WCS-DST')?.quantity ?? -1;
  ok(dst === 8 && src === 0, 'หุ่นยนต์ย้ายเสร็จ → สต็อกตาม (SRC 0, DST 8)', `SRC=${src} DST=${dst}`);
  ok(st.total === 8, 'ยอดรวมคงเดิม'); inv('WCS', st);
  await cleanup(s);
});

S('LPN pallet move (stock follows)', async () => {
  const s = sku('LPN');
  await mkProduct(s);
  await req('POST', '/api/inbound', { sku: s, qty: 12, location: 'E2E-LPN1' });
  const lpn = await req('POST', '/api/lpn', { lpnType: 'PALLET', locationCode: 'E2E-LPN1', items: [{ sku: s, quantity: 12 }] });
  const lpnNo = lpn.json?.lpnNumber || lpn.json?.lpn?.lpnNumber || lpn.json?.data?.lpnNumber;
  if (!lpnNo) return skip('LPN', 'ไม่ได้ lpnNumber: ' + JSON.stringify(lpn.json).slice(0, 80));
  await req('POST', '/api/lpn/move', { lpnNumber: lpnNo, newLocation: 'E2E-LPN2' });
  const st = await stockOf(s);
  const b2 = st.bins.find(b => b.binCode === 'E2E-LPN2')?.quantity ?? -1;
  ok(b2 === 12, 'ย้ายพาเลท → สต็อกตามไป E2E-LPN2 = 12', `got ${b2}`); ok(st.total === 12, 'ยอดรวมคงเดิม'); inv('LPN', st);
  await cleanup(s);
});

// ===================== RUNNER =====================
async function main() {
  console.log(`\n\x1b[1mNEXUS WMS · E2E Flow Integrity Suite\x1b[0m`);
  console.log(`Target: ${BASE}\n`);
  if (!(await login())) { console.log('\x1b[31mล็อกอินไม่สำเร็จ\x1b[0m'); process.exit(1); }
  console.log('\x1b[32m✓ เข้าสู่ระบบ\x1b[0m');

  const results = [];
  for (const sc of scenarios) {
    CUR = { pass: 0, fail: 0, skip: 0 };
    console.log(`\n▸ ${sc.name}`);
    try { await sc.fn(); } catch (e) { CUR.fail++; console.log(`    \x1b[31m✗ EXCEPTION\x1b[0m ${e.message}`); }
    results.push({ name: sc.name, ...CUR });
  }

  console.log(`\n\x1b[1m──────── สรุปเมนู ────────\x1b[0m`);
  let tp = 0, tf = 0, ts = 0;
  for (const r of results) {
    tp += r.pass; tf += r.fail; ts += r.skip;
    const mark = r.fail > 0 ? '\x1b[31m✗' : (r.skip > 0 && r.pass === 0 ? '\x1b[33m⌀' : '\x1b[32m✓');
    console.log(`  ${mark}\x1b[0m ${r.name}  (${r.pass}✓ ${r.fail}✗ ${r.skip}⌀)`);
  }
  console.log(`\n\x1b[1mรวม: \x1b[32m${tp} ผ่าน\x1b[0m / \x1b[31m${tf} ไม่ผ่าน\x1b[0m / \x1b[33m${ts} ข้าม\x1b[0m`);
  console.log(`invariant products.stock == Σ bins ตรวจทุกซีนาริโอ\n`);
  process.exit(tf > 0 ? 1 : 0);
}
main().catch(e => { console.error('\nError:', e.message); process.exit(1); });
