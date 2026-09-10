import { NextRequest, NextResponse } from 'next/server';
import { getProducts } from '@/lib/data/wms';
import { getOrders } from '@/lib/data/orders';

export const dynamic = 'force-dynamic';

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];

interface ChatMessage {
  role: 'user' | 'bot' | 'model' | 'assistant';
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, history = [] } = body as {
      message: string;
      history?: ChatMessage[];
    };

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        reply: 'ขออภัยครับ ยังไม่ได้ตั้งค่า GEMINI_API_KEY ในระบบ กรุณาตรวจสอบไฟล์ .env.local',
      });
    }

    // 1. Gather live WMS context
    const [products, orders] = await Promise.all([
      getProducts().catch(() => []),
      getOrders().catch(() => []),
    ]);

    const totalSkus = products.length;
    const lowStockItems = products.filter((p: any) => p.stock <= (p.minStock || 5));
    const outOfStockItems = products.filter((p: any) => p.stock <= 0);

    // Group orders by status
    const orderStats: Record<string, number> = {
      NEW: 0,
      PICKING: 0,
      PICKED: 0,
      PACKED: 0,
      SHIPPED: 0,
      DELIVERED: 0,
      CANCELLED: 0,
    };
    orders.forEach((o: any) => {
      if (orderStats[o.status] !== undefined) {
        orderStats[o.status]++;
      }
    });

    // Sample top 15 products for quick lookups
    const sampleProducts = products.slice(0, 20).map((p: any) => ({
      sku: p.id,
      name: p.name,
      stock: p.stock,
      unit: p.unit,
      location: p.location || 'Unassigned',
      minStock: p.minStock,
    }));

    // Find any exact or partial SKU/product name mentioned in user message
    const userQueryLower = message.toLowerCase();
    const specificMatches = products
      .filter((p: any) => 
        p.id.toLowerCase().includes(userQueryLower) || 
        p.name.toLowerCase().includes(userQueryLower)
      )
      .slice(0, 5)
      .map((p: any) => ({
        sku: p.id,
        name: p.name,
        stock: p.stock,
        location: p.location || 'Unassigned',
        price: p.price,
      }));

    const systemPrompt = `คุณคือ "NEXUS AI Warehouse Assistant" ผู้ช่วยอัจฉริยะประจำคลังสินค้า NEXUS WMS
หน้าที่ของคุณคือตอบคำถามและช่วยเหลือหัวหน้าคลังสินค้าและพนักงานจัดการสต็อกอย่างรวดเร็ว ถูกต้อง แม่นยำ

ข้อมูลสถานะคลังสินค้าปัจจุบัน (Live Warehouse Context):
- จำนวน SKU ทั้งหมด: ${totalSkus} รายการ
- สินค้าที่หมดสต็อก (0 ชิ้น): ${outOfStockItems.length} รายการ: ${outOfStockItems.slice(0, 5).map((i: any) => `${i.name} (${i.id})`).join(', ') || 'ไม่มี'}
- สินค้าที่ใกล้หมดสต็อก: ${lowStockItems.length} รายการ: ${lowStockItems.slice(0, 8).map((i: any) => `${i.name} [เหลือ ${i.stock} ${i.unit}, ขั้นต่ำ ${i.minStock}] ตำแหน่ง: ${i.location}`).join('; ')}
- สถานะออเดอร์ในระบบ:
  • รอดำเนินการ (NEW): ${orderStats.NEW} รายการ
  • กำลังหยิบ (PICKING): ${orderStats.PICKING} รายการ
  • หยิบแล้ว (PICKED): ${orderStats.PICKED} รายการ
  • แพ็กแล้ว (PACKED): ${orderStats.PACKED} รายการ
  • จัดส่งแล้ว/ส่งต่อให้ TMS (SHIPPED): ${orderStats.SHIPPED} รายการ
  • ส่งมอบสำเร็จ (DELIVERED): ${orderStats.DELIVERED} รายการ
- สินค้าที่ตรงกับคำค้นหาโดยตรง: ${specificMatches.length > 0 ? JSON.stringify(specificMatches) : 'ไม่มีระบุเจาะจง'}
- ตัวอย่างรายการสินค้าในคลัง: ${JSON.stringify(sampleProducts)}

คำแนะนำในการตอบ:
1. ตอบเป็นภาษาไทยที่สุภาพ เป็นมืออาชีพ กระชับ และตรงประเด็น
2. ใช้ bullet point (•) และ emoji ประกอบให้อ่านง่าย เช่น 📦 📍 ⚠️ ✅ 🚚
3. หากถามถึงตำแหน่งสินค้า ให้ระบุ SKU, ชื่อสินค้า, จำนวนสต็อกคงเหลือ และ Location (Rack/Shelf/Bin) ให้ชัดเจน
4. หากถามถึงของใกล้หมด ให้สรุปรายการและเตือนให้สั่งซื้อเพิ่ม
5. หากถามเรื่องออเดอร์ค้างส่ง ให้สรุปตัวเลข NEW, PICKING และแนะนำขั้นตอนถัดไป`;

    // 2. Call Gemini
    let reply = '';
    for (const model of GEMINI_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const contents = (history || [])
          .filter(h => h.content)
          .slice(-6)
          .map(h => ({
            role: h.role === 'user' ? 'user' : 'model',
            parts: [{ text: h.content }],
          }));

        contents.push({
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\nคำถามจากผู้ใช้: ${message}` }],
        });

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 1024,
            },
          }),
        });

        if (res.ok) {
          const json = await res.json();
          reply = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (reply) break;
        } else {
          console.warn(`Gemini model ${model} returned HTTP ${res.status}`);
        }
      } catch (err: any) {
        console.error(`Error calling Gemini model ${model}:`, err?.message);
      }
    }

    if (!reply) {
      // Fallback rule-based answering if AI quota exceeded or offline
      if (userQueryLower.includes('ใกล้หมด') || userQueryLower.includes('สต็อกต่ำ')) {
        reply = `📦 **สินค้าใกล้หมดสต็อก (${lowStockItems.length} รายการ):**\n\n` +
          lowStockItems.slice(0, 5).map((i: any) => `• **${i.name}** (${i.id}) เหลือ **${i.stock}** ${i.unit} (ขั้นต่ำ ${i.minStock}) อยู่ที่โซน: \`${i.location}\``).join('\n');
      } else if (userQueryLower.includes('ออเดอร์') || userQueryLower.includes('ค้าง')) {
        reply = `🚚 **สรุปสถานะออเดอร์ปัจจุบัน:**\n• รอดำเนินการ (NEW): ${orderStats.NEW} รายการ\n• กำลังหยิบ (PICKING): ${orderStats.PICKING} รายการ\n• แพ็กเสร็จแล้ว: ${orderStats.PACKED} รายการ\n• ส่งต่อให้รถขนส่ง TMS: ${orderStats.SHIPPED} รายการ\n• ส่งสำเร็จแล้ว: ${orderStats.DELIVERED} รายการ`;
      } else {
        reply = `ระบบได้ประมวลผลข้อมูลคลังสินค้าเรียบร้อยครับ (พบ ${totalSkus} รายการ SKU) แต่ขณะนี้สัญญาณเชื่อมต่อ AI ชั่วคราว แนะนำตรวจสอบผ่านเมนูสินค้าคงคลัง หรือลองใหม่อีกครั้งครับ`;
      }
    }

    return NextResponse.json({
      reply,
      matches: specificMatches,
      stats: {
        totalSkus,
        lowStockCount: lowStockItems.length,
        pendingOrders: orderStats.NEW + orderStats.PICKING,
      },
    });
  } catch (error: any) {
    console.error('AI chat endpoint error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
