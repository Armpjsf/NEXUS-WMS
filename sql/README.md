# Database SQL — run order

Every file here is **idempotent** (safe to re-run) and is run **by hand** in the
Supabase SQL Editor. Nothing runs automatically on deploy, so after pulling new
code run any file you haven't run yet, then check:

```bash
node scripts/check-schema.mjs
```

It lists every table / RPC function the code uses that the live database is
missing, and names the file below that creates it.

## New project

1. `000_base_setup.sql` — full base schema (tenancy, products, bins, orders,
   receipts, returns, TMS/branch/FEFO/transfers, fleet, multi-drop, seed).
2. Then every dated file below, in order.

## Dated migrations (run in filename order)

| File | What it adds |
|---|---|
| `20260914_pickup_locations.sql` | Pickup points (cross-dock) with coordinates |
| `20260914b_pickup_locations_kind.sql` | `kind` + `phone` columns on pickup points |
| `20260916_dock_and_staff.sql` | `dock_bays`, `staff_performance` |
| `20260916b_enterprise_core.sql` | Lots, inventory balances, warehouse tasks, enterprise audit, ERP sync log |
| `20260916b_kitting_dock.sql` | Kitting (BOM) and dock appointments |
| `20260916c_smart_enterprise_expansion.sql` | LPN, packing sessions, carrier shipments, stock adjustment requests, operator work logs |
| `20260916d_next_gen_enterprise.sql` | 3PL clients & billing, BOM components, IoT telemetry, notification queue |
| `20260917_stock_locations.sql` | Multi-bin stock ledger (`stock_locations`) |
| `20260917_atomic_stock.sql` | `wms_bin_add` / `wms_bin_consume` / `wms_bin_move` (atomic stock) |
| `20260917_reservations.sql` | Stock reservation / ATP (`wms_reserve`) |
| `20260917_wcs.sql` | WCS / AGV fleet and missions |
| `20260918_lot_traceability.sql` | `lot_movements` for trace & recall |
| `20260918_uom.sql` | Unit-of-measure / pack hierarchy |
| `20260918b_asn.sql` | ASN headers and lines |
| `20260918c_carrier_rates.sql` | Carrier rate cards |
| `20260919_mixed_lot_bins.sql` | Mixed-lot bins |
| `20260921_freight_cost.sql` | Freight cost on outbound orders |
| `20260921b_delivery_mode.sql` | Delivery vs self-pickup |
| `20260923_document_signatures.sql` | E-signatures on printed documents |
| `20260924_doc_sequences.sql` | **Atomic document numbers** (`wms_next_doc_seq`), unique indexes on doc numbers, and **per-org unique keys** for SKU / bin / customer / carrier / supplier codes |

`20260924_doc_sequences.sql` prints `NOTICE` lines when it skips an index
because of duplicate existing data — fix those rows and re-run it.

## Tools (not migrations)

- `tools_cleanup_mock_data.sql` — **deletes data permanently**. Only for
  wiping demo/test data before go-live. Back up first.

## `legacy/`

Old one-off scripts kept for reference only. Everything in them is already in
`000_base_setup.sql` — **do not run them.**

## After running SQL

If the app still reports a missing table/column (PostgREST `PGRST205`), reload
the API schema cache:

```sql
NOTIFY pgrst, 'reload schema';
```
