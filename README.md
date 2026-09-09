# 🔷 NEXUS WMS
> **Next-Gen Smart Warehouse Management & Logistics Execution System**  
> ขับเคลื่อนด้วย Next.js 16 (Turbopack) • Supabase (PostgreSQL) • Capacitor Mobile (Android/iOS) • AI Smart Restock & Wave Picking

![NEXUS WMS Logo](/public/logo.png)

---

## 🚀 จุดเด่นและฟีเจอร์หลัก (Key Features)

### 1. 📦 การจัดการสินค้าคงคลัง & แผนผังคลัง (Inventory & 2D Warehouse Map)
* **2D Visual Warehouse Map**: จำลองผังเชลฟ์ คลังสินค้า และแสดงความจุ/Heatmap สินค้าแต่ละช่อง
* **Stock Card & Real-time Transactions**: ตรวจสอบประวัติการเคลื่อนไหวเข้า-ออก-โอนย้าย แบบวินาทีต่อวินาที
* **FIFO Batch Tracking**: ระบบจัดการสินค้าตามลำดับวันหมดอายุและวันที่รับเข้า (First-In, First-Out)
* **AI Smart Restock & Demand Forecast**: วิเคราะห์แนวโน้มยอดขายและแนะนำจุดสั่งซื้อซ้ำอัตโนมัติ (Reorder Point)

### 2. ⚡ ระบบหยิบสินค้าอัจฉริยะ (Smart Wave Picking)
* **Order Batching**: รวมออเดอร์รอจัดส่งมาจัดกลุ่มเป็น Wave เดียวกันเพื่อลดรอบการเดินในคลัง
* **S-Shape Pathfinding**: คำนวณเส้นทางเดินหยิบสินค้าที่สั้นและมีประสิทธิภาพสูงสุดอัตโนมัติ
* **Real-time Order Transitions**: เมื่อหยิบครบ Wave ออเดอร์จะขยับสู่สถานะ `PICKED` และส่งต่อไปยังสถานี QC ทันที

### 3. 🔍 สถานีตรวจสอบและแพ็กสินค้า (Mobile QC Station & Packing)
* **100% Barcode Verification**: ตรวจสอบบาร์โค้ดสินค้าทีละชิ้นด้วยปืนสแกนเลเซอร์ (PDA) หรือกล้องมือถือ
* **Standard Box Sizing**: เลือกรหัสกล่องพัสดุมาตรฐาน (00, 0, A, B, 2A, C, D, ซอง) คำนวณน้ำหนักและค่าจัดส่ง
* **4x6 Thermal Shipping Labels**: รองรับการพิมพ์ใบปะหน้าพัสดุขนาด 4x6 นิ้ว หรือ A4 จากเครื่องพิมพ์ความร้อนโดยตรง
* **Courier Dispatch & Tracking Scan**: สแกนบันทึกเลขพัสดุ (Kerry, Flash, EMS, SPX, LEX) และตัดสต็อกสินค้าจริง (`SHIPPED`)

### 4. 📱 ระบบพนักงานคลังบนมือถือ (Warehouse Mobile & PDA Hub)
* พัฒนาเป็น **PWA & Native Mobile App (Capacitor Android)**
* รองรับฮาร์ดแวร์ปืนสแกนบาร์โค้ดอุตสาหกรรม (Zebra, Honeywell, Chainway, Newland) และกล้องมือถือทั่วไป
* มีระบบเสียงแจ้งเตือน (Scanner Audio Beep) และสั่นเตือน (Haptic Feedback)

### 5. 🏢 สิทธิ์การใช้งานตามแผนกและองค์กร (Multi-Branch & Section-Based RBAC)
* **Multi-Tenant & Multi-Branch**: แยกข้อมูลและสต็อกสินค้าของแต่ละสาขา หรือรวมดูภาพรวมผ่าน **HQ Command Center**
* **Section-Based Roles**:
  * 👑 `Super Admin`: ควบคุมทั้งองค์กร เข้าถึงได้ทุกเมนูและทุกสาขาทั่วประเทศ
  * 🛡️ `Admin`: ผู้จัดการสาขา ดูแลเฉพาะสาขาของตนเอง
  * 📥 `Staff - Inbound`: ฝ่ายรับสินค้าเข้าคลัง (GRN)
  * 📦 `Staff - Picker`: ฝ่ายเดินหยิบสินค้าตาม Wave
  * 🔍 `Staff - QC & Pack`: ฝ่ายตรวจสอบความถูกต้องและแพ็กกล่อง
  * 🚚 `Staff - Dispatch`: ฝ่ายส่งมอบพัสดุขึ้นรถขนส่ง
  * 📋 `Staff - Inventory`: ฝ่ายตรวจนับสต็อก (Cycle Count)

---

## 🛠️ สถาปัตยกรรมทางเทคนิค (Tech Stack)

* **Frontend & Backend**: Next.js 16 (App Router + Turbopack), React 19, TypeScript
* **Styling & UI**: Tailwind CSS 4, Lucide Icons, Framer Motion
* **Database & Auth**: Supabase (PostgreSQL), NextAuth.js
* **Mobile Runtime**: Capacitor 8 (Android/iOS), PWA Web Push
* **Offline Storage**: Dexie.js (IndexedDB) & Web Push Worker

---

## 💻 การติดตั้งและเริ่มต้นใช้งาน (Installation)

1. **Clone repository**:
   ```bash
   git clone https://github.com/<your-username>/nexus-wms.git
   cd nexus-wms
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   คัดลอกไฟล์ตัวอย่าง `.env.example` เป็น `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   ตั้งค่าการเชื่อมต่อหลัก:
   ```env
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your-secure-nextauth-secret

   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-key
   ```

4. **Run Development Server**:
   ```bash
   npm run dev
   ```
   เปิดใช้งานระบบผ่านเบราว์เซอร์ที่: [http://localhost:3000](http://localhost:3000)

5. **Build for Production**:
   ```bash
   npm run build
   npm start
   ```

---

## 📄 License
Private Enterprise Software — All Rights Reserved.
