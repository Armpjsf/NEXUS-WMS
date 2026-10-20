# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

1. **Warehouse Floor Operators & Drivers (Primary)**:
   - สภาพแวดล้อม: อยู่หน้างานจริงในคลังสินค้า ถือ PDA Industrial Scanner หรือมือถือ (Android/iOS)
   - งานที่ทำ: สแกนรับสินค้า (Inbound/GRN), จัดเก็บขึ้นชั้น (Putaway), เดินหยิบตาม Wave/Voice, ตรวจ QC & แพ็กกล่อง, โหลดของขึ้นรถส่งมอบ (Dispatch), ตรวจนับสต็อก (Cycle Count)
   - ความต้องการ: ปุ่มใหญ่ แตะง่าย ไม่โดนขอบจอกล้องหน้าบัง (Safe-Area compliant), สแกนบาร์โค้ดเร็ว มีเสียง/สั่นเตือนชัดเจน, ทำงานได้แม้เน็ตหลุดชั่วคราว
2. **Warehouse Managers & Admin (Secondary)**:
   - สภาพแวดล้อม: หน้าจอ Desktop/Laptop ควบคุมการทำงาน
   - งานที่ทำ: จัดการ Master Data, ดูผังคลังสินค้า (2D Map), อนุมัติปรับสต็อก (Maker-Checker), ตรวจสอบ Control Tower, ดูสรุปยอดกำไรและการเคลื่อนไหว (LMS)

## Product Purpose

NEXUS WMS คือระบบบริหารจัดการคลังสินค้าระดับ Enterprise (Smart WMS Enterprise) ที่ออกแบบมาเพื่อควบคุมความถูกต้องของสต็อกแบบ Real-time เชื่อมโยงงานตั้งแต่รับเข้า ตรวจเก็บ หยิบ แพ็ก และกระจายสินค้า พร้อมทั้งผสานเทคโนโลยี Smart Wave Picking, Voice Picking, WCS Robotics และ Multi-Tenant Management

## Positioning

ระบบ WMS สไตล์ **Tactical Industrial Execution** ที่เน้นความแม่นยำทางบัญชีและกายภาพคลัง (Multi-bin & FEFO Lot Traceability) พร้อมโหมดทำงานภาคสนามบน PDA ที่ออกแบบมาสำหรับพนักงานคลังสินค้าอย่างแท้จริง ไม่ใช่แค่เว็บแอดมินทั่วไป

## Operating Context

- **คลังสินค้าจริง**: สภาพแสงจ้าหรือมืดตามช่องเชลฟ์, พนักงานใส่ถุงมือหรือใช้มือเดียวถือสแกนเนอร์
- **อุปกรณ์**: สมาร์ทโฟนทั่วไป, iPhone (Dynamic Island/Notch), อุปกรณ์ Android อุตสาหกรรม (Zebra, Honeywell, Chainway) ที่มีปุ่มยิงเลเซอร์
- **ความแม่นยำสูง**: สต็อกในระบบต้องตรงกับของจริงในช่องเก็บเสมอ (`products.stock == Σ stock_locations.quantity`)

## Capabilities and Constraints

- **Multi-bin & Lot/Batch FEFO**: บริหารสต็อกแบบหลายจุดเก็บและเรียงลำดับการหยิบตามวันหมดอายุ
- **Smart Wave & Voice Picking**: จัดกลุ่มออเดอร์เพื่อลดระยะทางเดินในคลังพร้อมเสียงนำทางภาษาไทย
- **Maker-Checker Security**: การปรับสต็อกที่มีผลกระทบต้องผ่านการอนุมัติจากผู้จัดการเท่านั้น
- **Safe-Area UI**: ส่วนติดต่อผู้ใช้บนมือถือต้องหลบรอยบาก กล้องหน้า แถบสัญญาณ และแถบนำทางระบบอย่างสมบูรณ์

## Brand Commitments

- **ธีมหลัก**: Tactical Industrial Dark Theme (`#0f141b` Base, `#171c23` Cards, `#facc15` Tactical Amber Highlight, `#4cd7f6` Telemetry Cyan)
- **สไตล์ตัวอักษร**: คมชัด แบบเทคนิคอล (Chivo / Outfit / IBM Plex Sans Thai / JetBrains Mono)
- **หลีกเลี่ยง**: AI Slop ดีไซน์ (สีม่วงฟุ้ง Gradient แบบ SaaS ฝรั่ง, การ์ดมนกลมฟุ่มเฟือย, ฟอนต์ Inter ธรรมดา)

## Product Principles

1. **Information Density with Purpose**: แสดงข้อมูลที่จำเป็นชัดเจนในหนึ่งหน้าจอ ไม่ต้องเลื่อนเยอะ แต่ไม่อัดแน่นจนกดผิด
2. **Tactical & Functional Aesthetic**: ดีไซน์เพื่อการใช้งานจริงหน้างาน ทนทาน ชัดเจน คอนทราสต์สูง
3. **Fail-Closed & Traceable**: ทุกการกระทำที่แตะต้องสต็อกต้องตรวจสอบได้และไม่สร้างความคลุมเครือ
