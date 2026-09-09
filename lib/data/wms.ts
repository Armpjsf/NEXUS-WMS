// Supabase-backed drop-in replacements for the legacy Google Sheets data layer.
// These return the SAME shapes the old `@/lib/googleSheets` functions produced,
// so API routes can migrate by swapping only their import path.

import { supabase } from '@/lib/supabase';
import { mapProductRows, type UIProduct } from '@/lib/data/products';
import { getCurrentOrgId } from '@/lib/orgContext';

export type Product = UIProduct;

export interface Transaction {
  date: string;
  type: 'IN' | 'OUT';
  sku: string;
  qty: number;
  price: number;
  docRef?: string;
  product?: string;
  timestamp?: number;
  batch?: string;
  expiryDate?: string;
  owner?: string;
}

export interface DamageRecord {
  rowIndex?: number;
  id?: string;
  date: string;
  product_name: string;
  quantity: number;
  unit: string;
  reason: string;
  notes: string;
  reported_by: string;
  status: string;
  approved_by: string;
  approved_date: string;
  sent_to_hq?: string;
}

export interface POLogItem {
  orderNo: string;
  date: string;
  customer: string;
  poOrder: string;
  item: string;
  qty: number;
  status: string;
  pdfLink: string;
  deliveryDate: string;
}

// All products (UI shape). branch/owner args accepted for signature parity.
export async function getProducts(
  _branchSpreadsheetId?: string,
  allowedOwners?: string[],
): Promise<Product[]> {
  const orgId = await getCurrentOrgId();
  const { data, error } = await supabase.from('products').select('*').eq('org_id', orgId);
  if (error) {
    console.error('[data/wms] getProducts error:', error);
    return [];
  }
  let products = mapProductRows(data);
  if (allowedOwners && allowedOwners.length > 0) {
    const allow = new Set(allowedOwners.map((o) => o.toLowerCase().trim()));
    products = products.filter((p) => allow.has((p.owner || '').toLowerCase().trim()));
  }
  return products;
}

// IN / OUT transactions in legacy shape, oldest-first (matches sheet order).
export async function getTransactions(
  type: 'IN' | 'OUT',
  _branchId?: string,
  allowedOwners?: string[],
): Promise<Transaction[]> {
  const orgId = await getCurrentOrgId();
  const { data, error } = await supabase
    .from('stock_transactions')
    .select('*')
    .eq('org_id', orgId)
    .eq('type', type)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[data/wms] getTransactions error:', error);
    return [];
  }

  let rows = (data || []).map((r: any): Transaction => ({
    date: r.created_at,
    type,
    sku: r.sku,
    product: r.product_name || r.sku,
    qty: Number(r.qty ?? 0),
    price: Number(r.unit_price ?? 0),
    docRef: r.doc_ref || '',
    timestamp: r.created_at ? new Date(r.created_at).getTime() : 0,
    batch: r.batch_no || '',
    expiryDate: r.expiry_date || '',
    owner: r.owner || '',
  }));

  if (allowedOwners && allowedOwners.length > 0) {
    const allow = new Set(allowedOwners.map((o) => o.toLowerCase().trim()));
    rows = rows.filter((t) => allow.has((t.owner || '').toLowerCase().trim()));
  }

  return rows;
}

// All IN + OUT transactions combined, oldest-first (for FIFO/profit replay).
export async function getAllTransactions(): Promise<Transaction[]> {
  const [inTx, outTx] = await Promise.all([getTransactions('IN'), getTransactions('OUT')]);
  return [...inTx, ...outTx].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
}

// Uncached variant — same source, kept for signature parity with legacy callers.
export async function getTransactionsUncached(
  type: 'IN' | 'OUT',
  _targetSheetId?: string,
): Promise<Transaction[]> {
  return getTransactions(type);
}

// Damage records live in their own table (own approval lifecycle).
// rowIndex mirrors the legacy sheet convention (0-based array index + 2) and is
// stable given the fixed created_at DESC ordering, so PUT-by-rowIndex still works.
export async function getDamageRecords(): Promise<DamageRecord[]> {
  const orgId = await getCurrentOrgId();
  const { data, error } = await supabase
    .from('damage_records')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[data/wms] getDamageRecords error:', error);
    return [];
  }

  return (data || []).map((r: any, i: number): DamageRecord => ({
    rowIndex: i + 2,
    id: r.id,
    date: r.report_date || r.created_at,
    product_name: r.product_name || '',
    quantity: Number(r.quantity ?? 0),
    unit: r.unit || 'ชิ้น',
    reason: r.reason || '',
    notes: r.notes || '',
    reported_by: r.reported_by || '',
    status: r.status || 'รอดำเนินการ',
    approved_by: r.approved_by || '',
    approved_date: r.approved_date || '',
    sent_to_hq: r.sent_to_hq || '',
  }));
}

// PO logs have no Supabase table yet — return empty until one is introduced.
export async function getPOLogs(_spreadsheetId?: string): Promise<POLogItem[]> {
  return [];
}

// Uncached products variant — same source, kept for signature parity.
export async function getProductsUncached(
  _targetSheetId?: string,
  allowedOwners?: string[],
): Promise<Product[]> {
  return getProducts(undefined, allowedOwners);
}

