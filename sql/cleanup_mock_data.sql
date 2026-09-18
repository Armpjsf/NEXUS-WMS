-- ============================================================================
-- NEXUS WMS — ล้างข้อมูล mockup/ทดสอบให้สะอาด ก่อนนำเข้าข้อมูลงานจริง
-- ============================================================================
-- ⚠️  ลบข้อมูลถาวร กู้คืนไม่ได้ — แนะนำ backup/snapshot ก่อนรัน
-- รันใน Supabase SQL Editor ของโปรเจกต์ pcqarkvosptszpsmickv (nexus-wms)
--
-- คงไว้ (ไม่แตะ): app_users(ผู้ใช้งาน), branches(สาขา), customers(ลูกค้า),
--                carriers(ขนส่ง), organizations, suppliers, warehouse_locations,
--                pickup_locations
-- (เส้นทาง/ทะเบียน/คนขับ อยู่คนละระบบ TMS — ไม่มีในฐานข้อมูลนี้)
-- ============================================================================

begin;

-- ลบลูก (child) ก่อนแม่ (parent) เพื่อไม่ให้ติด foreign key
delete from lot_movements;
delete from stock_reservations;
delete from stock_locations;
delete from product_uoms;
delete from product_lots;
delete from stock_transactions;

delete from asn_lines;
delete from asn_headers;

delete from lpn_items;
delete from license_plate_numbers;

delete from bom_components;
delete from bill_of_materials;

delete from packing_items;
delete from packing_sessions;

delete from wcs_missions;
delete from wcs_devices;                 -- หุ่นยนต์ตัวอย่าง 4 ตัวจะถูกลบด้วย

delete from stock_adjustment_requests;
delete from dock_appointments;
delete from staff_performance;
delete from carrier_shipments;
delete from billing_invoices;
delete from third_party_clients;
delete from iot_sensor_telemetry;
delete from notification_queue;
delete from operator_work_logs;
delete from damage_records;
delete from carrier_rates;               -- เรตขนส่งทดสอบ (ตั้งใหม่ทีหลังได้)
delete from audit_log;                   -- log กิจกรรมทั่วไป (audit_trail_enterprise ที่ immutable ไม่แตะ)

-- ออเดอร์ + ใบรับ (ตัวหลัก)
delete from outbound_orders;
delete from receipts;

-- สินค้า (ลบท้ายสุด เพราะหลายตารางอ้างอิง)
delete from products;

commit;

-- --- (ทางเลือก) ถ้าต้องการล้าง master data เหล่านี้ด้วย ให้เอา comment ออก ---
-- delete from suppliers;              -- ผู้ขาย (ไม่อยู่ใน keep-list ที่ระบุ)
-- delete from warehouse_locations;   -- ผังพิกัด/บิน (ระวัง: กระทบ putaway ถ้าลบ)
-- delete from pickup_locations;      -- จุดรับ cross-dock

notify pgrst, 'reload schema';
