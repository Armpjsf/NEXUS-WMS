import { NextResponse } from 'next/server';
import { getSuppliers, getSupplierById, createSupplier, updateSupplier, deleteSupplier } from '@/lib/data/suppliers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (id) {
      const supplier = await getSupplierById(id);
      if (!supplier) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
      return NextResponse.json(supplier);
    }

    const q = searchParams.get('q') || undefined;
    const suppliers = await getSuppliers(q);
    return NextResponse.json({ suppliers });
  } catch (error: any) {
    console.error('API suppliers GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: 'กรุณาระบุชื่อผู้จำหน่าย' }, { status: 400 });
    }

    const supplier = await createSupplier(body);
    if (!supplier) return NextResponse.json({ error: 'เพิ่มผู้จำหน่ายไม่สำเร็จ' }, { status: 500 });
    return NextResponse.json({ success: true, supplier });
  } catch (error: any) {
    console.error('API suppliers POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...patch } = body;
    if (!id) return NextResponse.json({ error: 'Missing supplier id' }, { status: 400 });

    const supplier = await updateSupplier(id, patch);
    if (!supplier) return NextResponse.json({ error: 'อัปเดตผู้จำหน่ายไม่สำเร็จ' }, { status: 500 });
    return NextResponse.json({ success: true, supplier });
  } catch (error: any) {
    console.error('API suppliers PUT error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing supplier id' }, { status: 400 });

    const ok = await deleteSupplier(id);
    if (!ok) return NextResponse.json({ error: 'ลบผู้จำหน่ายไม่สำเร็จ' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API suppliers DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
