-- Structured freight cost on outbound orders --------------------------------
-- Previously freight for migrated shipments lived only inside the free-text
-- `notes` ("ค่าขนส่ง=1600"), so it couldn't be summed/reported reliably.
-- Add a real numeric column; scripts/backfill-freight.mjs then parses the note
-- into it for the migrated history.

alter table outbound_orders add column if not exists freight_cost numeric not null default 0;

notify pgrst, 'reload schema';
