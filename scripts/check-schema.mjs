#!/usr/bin/env node
// Schema drift check: does the live Supabase database have every table and
// RPC function the code uses? SQL files are run by hand (see sql/README.md),
// so production can silently lag behind the code — this catches it.
//
//   node scripts/check-schema.mjs            # uses .env.local
//
// Read-only: fetches the PostgREST OpenAPI index (GET /rest/v1/). For each
// missing object it names the sql/ file that creates it.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function loadEnv() {
  const env = { ...process.env };
  for (const name of ['.env.local', '.env']) {
    const p = join(ROOT, name);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return env;
}

function walk(dir, exts, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, exts, out);
    else if (exts.some(e => name.endsWith(e))) out.push(p);
  }
  return out;
}

// 1) What the code uses.
const tables = new Map();   // name -> first usage
const rpcs = new Map();
for (const file of [...walk(join(ROOT, 'app'), ['.ts', '.tsx']), ...walk(join(ROOT, 'lib'), ['.ts'])]) {
  const src = readFileSync(file, 'utf8');
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  for (const m of src.matchAll(/(\w+)?\s*\.from\(\s*['"`]([a-z0-9_]+)['"`]\s*\)/g)) {
    if (m[1] === 'storage') continue;
    if (/storage\s*$/.test(src.slice(Math.max(0, m.index - 12), m.index + (m[1] ? m[1].length : 0)))) continue;
    if (!tables.has(m[2])) tables.set(m[2], rel);
  }
  for (const m of src.matchAll(/\.rpc\(\s*['"`]([a-z0-9_]+)['"`]/g)) {
    if (!rpcs.has(m[1])) rpcs.set(m[1], rel);
  }
  // RPC names passed through a variable, e.g. rpc(fn, args) with fn = 'wms_bin_add'
  // (filtered against real function names below).
  if (/\.rpc\(\s*[A-Za-z_]/.test(src)) {
    for (const m of src.matchAll(/['"`](wms_[a-z0-9_]+)['"`]/g)) {
      if (!rpcs.has(m[1])) rpcs.set(m[1], { rel, indirect: true });
    }
  }
}

// 2) Which sql/ file creates each object (for the hint).
const createdIn = new Map();
const sqlFunctions = new Set();
for (const file of walk(join(ROOT, 'sql'), ['.sql']).sort()) {
  if (file.includes('legacy')) continue;
  const src = readFileSync(file, 'utf8').toLowerCase();
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  for (const m of src.matchAll(/create\s+table\s+if\s+not\s+exists\s+(?:public\.)?([a-z0-9_]+)/g)) {
    if (!createdIn.has(m[1])) createdIn.set(m[1], rel);
  }
  for (const m of src.matchAll(/create\s+or\s+replace\s+function\s+(?:public\.)?([a-z0-9_]+)/g)) {
    if (!createdIn.has(m[1])) createdIn.set(m[1], rel);
    sqlFunctions.add(m[1]);
  }
}
// Indirect names only count when they are real SQL functions.
for (const [name, v] of [...rpcs]) {
  if (typeof v === 'object') {
    if (sqlFunctions.has(name)) rpcs.set(name, v.rel); else rpcs.delete(name);
  }
}

// 3) What the database has.
const env = loadEnv();
const url = (env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const key = env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!url || !key) {
  console.error('Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (in .env.local or the environment).');
  process.exit(2);
}
const res = await fetch(`${url}/rest/v1/`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
if (!res.ok) {
  console.error(`Could not read the schema index: HTTP ${res.status} ${await res.text()}`);
  process.exit(2);
}
const paths = Object.keys((await res.json()).paths || {});
const haveTables = new Set(paths.filter(p => !p.startsWith('/rpc/')).map(p => p.slice(1)));
const haveRpcs = new Set(paths.filter(p => p.startsWith('/rpc/')).map(p => p.slice(5)));

const missingTables = [...tables].filter(([t]) => !haveTables.has(t));
const missingRpcs = [...rpcs].filter(([r]) => !haveRpcs.has(r));

console.log(`Code uses ${tables.size} tables and ${rpcs.size} RPC functions; database exposes ${haveTables.size} tables / ${haveRpcs.size} RPCs.`);
const hint = n => createdIn.get(n) ? `run ${createdIn.get(n)}` : 'no sql/ file creates it';
if (missingTables.length) {
  console.log(`\nMissing tables (${missingTables.length}):`);
  for (const [t, where] of missingTables) console.log(`  !! ${t.padEnd(32)} used in ${where}  → ${hint(t)}`);
}
if (missingRpcs.length) {
  console.log(`\nMissing RPC functions (${missingRpcs.length}) — code falls back to slower/non-atomic paths:`);
  for (const [r, where] of missingRpcs) console.log(`  !! ${r.padEnd(32)} used in ${where}  → ${hint(r)}`);
}
if (missingTables.length || missingRpcs.length) {
  console.log('\nIf the SQL was already run, reload the PostgREST cache: NOTIFY pgrst, \'reload schema\';');
  process.exitCode = 1;
} else {
  console.log('Schema is in sync with the code.');
}
