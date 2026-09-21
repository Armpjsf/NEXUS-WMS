/**
 * Normalize a scanned barcode/QR value to the SKU it represents.
 *
 * The app's own bin/label QR codes encode JSON, e.g.
 *   {"loc":"A-003","name":"HT8295MA072977","stock":15}
 * where `name` is the SKU. A plain 1D barcode is just the SKU string. This
 * helper returns the SKU for either, so scan-matching (QC, picking, …) works
 * whether the operator scans a QR label or a bare barcode.
 */
export function extractScannedSku(raw: string): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  // JSON label QR → pull the SKU field
  if (s.startsWith('{') || s.startsWith('[')) {
    try {
      const obj = JSON.parse(s);
      const o = Array.isArray(obj) ? obj[0] : obj;
      const sku = o?.name ?? o?.sku ?? o?.code ?? o?.barcode ?? o?.product;
      if (sku != null && String(sku).trim()) return String(sku).trim();
    } catch { /* not JSON — fall through */ }
  }
  return s;
}
