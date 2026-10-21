-- Damage records remember which bin the damaged goods were taken from, so the
-- approval cuts stock from that bin (stock_locations) instead of the automatic
-- FEFO/FIFO pick. Blank = automatic, as before.
--
-- Idempotent: safe to re-run. Run by hand in the Supabase SQL Editor.

alter table damage_records add column if not exists location varchar(50);

notify pgrst, 'reload schema';
