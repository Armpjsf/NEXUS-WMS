import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Parse .env.local manually to run standalone without dotenv
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...vals] = trimmed.split('=');
        if (key && vals.length > 0) {
          process.env[key.trim()] = vals.join('=').trim();
        }
      }
    });
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Supabase credentials missing in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);
const ORG_ID = '00000000-0000-0000-0000-000000000001';

console.log('🚀 Starting Large Scale Demo Seeding for WMS 360 PRO...');
console.log(`📦 Target Supabase: ${supabaseUrl}`);
console.log(`🏢 Organization ID: ${ORG_ID}`);

// 1. Carriers
const CARRIERS = [
  { code: 'FLASH', name: 'Flash Express', tracking_url_template: 'https://www.flashexpress.co.th/tracking/?se={tracking}', phone: '1436', is_default: true },
  { code: 'KEX', name: 'Kerry Express (KEX)', tracking_url_template: 'https://th.kerryexpress.com/th/track/?track={tracking}', phone: '1217', is_default: false },
  { code: 'JNT', name: 'J&T Express', tracking_url_template: 'https://www.jtexpress.co.th/index/query/gzquery.html?bills={tracking}', phone: '1470', is_default: false },
  { code: 'EMS', name: 'ไปรษณีย์ไทย (EMS)', tracking_url_template: 'https://track.thailandpost.co.th/?trackNumber={tracking}', phone: '1545', is_default: false },
  { code: 'SPX', name: 'Shopee Xpress', tracking_url_template: 'https://spx.co.th/m/track?tracking_number={tracking}', phone: '02-017-8399', is_default: false },
  { code: 'LALA', name: 'Lalamove (ส่งด่วนภายในวัน)', tracking_url_template: 'https://www.lalamove.com/th-th/', phone: '02-034-5252', is_default: false },
  { code: 'FLEET', name: 'รถคลังจัดส่งเอง (Company Fleet)', tracking_url_template: '', phone: '02-999-8888', is_default: false },
];

// 2. Suppliers
const SUPPLIERS = [
  { code: 'SUP-001', name: 'บริษัท เอสซีจี แพคเกจจิ้ง จำกัด (มหาชน)', tax_id: '0107536000720', phone: '02-586-3333', email: 'sales@scgpackaging.com', address: '1 ถ.ปูนซิเมนต์ไทย บางซื่อ กรุงเทพฯ 10800', contact_person: 'คุณวิชัย กุลธร' },
  { code: 'SUP-002', name: 'บริษัท ซีพี ออลล์ ซัพพลาย จำกัด', tax_id: '0107542000011', phone: '02-071-9000', email: 'procure@cpall.co.th', address: '313 อาคาร ซี.พี.ทาวเวอร์ ถ.สีลม บางรัก กรุงเทพฯ 10500', contact_person: 'คุณกิตติศักดิ์ เจริญพร' },
  { code: 'SUP-003', name: 'บริษัท สยามแม็คโคร ซัพพลายเชน จำกัด', tax_id: '0107531000110', phone: '02-067-8999', email: 'vendor@makro.co.th', address: '1468 ถ.พัฒนาการ คลองตันเหนือ วัฒนา กรุงเทพฯ 10250', contact_person: 'คุณนภาลัย สุขเกษม' },
  { code: 'SUP-004', name: 'บริษัท ไทยเบฟเวอเรจ โลจิสติกส์ จำกัด', tax_id: '0107546000342', phone: '02-785-5555', email: 'supply@thaibev.com', address: '14 ถ.วิภาวดีรังสิต จอมพล จตุจักร กรุงเทพฯ 10900', contact_person: 'คุณสมภพ บวรกิตติ' },
  { code: 'SUP-005', name: 'บริษัท สหพัฒนพิบูล จำกัด (มหาชน)', tax_id: '0107537001410', phone: '02-318-0062', email: 'order@sahapat.co.th', address: '2156 ถ.เพชรบุรีตัดใหม่ บางกะปิ ห้วยขวาง กรุงเทพฯ 10310', contact_person: 'คุณประภาส มิตรประเสริฐ' },
  { code: 'SUP-006', name: 'บริษัท เบอร์ลี่ ยุคเกอร์ จำกัด (มหาชน)', tax_id: '0107536000223', phone: '02-367-1111', email: 'logistics@bjc.co.th', address: '99 ซ.รูเบีย ถ.สุขุมวิท 42 คลองเตย กรุงเทพฯ 10110', contact_person: 'คุณธวัชชัย เลิศวิจิตร' },
  { code: 'SUP-007', name: 'บริษัท ไทยซัมมิท คอมโพเนนท์ จำกัด', tax_id: '0105528003491', phone: '02-324-0555', email: 'parts@thaisummit.co.th', address: '4/3 หมู่ 1 ถ.บางนา-ตราด กม.16 บางโฉลง บางพลี สมุทรปราการ 10540', contact_person: 'คุณสมเกียรติ ยั่งยืน' },
  { code: 'SUP-008', name: 'บริษัท ออฟฟิศเมท (ไทย) จำกัด', tax_id: '0105551042318', phone: '02-739-5555', email: 'b2b@officemate.co.th', address: '919/555 อาคารจิวเวลรี่เทรดเซ็นเตอร์ สีลม บางรัก กรุงเทพฯ 10500', contact_person: 'คุณสุภาพร ศรีสวัสดิ์' },
  { code: 'SUP-009', name: 'บริษัท ดับเบิ้ล เอ (1991) จำกัด (มหาชน)', tax_id: '0107537000782', phone: '037-208-888', email: 'paper@doublea.co.th', address: '1 หมู่ 2 ต.ท่าตูม อ.ศรีมหาโพธิ จ.ปราจีนบุรี 25140', contact_person: 'คุณพิชัย นิติการ' },
  { code: 'SUP-010', name: 'บริษัท ยูนิชาร์ม (ประเทศไทย) จำกัด', tax_id: '0105530018972', phone: '02-748-0000', email: 'fmcg@unicharm.co.th', address: '105 หมู่ 9 นิคมอุตสาหกรรมบางพลี ต.บางเสาธง สมุทรปราการ 10570', contact_person: 'คุณกรรณิการ์ จันทร์เพ็ญ' },
];

