/**
 * Enterprise Integration Hub (ERP Connector: SAP / Odoo / Dynamics 365 / NetSuite)
 * WMS Smart Enterprise
 */

import { z } from 'zod';

export const ErpInboundAsnSchema = z.object({
  asnNumber: z.string().min(1, "ASN Number is required"),
  supplierCode: z.string().optional(),
  supplierName: z.string().optional(),
  expectedDeliveryDate: z.string(),
  containerNumber: z.string().optional(),
  dockBay: z.string().optional().default('BAY-01'),
  items: z.array(z.object({
    sku: z.string().min(1),
    productName: z.string().optional(),
    expectedQty: z.number().positive(),
    lotNumber: z.string().optional(),
    mfgDate: z.string().optional(),
    expDate: z.string().optional(),
    unit: z.string().optional().default('pcs'),
    unitCost: z.number().optional().default(0)
  })).min(1, "At least one item is required")
});

export const ErpOutboundOrderSchema = z.object({
  orderNumber: z.string().min(1, "Order Number is required"),
  customerCode: z.string().optional(),
  customerName: z.string().min(1),
  shippingAddress: z.string().optional(),
  carrier: z.string().optional().default('STANDARD'),
  priority: z.enum(['STANDARD', 'EXPRESS', 'SAMEDAY']).default('STANDARD'),
  items: z.array(z.object({
    sku: z.string().min(1),
    productName: z.string().optional(),
    requestedQty: z.number().positive(),
    unitPrice: z.number().optional()
  })).min(1)
});

export type ErpInboundAsn = z.infer<typeof ErpInboundAsnSchema>;
export type ErpOutboundOrder = z.infer<typeof ErpOutboundOrderSchema>;