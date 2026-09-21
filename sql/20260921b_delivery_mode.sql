-- Delivery mode on outbound orders ---------------------------------------------
-- Split "ส่งขนส่ง" (carrier delivery) from "ลูกค้ารับเอง" (customer self-pickup)
-- so the outbound board can filter each. New orders set it from the create/
-- dispatch form; scripts/backfill-delivery-mode.mjs classifies the migrated
-- history (ประวัติงานส่ง = delivered; the rest = self-pickup).
--   values: 'DELIVERY' | 'SELF_PICKUP'

alter table outbound_orders
  add column if not exists delivery_mode text not null default 'DELIVERY';

create index if not exists idx_outbound_orders_delivery_mode
  on outbound_orders (org_id, delivery_mode);

notify pgrst, 'reload schema';
