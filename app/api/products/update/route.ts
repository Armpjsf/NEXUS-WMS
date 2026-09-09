import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';

export const dynamic = 'force-dynamic';

// Map UI (camelCase) product updates -> Supabase (snake_case) columns.
function mapUpdates(updates: Record<string, any>) {
  const out: Record<string, any> = {};
  if (updates.name !== undefined) out.name = updates.name;
  if (updates.sku !== undefined) out.sku = updates.sku;
  if (updates.category !== undefined) out.category = updates.category;
  if (updates.stock !== undefined) out.stock = Number(updates.stock) || 0;
  if (updates.price !== undefined) out.price = Number(updates.price) || 0;
  if (updates.unit !== undefined) out.unit = updates.unit;
  if (updates.location !== undefined) out.location = updates.location;
  if (updates.status !== undefined) out.status = updates.status;
  if (updates.barcode !== undefined) out.barcode = updates.barcode;
  if (updates.minStock !== undefined) out.min_stock = Number(updates.minStock) || 0;
  if (updates.min_stock !== undefined) out.min_stock = Number(updates.min_stock) || 0;
  if (updates.image !== undefined) out.image_url = updates.image;
  if (updates.image_url !== undefined) out.image_url = updates.image_url;
  out.updated_at = new Date().toISOString();
  return out;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { oldName, updates } = body;

    if (!oldName || !updates) {
      return NextResponse.json({ error: 'Missing oldName or updates' }, { status: 400 });
    }

    const patch = mapUpdates(updates);
    const orgId = await getCurrentOrgId();

    // Match by SKU first, then fall back to name (legacy master keyed on name).
    let { data, error } = await supabase
      .from('products')
      .update(patch)
      .eq('org_id', orgId)
      .eq('sku', oldName)
      .select();

    if (!error && (!data || data.length === 0)) {
      ({ data, error } = await supabase
        .from('products')
        .update(patch)
        .eq('org_id', orgId)
        .eq('name', oldName)
        .select());
    }

    if (error) {
      console.error('Product Update Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data || data.length === 0) {
      return NextResponse.json({ error: `Product not found: ${oldName}` }, { status: 404 });
    }

    try {
      const { logAction } = await import('@/lib/auditTrail');
      // @ts-ignore
      const session = await getServerSession(authOptions);
      await logAction({
        userId: session?.user?.email || 'System',
        userName: session?.user?.name || 'Inventory Manager',
        action: 'UPDATE',
        module: 'Inventory',
        description: `Updated product master data: ${oldName}`,
        newValues: updates,
      });
    } catch (auditErr) {
      console.warn('Audit Log Failed:', auditErr);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Product Update Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
