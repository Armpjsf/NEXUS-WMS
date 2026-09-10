import { NextRequest, NextResponse } from 'next/server';
import { getProducts } from '@/lib/data/wms';
import { listOrders } from '@/lib/data/orders';
import { AI_TOOL_DECLARATIONS, runAiTool } from '@/lib/aiTools';

export const dynamic = 'force-dynamic';

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];

interface ChatMessage {
  role: 'user' | 'bot' | 'model' | 'assistant';
  content: string;
}

const SYSTEM_INSTRUCTION = `คุณคือ "NEXUS AI Warehouse Assistant" ผู้ช่วยอัจฉริยะประจำคลังสินค้า NEXUS WMS
หน้าที่: ตอบคำถามและช่วยหัวหน้าคลัง/พนักงานจัดการสต็อกอย่างรวดเร็ว ถูกต้อง แม่นยำ

คุณมีเครื่องมือ (tools) เรียกดูข้อมูลจริงทั้งคลังได้เอง — **ต้องเรียกใช้ tool เพื่อดึงข้อมูลจริงก่อนตอบเสมอ** อย่าเดาตัวเลข/สต็อก/ตำแหน่งเอง
- ถามตำแหน่ง/สต็อกสินค้า → search_products
- ของใกล้หมด/ต้องสั่งเติม → low_stock ; ของหมด → out_of_stock ; ใกล้หมดอายุ → expiring_soon
- ภาพรวม/มูลค่าสต็อก/dead stock → inventory_summary
- ออเดอร์ค้าง/สถานะ → orders_summary หรือ list_orders
- การรับเข้า-จ่ายออกล่าสุด → recent_movements
- ลูกค้า/ขนส่ง/ผู้จำหน่าย → list_customers / list_carriers / list_suppliers
เรียกหลาย tool พร้อมกันได้ถ้าจำเป็น

รูปแบบคำตอบ:
1. ภาษาไทยสุภาพ มืออาชีพ กระชับ ตรงประเด็น
2. ใช้ bullet (•) และ emoji ให้อ่านง่าย เช่น 📦 📍 ⚠️ ✅ 🚚 💰
3. ระบุ SKU/ชื่อ/จำนวนคงเหลือ/ตำแหน่ง (Rack/Shelf/Bin) ให้ชัดเมื่อถามถึงสินค้า
4. ถ้า tool ไม่พบข้อมูล ให้บอกตามจริงว่าไม่พบ อย่าแต่งขึ้นมา
5. ตัวเลขเงินใส่หน่วยบาท จำนวนใส่หน่วยชิ้น`;

async function callGemini(model: string, apiKey: string, contents: any[]) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents,
      tools: [{ functionDeclarations: AI_TOOL_DECLARATIONS }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 1400 },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => '')}`);
  return res.json();
}

// Run one model through a tool-calling loop until it produces text.
async function converse(model: string, apiKey: string, contents: any[]): Promise<string> {
  for (let round = 0; round < 5; round++) {
    const json = await callGemini(model, apiKey, contents);
    const parts = json?.candidates?.[0]?.content?.parts || [];
    const calls = parts.filter((p: any) => p.functionCall).map((p: any) => p.functionCall);

    if (calls.length === 0) {
      return parts.map((p: any) => p.text || '').join('').trim();
    }

    // Echo the model's function-call turn, then answer each call with real data.
    contents.push({ role: 'model', parts });
    const responseParts = [];
    for (const call of calls) {
      let result: any;
      try {
        result = await runAiTool(call.name, call.args || {});
      } catch (e: any) {
        result = { error: e?.message || 'tool error' };
      }
      responseParts.push({ functionResponse: { name: call.name, response: { result } } });
    }
    contents.push({ role: 'function', parts: responseParts });
  }
  return ''; // exceeded tool rounds
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, history = [] } = body as { message: string; history?: ChatMessage[] };

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        reply: 'ขออภัยครับ ยังไม่ได้ตั้งค่า GEMINI_API_KEY ในระบบ กรุณาตรวจสอบไฟล์ .env.local',
      });
    }

    // Prior conversation (trimmed) + the new question.
    const baseContents = (history || [])
      .filter((h) => h.content)
      .slice(-6)
      .map((h) => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.content }] }));
    baseContents.push({ role: 'user', parts: [{ text: message }] });

    let reply = '';
    for (const model of GEMINI_MODELS) {
      try {
        reply = await converse(model, apiKey, [...baseContents]);
        if (reply) break;
      } catch (err: any) {
        console.warn(`[ai/chat] model ${model} failed:`, err?.message);
      }
    }

    // Rule-based fallback if the AI is unavailable/over quota.
    if (!reply) {
      const q = message.toLowerCase();
      if (q.includes('ใกล้หมด') || q.includes('สต็อกต่ำ') || q.includes('เติม')) {
        const products = await getProducts().catch(() => []);
        const low = products.filter((p: any) => Number(p.stock) <= Number(p.minStock || 5)).slice(0, 8);
        reply = `📦 **สินค้าใกล้หมดสต็อก (${low.length} รายการ):**\n\n` +
          low.map((i: any) => `• **${i.name}** (${i.id}) เหลือ **${i.stock}** ${i.unit} ขั้นต่ำ ${i.minStock} 📍 \`${i.location || '-'}\``).join('\n');
      } else if (q.includes('ออเดอร์') || q.includes('ค้าง')) {
        const orders = await listOrders({ limit: 1000 }).catch(() => []);
        const c = (s: string) => orders.filter((o: any) => o.status === s).length;
        reply = `🚚 **สรุปสถานะออเดอร์:**\n• NEW: ${c('NEW')}\n• PICKING: ${c('PICKING')}\n• PACKED: ${c('PACKED')}\n• SHIPPED: ${c('SHIPPED')}\n• DELIVERED: ${c('DELIVERED')}`;
      } else {
        reply = 'ขณะนี้เชื่อมต่อ AI ไม่ได้ชั่วคราว (อาจโควต้าหมดหรือสัญญาณขัดข้อง) กรุณาลองใหม่อีกครั้งครับ';
      }
    }

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error('[ai/chat] error:', error?.message);
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}
