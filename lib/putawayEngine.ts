/**
 * Directed Putaway & Cross-Docking Rules Engine
 * WMS Smart Enterprise - Phase 2
 */

import { supabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';

export interface PutawayRecommendation {
  sku: string;
  recommendedLocation: string;
  ruleApplied: 'CROSS_DOCK' | 'VELOCITY_ZONE_A' | 'VELOCITY_ZONE_B' | 'BULK_ZONE_C' | 'HEAVY_BOTTOM_SHELF' | 'CONSOLIDATION';
  zone: string;
  shelfLevel: number;
  reason: string;
  priorityScore: number;
  isCrossDock: boolean;
  targetOrderNumber?: string;
}

export async function recommendPutaway(params: {
  sku: string;
  quantity: number;
  weightKg?: number;
  lotNumber?: string;
}): Promise<PutawayRecommendation> {
  const orgId = await getCurrentOrgId();
  const { sku, quantity, weightKg = 2.5 } = params;

  // Rule 1: Check Cross-Docking (Pending open orders waiting for this SKU)
  try {
    const { data: openOrders } = await supabase
      .from('outbound_orders')
      .select('order_no, status, items_json')
      .eq('org_id', orgId)
      .in('status', ['NEW', 'PICKING'])
      .limit(10);

    if (openOrders && openOrders.length > 0) {
      for (const ord of openOrders) {
        const items = ord.items_json || [];
        const hasSku = Array.isArray(items) && items.some((it: any) => it.sku === sku || it.name === sku);
        if (hasSku) {
          return {
            sku,
            recommendedLocation: 'STAGE-CROSSDOCK-01',
            ruleApplied: 'CROSS_DOCK',
            zone: 'CROSSDOCK',
            shelfLevel: 1,
            reason: `⚡ Cross-Docking: มีออเดอร์ค้างส่ง (${ord.order_no}) รอสินค้านี้ แนะนำนำส่งตรงไปยังจุดแพ็คทันที`,
            priorityScore: 99,
            isCrossDock: true,
            targetOrderNumber: ord.order_no
          };
        }
      }
    }
  } catch (err) {
    console.warn('Cross-dock check error:', err);
  }

  // Rule 2: Heavy items (> 15kg) must go to bottom shelf (Shelf 01)
  if (weightKg >= 15) {
    return {
      sku,
      recommendedLocation: 'A-01-01',
      ruleApplied: 'HEAVY_BOTTOM_SHELF',
      zone: 'A',
      shelfLevel: 1,
      reason: `🏋️ กฎน้ำหนักเกินเกณฑ์ (${weightKg} kg): ต้องจัดเก็บที่ชั้นล่างสุด (Ground Shelf) เพื่อความปลอดภัย`,
      priorityScore: 85,
      isCrossDock: false
    };
  }

  // Rule 3: Check Product Movement Velocity (Fast = Zone A, Normal = Zone B, Slow = Zone C)
  try {
    const { data: prod } = await supabase
      .from('products')
      .select('movement_status, location')
      .eq('org_id', orgId)
      .eq('sku', sku)
      .maybeSingle();

    const movement = prod?.movement_status || 'Normal Moving';

    if (movement === 'Fast Moving') {
      return {
        sku,
        recommendedLocation: prod?.location && prod.location !== 'Unassigned' ? prod.location : 'A-01-02',
        ruleApplied: 'VELOCITY_ZONE_A',
        zone: 'A',
        shelfLevel: 2,
        reason: '🚀 สินค้าหมุนเวียนเร็ว (Fast Moving): แนะนำจัดวางโซน A ชั้นกลาง ใกล้ประตูเบิกสินค้า',
        priorityScore: 80,
        isCrossDock: false
      };
    }

    if (movement === 'Slow Moving' || movement === 'Deadstock') {
      return {
        sku,
        recommendedLocation: 'C-02-04',
        ruleApplied: 'BULK_ZONE_C',
        zone: 'C',
        shelfLevel: 4,
        reason: '📦 สินค้าหมุนเวียนช้า (Slow Moving): แนะนำจัดวางโซน C ชั้นบน เพื่อสงวนพื้นที่หยิบสะดวกให้สินค้าขายดี',
        priorityScore: 60,
        isCrossDock: false
      };
    }
  } catch (err) {
    console.warn('Product velocity lookup fallback:', err);
  }

  // Default Rule: Normal Moving -> Zone B
  return {
    sku,
    recommendedLocation: 'B-01-02',
    ruleApplied: 'VELOCITY_ZONE_B',
    zone: 'B',
    shelfLevel: 2,
    reason: 'มาตรฐานการจัดเก็บทั่วไป (Standard Zone B)',
    priorityScore: 50,
    isCrossDock: false
  };
}
