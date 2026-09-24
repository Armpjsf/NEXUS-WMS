#!/usr/bin/env node
// Tenancy guard. The server talks to Supabase with the service-role key, which
// bypasses RLS, so EVERY query on a tenant table must filter/stamp org_id in
// app code. This scans app/ and lib/ for `.from('<table>')` statements and
// flags the ones that never mention org_id / orgId.
//
//   node scripts/check-org-scope.mjs          # report, exit 1 on findings
//   node scripts/check-org-scope.mjs --list   # also print the allowlisted hits
//
// A statement that is intentionally cross-tenant (login lookup, webhook by an
// unguessable id, platform tables) is marked with a trailing or preceding
// comment `org-scope-ok: <reason>` within the statement or up to 3 lines above it.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIRS = ['app', 'lib'];

// Tables that are not tenant data (platform-level or keyed by something else).
const GLOBAL_TABLES = new Set([
  'organizations',      // the tenant table itself (queried by id)
  'doc_sequences',
  'device_tokens',      // push infra, keyed by device
  'push_subscriptions',
  'rate_limits',
]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

/** Return the statement text starting at `idx`: up to the first `;` at depth 0. */
function statementAt(src, idx) {
  let depth = 0;
  for (let i = idx; i < src.length; i++) {
    const c = src[i];
    // Skip line comments (a `;` inside one must not end the statement). Not
    // for `://` inside URLs.
    if (c === '/' && src[i + 1] === '/' && src[i - 1] !== ':') { const nl = src.indexOf('\n', i); if (nl < 0) break; i = nl; continue; }
    if (c === '(' || c === '{' || c === '[') depth++;
    else if (c === ')' || c === '}' || c === ']') { depth--; if (depth < 0) return src.slice(idx, i); }
    else if (c === ';' && depth <= 0) return src.slice(idx, i);
  }
  return src.slice(idx);
}

function lineOf(src, idx) {
  return src.slice(0, idx).split('\n').length;
}

const findings = [];
const allowed = [];
for (const dir of DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const src = readFileSync(file, 'utf8');
    const re = /\.from\(\s*['"`]([a-z0-9_]+)['"`]\s*\)/g;
    let m;
    while ((m = re.exec(src))) {
      const table = m[1];
      if (GLOBAL_TABLES.has(table)) continue;
      // storage.from('bucket') is not a table
      const before = src.slice(Math.max(0, m.index - 12), m.index);
      if (/storage\s*$/.test(before)) continue;
      // Include the chain head (e.g. `await supabase\n  .from(...)`) and the line above.
      let lineStart = m.index;
      for (let k = 0; k < 3 && lineStart > 0; k++) lineStart = src.lastIndexOf('\n', lineStart - 1);
      const stmt = src.slice(Math.max(0, lineStart), m.index) + statementAt(src, m.index);
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      const where = `${rel}:${lineOf(src, m.index)}`;
      if (/org-scope-ok/.test(stmt)) { allowed.push(`${where}  ${table}`); continue; }
      if (/org_id|orgId/.test(stmt)) continue;
      // `.insert(rows)` / `.upsert(rows)` with a variable: accept when that
      // variable is built with org_id in the preceding 60 lines.
      const argVar = /\.(insert|upsert)\(\s*([A-Za-z_$][\w$]*)\s*[,)]/.exec(stmt);
      if (argVar) {
        const window = src.slice(0, m.index).split('\n').slice(-60).join('\n');
        const v = argVar[2];
        if (window.includes('org_id') && new RegExp(`\\b${v}\\b`).test(window)) continue;
      }
      findings.push(`${where}  ${table}`);
    }
  }
}

if (process.argv.includes('--list')) {
  console.log(`Allowlisted (org-scope-ok): ${allowed.length}`);
  for (const a of allowed) console.log('  ok  ' + a);
}
if (findings.length) {
  console.log(`\n${findings.length} query statement(s) on tenant tables without org_id:`);
  for (const f of findings) console.log('  !!  ' + f);
  console.log('\nFix: add .eq(\'org_id\', orgId) / stamp org_id on insert, or mark `// org-scope-ok: <reason>`.');
  process.exit(1);
}
console.log(`org-scope check passed (${allowed.length} allowlisted).`);