export interface CycleCountRecord {
  product_name: string;
  location: string;
  due_date: string;
  count_date: string;
  inspector: string;
  notes: string;
  system_qty: number;
  actual_qty: number;
  variance: number;
  status: string;
}

export async function getCycleCountLogs(): Promise<CycleCountRecord[]> {
  const orgId = await getCurrentOrgId();
  const { data, error } = await supabase
    .from('cycle_count_logs')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[data/wms] getCycleCountLogs error:', error);
    return [];
  }

  return (data || []).map((r: any): CycleCountRecord => ({
    product_name: r.product_name || '',
    location: r.location || '-',
    due_date: r.due_date || '',
    count_date: r.count_date || '',
    inspector: r.inspector || '',
    notes: r.notes || '',
    system_qty: Number(r.system_qty ?? 0),
    actual_qty: Number(r.actual_qty ?? 0),
    variance: Number(r.variance ?? 0),
    status: r.status || 'Unknown',
  }));
}

// ---- Automation Rules (system-owned) ----
export interface AutomationRule {
  id: string;
  name: string;
  triggerType: 'STOCK_LEVEL' | 'TRANSACTION' | 'SCHEDULE';
  condition: string;
  action: string;
  isActive: boolean;
  lastTriggered?: string;
}

export async function getRules(): Promise<AutomationRule[]> {
  const orgId = await getCurrentOrgId();
  const { data, error } = await supabase
    .from('automation_rules')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[data/wms] getRules error:', error);
    return [];
  }
  return (data || []).map((r: any): AutomationRule => ({
    id: r.id,
    name: r.name,
    triggerType: r.trigger_type,
    condition: r.condition || '{}',
    action: r.action || '{}',
    isActive: !!r.is_active,
    lastTriggered: r.last_triggered || '',
  }));
}

export async function saveRule(rule: AutomationRule): Promise<boolean> {
  const orgId = await getCurrentOrgId();
  const { error } = await supabase.from('automation_rules').upsert(
    {
      id: rule.id,
      org_id: orgId,
      name: rule.name,
      trigger_type: rule.triggerType,
      condition: rule.condition,
      action: rule.action,
      is_active: rule.isActive,
      last_triggered: rule.lastTriggered || '',
    },
    { onConflict: 'id' },
  );
  if (error) {
    console.error('[data/wms] saveRule error:', error);
    return false;
  }
  return true;
}

// No-op: Supabase tables need no ensure step (kept for signature parity).
export async function ensureRulesSheet(): Promise<void> {
  /* tables are created by supabase_schema.sql */
}

// ---- Per-user config (key/value) ----
export async function getUserConfig(userEmail: string, key: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_config')
    .select('config_value')
    .eq('user_email', userEmail)
    .eq('config_key', key)
    .maybeSingle();
  if (error) {
    console.error('[data/wms] getUserConfig error:', error);
    return null;
  }
  return data?.config_value ?? null;
}

export async function saveUserConfig(userEmail: string, key: string, value: any): Promise<boolean> {
  const { error } = await supabase.from('user_config').upsert(
    {
      user_email: userEmail,
      config_key: key,
      config_value: typeof value === 'string' ? value : JSON.stringify(value),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_email,config_key' },
  );
  if (error) {
    console.error('[data/wms] saveUserConfig error:', error);
    return false;
  }
  return true;
}

// ---- Device tokens (FCM push targets) ----
export async function registerDeviceToken(token: string, platform = 'unknown'): Promise<'registered' | 'updated'> {
  const { data: existing } = await supabase
    .from('device_tokens')
    .select('token')
    .eq('token', token)
    .maybeSingle();

  const now = new Date().toISOString();
  if (existing) {
    await supabase.from('device_tokens').update({ last_active: now }).eq('token', token);
    return 'updated';
  }
  await supabase.from('device_tokens').insert({ token, platform, last_active: now });
  return 'registered';
}

export async function getDeviceTokens(): Promise<string[]> {
  const { data, error } = await supabase.from('device_tokens').select('token');
  if (error) {
    console.error('[data/wms] getDeviceTokens error:', error);
    return [];
  }
  return (data || []).map((r: any) => r.token).filter((t: string) => t && t.length > 10);
}

export async function removeDeviceTokens(tokens: string[]): Promise<number> {
  const list = tokens.filter(Boolean);
  if (list.length === 0) return 0;
  const { error } = await supabase.from('device_tokens').delete().in('token', list);
  if (error) {
    console.error('[data/wms] removeDeviceTokens error:', error);
    return 0;
  }
  return list.length;
}

export async function addCycleCountEntry(data: CycleCountRecord): Promise<boolean> {
  const orgId = await getCurrentOrgId();
  const { error } = await supabase.from('cycle_count_logs').insert({
    org_id: orgId,
    product_name: data.product_name,
    location: data.location,
    due_date: data.due_date,
    count_date: data.count_date,
    inspector: data.inspector,
    notes: data.notes,
    system_qty: data.system_qty,
    actual_qty: data.actual_qty,
    variance: data.variance,
    status: data.status,
  });
  if (error) {
    console.error('[data/wms] addCycleCountEntry error:', error);
    return false;
  }
  return true;
}