// 3. Customers
const CUSTOMERS = [
  { code: 'CUS-001', name: 'บริษัท สรรพสินค้าเซ็นทรัล จำกัด (สาขาลาดพร้าว)', phone: '02-793-7000', email: 'po@central.co.th', address: '1693 ถ.พหลโยธิน แขวงจตุจักร เขตจตุจักร กรุงเทพฯ 10900', postal_code: '10900', default_carrier: 'Flash Express', contact_person: 'คุณธนากร พัฒนกิจ' },
  { code: 'CUS-002', name: 'บริษัท บิ๊กซี ซูเปอร์เซ็นเตอร์ จำกัด (มหาชน) สาขารัชดา', phone: '02-250-4888', email: 'dc@bigc.co.th', address: '125 ถ.รัชดาภิเษก แขวงดินแดง เขตดินแดง กรุงเทพฯ 10400', postal_code: '10400', default_carrier: 'Kerry Express (KEX)', contact_person: 'คุณเมธี เจริญรัตน์' },
  { code: 'CUS-003', name: 'บริษัท เอก-ชัย ดิสทริบิวชั่น ซิสเทม จำกัด (Lotus สาขาบางนา)', phone: '02-797-9000', email: 'order@lotuss.com', address: '19/1 หมู่ 7 ถ.บางนา-ตราด กม.8 บางแก้ว บางพลี สมุทรปราการ 10540', postal_code: '10540', default_carrier: 'Flash Express', contact_person: 'คุณศศิธร ไชยรักษ์' },
  { code: 'CUS-004', name: 'ท็อปส์ มาร์เก็ต ฟู้ดฮอลล์ (สาขาชิดลม)', phone: '02-655-7000', email: 'purchase@tops.co.th', address: '1027 ถ.เพลินจิต แขวงลุมพินี เขตปทุมวัน กรุงเทพฯ 10330', postal_code: '10330', default_carrier: 'รถคลังจัดส่งเอง (Company Fleet)', contact_person: 'คุณอัครพล เดชา' },
  { code: 'CUS-005', name: 'ศูนย์กระจายสินค้า ลาซาด้า (Lazada Sortation Center)', phone: '02-018-0000', email: 'sortation@lazada.co.th', address: '99/9 หมู่ 2 นิคมอุตสาหกรรม TPARK บางนา กม.39 บางสมัคร บางปะกง ฉะเชิงเทรา 24180', postal_code: '24180', default_carrier: 'J&T Express', contact_person: 'คุณปฏิภาณ สุริยันต์' },
  { code: 'CUS-006', name: 'โฮมโปรดักส์ เซ็นเตอร์ จำกัด (มหาชน) สาขาพระราม 9', phone: '02-831-6000', email: 'dc@homepro.co.th', address: '55/1 ถ.พระราม 9 แขวงห้วยขวาง เขตห้วยขวาง กรุงเทพฯ 10310', postal_code: '10310', default_carrier: 'Kerry Express (KEX)', contact_person: 'คุณกมลวรรณ บุญมี' },
  { code: 'CUS-007', name: 'ร้าน เซเว่น อีเลฟเว่น สาขาหน้ามหาวิทยาลัยเกษตรศาสตร์', phone: '02-071-2000', email: 'b2b-store@cpall.co.th', address: '50 ถ.งามวงศ์วาน แขวงลาดยาว เขตจตุจักร กรุงเทพฯ 10900', postal_code: '10900', default_carrier: 'Flash Express', contact_person: 'คุณวีรพล อินทรา' },
  { code: 'CUS-008', name: 'ซีเจ มอร์ (CJ MORE) สาขาศรีราชา ชลบุรี', phone: '038-312-555', email: 'cj-express@cjexpress.co.th', address: '88/1 ถ.สุขุมวิท ต.ศรีราชา อ.ศรีราชา ชลบุรี 20110', postal_code: '20110', default_carrier: 'Flash Express', contact_person: 'คุณชูเกียรติ พูลสวัสดิ์' },
  { code: 'CUS-009', name: 'บริษัท เมกา โฮม เซ็นเตอร์ จำกัด (สาขารังสิต)', phone: '02-516-7000', email: 'orders@megahome.co.th', address: '45/9 หมู่ 1 ถ.พหลโยธิน คลองหนึ่ง คลองหลวง ปทุมธานี 12120', postal_code: '12120', default_carrier: 'รถคลังจัดส่งเอง (Company Fleet)', contact_person: 'คุณปัญญา โชคอนันต์' },
  { code: 'CUS-010', name: 'คุณสมชาย ใจดี (ลูกค้าขายส่งออนไลน์)', phone: '081-234-5678', email: 'somchai.shop@gmail.com', address: '123/45 หมู่บ้านสุขสันต์ ซอย 9 แขวงบางเขน เขตสายไหม กรุงเทพมหานคร 10220', postal_code: '10220', default_carrier: 'ไปรษณีย์ไทย (EMS)', contact_person: 'คุณสมชาย ใจดี' },
];

