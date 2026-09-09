import { NextResponse } from 'next/server';
import { getProducts } from '@/lib/data/wms';

export const dynamic = 'force-dynamic';

// Core is a single Supabase warehouse (no per-customer branch spreadsheets).
// Aggregate the one warehouse and expose it in the legacy { branches, global } shape.
export async function GET() {
  try {
    const products = await getProducts();

    const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
    const totalValue = products.reduce((sum, p) => sum + p.stock * p.price, 0);
    const lowStockCount = products.filter((p) => p.stock <= p.minStock).length;
    const activeCount = products.filter((p) => p.status !== 'Inactive' && p.status !== 'INACTIVE').length;

    const mainBranch = {
      id: 'HQ',
      name: 'คลังหลัก (Main Warehouse)',
      color: '#0ea5e9',
      totalStock,
      totalValue,
      lowStockCount,
      activeCount,
      status: 'Online' as const,
    };

    return NextResponse.json({
      branches: [mainBranch],
      global: { totalStock, totalValue, lowStockCount },
    });
  } catch (error) {
    console.error('HQ Stats API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch HQ stats' }, { status: 500 });
  }
}
