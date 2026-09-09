import { redirect } from 'next/navigation';

// Canonical stock card lives under /inventory/stock-card. This root path is a legacy alias.
export default function StockCardRedirect() {
  redirect('/inventory/stock-card');
}
