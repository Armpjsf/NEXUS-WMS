import { NextResponse } from 'next/server';
import { getCustomers, getCustomerById, createCustomer, updateCustomer, deleteCustomer } from '@/lib/data/customers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (id) {
      const customer = await getCustomerById(id);
      if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
      return NextResponse.json(customer);
    }

    const q = searchParams.get('q') || undefined;
    const customers = await getCustomers(q);
    return NextResponse.json({ customers });
  } catch (error: any) {
    console.error('API customers GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: 'กรุณาระบุชื่อลูกค้า' }, { status: 400 });
    }

    const customer = await createCustomer(body);
    if (!customer) return NextResponse.json({ error: 'สร้างข้อมูลลูกค้าไม่สำเร็จ' }, { status: 500 });
    return NextResponse.json({ success: true, customer });
  } catch (error: any) {
    console.error('API customers POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...patch } = body;
    if (!id) return NextResponse.json({ error: 'Missing customer id' }, { status: 400 });

    const customer = await updateCustomer(id, patch);
    if (!customer) return NextResponse.json({ error: 'อัปเดตข้อมูลลูกค้าไม่สำเร็จ' }, { status: 500 });
    return NextResponse.json({ success: true, customer });
  } catch (error: any) {
    console.error('API customers PUT error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing customer id' }, { status: 400 });

    const result = await deleteCustomer(id);
    if (!result.ok) return NextResponse.json({ error: result.error || 'ลบข้อมูลลูกค้าไม่สำเร็จ' }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API customers DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
