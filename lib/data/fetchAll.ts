/**
 * B2 — Paginate past Supabase's 1000-row response cap.
 *
 * A bare `.select()` silently returns at most 1000 rows, so any full-collection
 * read (products list, transaction history, aggregates) quietly truncates once
 * the table grows — giving wrong totals with no error. fetchAllRows pages with
 * `.range()` until a short page is returned.
 *
 * Pass a factory that builds a FRESH query for each page (a Supabase builder
 * can't be re-ranged), e.g.:
 *   fetchAllRows((from, to) =>
 *     supabase.from('products').select('*').eq('org_id', orgId).range(from, to))
 */

const PAGE = 1000;
const MAX_PAGES = 100; // hard safety stop (100k rows)

export async function fetchAllRows<T = any>(
  makeQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
  pageSize: number = PAGE,
): Promise<T[]> {
  const out: T[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * pageSize;
    const { data, error } = await makeQuery(from, from + pageSize - 1);
    if (error) { console.error('[fetchAllRows]', error.message); break; }
    const batch = data || [];
    out.push(...batch);
    if (batch.length < pageSize) break;
  }
  return out;
}