// Product Category Generators
const CATEGORIES = [
  {
    name: 'บรรจุภัณฑ์ & กล่องพัสดุ (Packaging)',
    prefix: 'PKG',
    zone: 'A',
    templates: [
      { name: 'กล่องพัสดุ เบอร์ 0 (11x17x6 cm)', price: 3.5, cost: 1.8, unit: 'ใบ' },
      { name: 'กล่องพัสดุ เบอร์ 00 (9.5x14x6 cm)', price: 2.5, cost: 1.2, unit: 'ใบ' },
      { name: 'กล่องพัสดุ เบอร์ A (14x20x6 cm)', price: 4.5, cost: 2.2, unit: 'ใบ' },
      { name: 'กล่องพัสดุ เบอร์ B (17x25x9 cm)', price: 6.0, cost: 3.1, unit: 'ใบ' },
      { name: 'กล่องพัสดุ เบอร์ C (20x30x11 cm)', price: 8.5, cost: 4.5, unit: 'ใบ' },
      { name: 'กล่องพัสดุ เบอร์ D (22x35x14 cm)', price: 12.0, cost: 6.5, unit: 'ใบ' },
      { name: 'บับเบิ้ลกันกระแทก แผ่นฟองอากาศ 65cm x 100m', price: 280, cost: 175, unit: 'ม้วน' },
      { name: 'ฟิล์มยืดพันพาเลท Stretch Film 15 Micron 500m', price: 145, cost: 89, unit: 'ม้วน' },
      { name: 'เทปใส OPP ปิดกล่อง 2 นิ้ว 100 หลา (แพ็ก 6 ม้วน)', price: 110, cost: 65, unit: 'แพ็ก' },
      { name: 'ซองพลาสติกไปรษณีย์ Poly Mailer 28x42 cm (100 ซอง)', price: 135, cost: 78, unit: 'แพ็ก' },
      { name: 'กระดาษความร้อนพิมพ์ใบปะหน้า 100x150 mm (500 แผ่น)', price: 120, cost: 68, unit: 'ม้วน' },
      { name: 'เชือกฟางมัดของ ตรานกแก้ว 1 กก.', price: 65, cost: 38, unit: 'ม้วน' },
    ]
  },
  {
    name: 'อุปกรณ์คลัง & เครื่องมือ (Tools & Warehouse)',
    prefix: 'TLS',
    zone: 'B',
    templates: [
      { name: 'ปืนสแกนบาร์โค้ดไร้สาย 2.4G Laser Wedge Handheld', price: 1250, cost: 720, unit: 'เครื่อง' },
      { name: 'เครื่องพิมพ์ฉลากความร้อน Direct Thermal 4x6 นิ้ว', price: 2890, cost: 1650, unit: 'เครื่อง' },
      { name: 'รถเข็นพาเลทมือโยก Hand Pallet Truck 2.5 ตัน', price: 8900, cost: 5800, unit: 'คัน' },
      { name: 'รถเข็นของพื้นเหล็ก 4 ล้อ พับได้ รับน้ำหนัก 300 กก.', price: 1450, cost: 890, unit: 'คัน' },
      { name: 'ถุงมือผ้าถักเคลือบยางกันลื่น Safety Gloves (12 คู่)', price: 180, cost: 95, unit: 'โหล' },
      { name: 'มีดคัตเตอร์นิรภัย Heavy Duty พร้อมใบมีดสำรอง', price: 95, cost: 45, unit: 'อัน' },
      { name: 'ตลับเมตรวัดขนาดกล่องพัสดุ 5 เมตร ล็อคอัตโนมัติ', price: 120, cost: 60, unit: 'อัน' },
      { name: 'สายรัดเคเบิ้ลไทร์ 8 นิ้ว ขาว/ดำ (ถุง 100 เส้น)', price: 45, cost: 22, unit: 'ถุง' },
      { name: 'ที่ตัดเทปปิดกล่อง โลหะอย่างดี ขนาด 2 นิ้ว', price: 165, cost: 85, unit: 'อัน' },
      { name: 'ป้ายแท็กชั้นวางสินค้าแม่เหล็ก ติดพิกัด A4', price: 85, cost: 40, unit: 'แผ่น' },
    ]
  },
  {
    name: 'เครื่องใช้สำนักงาน (Office & Stationery)',
    prefix: 'OFC',
    zone: 'C',
    templates: [
      { name: 'กระดาษถ่ายเอกสาร A4 80 แกรม Double A (กล่อง 5 รีม)', price: 580, cost: 420, unit: 'กล่อง' },
      { name: 'ปากกาเคมีลบไม่ได้ หัวแหลม Permanent Marker ดำ (โหล)', price: 180, cost: 105, unit: 'โหล' },
      { name: 'แฟ้มเอกสารห่วงเหล็ก ตราช้าง สัน 2 นิ้ว', price: 75, cost: 44, unit: 'เล่ม' },
      { name: 'เครื่องเย็บกระดาษตัวใหญ่ เบอร์ 3 พร้อมลวดเย็บ', price: 240, cost: 135, unit: 'ชุด' },
      { name: 'ตรายางวันที่หมึกในตัว ภาษาไทย วัน/เดือน/ปี', price: 350, cost: 190, unit: 'อัน' },
      { name: 'กระดาษโน้ตดัชนีคั่นหน้า Index Film Post-it', price: 45, cost: 22, unit: 'แพ็ก' },
      { name: 'กรรไกรสเตนเลสตัดกระดาษ 8 นิ้ว', price: 65, cost: 32, unit: 'เล่ม' },
    ]
  },
  {
    name: 'สินค้าอุปโภคบริโภค (FMCG & Supplies)',
    prefix: 'FMC',
    zone: 'D',
    templates: [
      { name: 'น้ำดื่มบรรจุขวด 600 มล. (แพ็ก 12 ขวด)', price: 55, cost: 38, unit: 'แพ็ก' },
      { name: 'กระดาษชำระม้วนใหญ่ JRT 2 ชั้น 300 เมตร (แพ็ก 12 ม้วน)', price: 480, cost: 310, unit: 'ลัง' },
      { name: 'แอลกอฮอล์ทำความสะอาด 75% แกลลอน 5 ลิตร', price: 320, cost: 185, unit: 'แกลลอน' },
      { name: 'สเปรย์ฆ่าเชื้ออเนกประสงค์ Dettol 450 มล.', price: 189, cost: 125, unit: 'กระป๋อง' },
      { name: 'ถุงขยะดำขนาดหนาพิเศษ 30x40 นิ้ว (1 กก.)', price: 75, cost: 42, unit: 'แพ็ก' },
      { name: 'กระดาษเช็ดมือพับ V-Fold 2 ชั้น (ลัง 24 ห่อ)', price: 620, cost: 410, unit: 'ลัง' },
    ]
  }
];

