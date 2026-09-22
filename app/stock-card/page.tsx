import { redirect } from 'next/navigation';

// Canonical stock card lives under /inventory/stock-card. This root path is a legacy alias.
export default async function StockCardRedirect({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp || {})) {
    if (typeof v === 'string') q.set(k, v);
    else if (Array.isArray(v)) v.forEach((x) => q.append(k, x));
  }
  const qs = q.toString();
  redirect(`/inventory/stock-card${qs ? `?${qs}` : ''}`);
}
