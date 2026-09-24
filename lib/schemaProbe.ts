// Does a column exist yet? Used where code ships ahead of a hand-run SQL file
// (see sql/README.md) and must degrade instead of failing. Cached per process.
import { getServiceSupabase } from './supabase';

const cache = new Map<string, boolean>();

export async function hasColumn(table: string, column: string): Promise<boolean> {
  const key = `${table}.${column}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  // org-scope-ok: schema probe — selects zero rows' worth of data, returns only a boolean
  const { error } = await getServiceSupabase().from(table).select(column).limit(0);
  const ok = !error;
  if (ok) cache.set(key, true); // only cache success: a later SQL run should be picked up
  return ok;
}