async function seed() {
  try {
    // 1. Seed Carriers
    console.log('\n🚚 [1/6] Seeding Carriers...');
    for (const c of CARRIERS) {
      const { error } = await supabase.from('carriers').upsert({
        org_id: ORG_ID,
        code: c.code,
        name: c.name,
        tracking_url_template: c.tracking_url_template,
        phone: c.phone,
        is_default: c.is_default,
        status: 'ACTIVE',
      }, { onConflict: 'org_id,code' });
      if (error) console.warn(`Carrier warning (${c.code}):`, error.message);
    }
    console.log(`✅ Carriers seeded (${CARRIERS.length} records).`);

    // 2. Seed Suppliers
    console.log('\n🏭 [2/6] Seeding Suppliers...');
    for (const s of SUPPLIERS) {
      const { error } = await supabase.from('suppliers').upsert({
        org_id: ORG_ID,
        code: s.code,
        name: s.name,
        tax_id: s.tax_id,
        phone: s.phone,
        email: s.email,
        address: s.address,
        contact_person: s.contact_person,
      }, { onConflict: 'org_id,code' });
      if (error) console.warn(`Supplier warning (${s.code}):`, error.message);
    }
    console.log(`✅ Suppliers seeded (${SUPPLIERS.length} records).`);

    // 3. Seed Customers
    console.log('\n👥 [3/6] Seeding Customers...');
    for (const c of CUSTOMERS) {
      const { error } = await supabase.from('customers').upsert({
        org_id: ORG_ID,
        code: c.code,
        name: c.name,
        phone: c.phone,
        email: c.email,
        address: c.address,
        postal_code: c.postal_code,
        default_carrier: c.default_carrier,
        contact_person: c.contact_person,
      }, { onConflict: 'org_id,code' });
      if (error) console.warn(`Customer warning (${c.code}):`, error.message);
    }
    console.log(`✅ Customers seeded (${CUSTOMERS.length} records).`);

    // 4. Generate 500 Realistic Products
    console.log('\n📦 [4/6] Generating 500 Products across 4 Zones (A, B, C, D)...');
    const productsToInsert = [];

    for (let i = 1; i <= 500; i++) {
      const catObj = CATEGORIES[(i - 1) % CATEGORIES.length];
      const template = catObj.templates[(i - 1) % catObj.templates.length];
      const sku = `${catObj.prefix}-${String(i).padStart(4, '0')}`;
      
      // Location generation: e.g. A-01-02-1
      const aisle = String(Math.floor((i % 20) / 2) + 1).padStart(2, '0');
      const rack = String((i % 6) + 1).padStart(2, '0');
      const shelf = String((i % 4) + 1);
      const location = `${catObj.zone}-${aisle}-${rack}-${shelf}`;

      const variationSuffix = i > catObj.templates.length ? ` (รุ่นย่อย #${Math.floor(i / catObj.templates.length) + 1})` : '';
      const stock = Math.floor(Math.random() * 250) + 15;
      const minStock = Math.floor(Math.random() * 30) + 10;
      const price = template.price + (i % 5) * 5;

      productsToInsert.push({
        sku,
        name: `${template.name}${variationSuffix}`,
        category: catObj.name,
        price,
        stock,
        min_stock: minStock,
        location,
        barcode: `885${String(100000000 + i).slice(1)}`,
        unit: template.unit,
        status: 'ACTIVE',
      });
    }

    // Insert in chunks of 100
    for (let i = 0; i < productsToInsert.length; i += 100) {
      const chunk = productsToInsert.slice(i, i + 100);
      const { error } = await supabase.from('products').upsert(chunk, { onConflict: 'sku' });
      if (error) {
        console.warn(`Product chunk [${i}-${i + 100}] warning:`, error.message);
      } else {
        process.stdout.write(`... ${i + chunk.length}/500 products\r`);
      }
    }
    console.log('\n✅ 500 Products seeded successfully.');

    // 5. Generate 2,500 Transactions across 90 days for FIFO & Aging
    console.log('\n📊 [5/6] Generating 2,500 Stock Transactions over 90-day timeline...');
    const transactionsToInsert = [];
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;

    for (let i = 1; i <= 2500; i++) {
      const prod = productsToInsert[i % productsToInsert.length];
      const isOutbound = i % 2 === 0;
      const type = isOutbound ? 'OUT' : 'IN';
      const daysAgo = Math.floor(Math.random() * 90);
      const txDate = new Date(now - daysAgo * DAY_MS).toISOString();
      const qty = Math.floor(Math.random() * 25) + 1;

      transactionsToInsert.push({
        sku: prod.sku,
        product_name: prod.name,
        type,
        qty,
        unit_price: prod.price,
        doc_ref: isOutbound ? `ORD-2026-${1000 + (i % 300)}` : `PO-2026-${100 + (i % 80)}`,
        location: prod.location,
        user_name: i % 3 === 0 ? 'Somchai (Staff)' : 'Admin Warehouse',
        created_at: txDate,
      });
    }

    for (let i = 0; i < transactionsToInsert.length; i += 200) {
      const chunk = transactionsToInsert.slice(i, i + 200);
      const { error } = await supabase.from('stock_transactions').insert(chunk);
      if (error) {
        console.warn(`Transactions chunk [${i}-${i + 200}] warning:`, error.message);
      } else {
        process.stdout.write(`... ${i + chunk.length}/2500 transactions\r`);
      }
    }
    console.log('\n✅ 2,500 Stock Transactions seeded successfully.');

    // 6. Generate 30 Sample Active Orders with Carriers
    console.log('\n📦 [6/6] Generating 30 Sample Orders with Carriers & Tracking...');
    const ordersToInsert = [];
    const ORDER_STATUSES = ['NEW', 'PICKING', 'PICKED', 'PACKED', 'SHIPPED', 'DELIVERED'];

    for (let i = 1; i <= 30; i++) {
      const cus = CUSTOMERS[i % CUSTOMERS.length];
      const carrier = CARRIERS[i % CARRIERS.length];
      const prod1 = productsToInsert[(i * 3) % productsToInsert.length];
      const prod2 = productsToInsert[(i * 7) % productsToInsert.length];
      const items = [
        { sku: prod1.sku, name: prod1.name, qty: 2, price: prod1.price, location: prod1.location },
        { sku: prod2.sku, name: prod2.name, qty: 1, price: prod2.price, location: prod2.location }
      ];
      const totalQty = items.reduce((s, it) => s + it.qty, 0);
      const totalAmount = items.reduce((s, it) => s + it.qty * it.price, 0);
      const status = ORDER_STATUSES[i % ORDER_STATUSES.length];

      ordersToInsert.push({
        org_id: ORG_ID,
        order_no: `ORD-2026-${String(8000 + i)}`,
        channel: 'MANUAL',
        customer_name: cus.name,
        phone: cus.phone,
        ship_address: cus.address,
        carrier: carrier.name,
        tracking_no: status === 'SHIPPED' || status === 'DELIVERED' ? `TH${String(9000000000 + i)}` : '',
        status,
        total_qty: totalQty,
        total_amount: totalAmount,
        items_json: items,
      });
    }

    const { error: ordErr } = await supabase.from('outbound_orders').upsert(ordersToInsert, { onConflict: 'order_no' });
    if (ordErr) console.warn('Orders seed warning:', ordErr.message);
    else console.log(`✅ 30 Outbound Orders seeded successfully.`);

    console.log('\n🎉 ALL MOCK DATA SEEDED SUCCESSFULLY FOR WMS 360 PRO!');
    console.log('----------------------------------------------------');
    console.log(`- Carriers: ${CARRIERS.length}`);
    console.log(`- Suppliers: ${SUPPLIERS.length}`);
    console.log(`- Customers: ${CUSTOMERS.length}`);
    console.log(`- Products: ${productsToInsert.length} (500 SKUs)`);
    console.log(`- Transactions: ${transactionsToInsert.length} (2,500 IN/OUT logs)`);
    console.log(`- Orders: ${ordersToInsert.length}`);
    console.log('----------------------------------------------------');

  } catch (err: any) {
    console.error('❌ Seeding Error:', err);
  }
}

seed();
