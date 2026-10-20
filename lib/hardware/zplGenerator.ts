/**
 * Industrial ZPL II (Zebra Programming Language) Template Generator
 * WMS Smart Enterprise - Direct Thermal Label Generation
 */

export interface ZplPalletLabelOptions {
  sscc?: string; // Serial Shipping Container Code (18 digits)
  sku?: string;
  productName?: string;
  lotNumber?: string;
  qty?: number;
  uom?: string;
  mfgDate?: string;
  expDate?: string;
  destinationDock?: string;
}

export interface ZplProductLabelOptions {
  sku?: string;
  productName?: string;
  barcode?: string;
  price?: number;
  lotNumber?: string;
  expDate?: string;
}

/**
 * Strip ZPL command control characters (^ and ~) and control bytes from user input
 * so user-supplied text can never inject raw ZPL printer commands.
 */
export function sanitizeZpl(input: unknown, fallback = ''): string {
  if (input == null) return fallback;
  return String(input)
    .replace(/[\^~\r\n]/g, ' ')
    .trim() || fallback;
}

/**
 * Generate standard GS1 4x6" Pallet Label in ZPL II
 */
export function generatePalletZpl(opts: Partial<ZplPalletLabelOptions> = {}): string {
  const safeOpts = opts || {};
  const sku = sanitizeZpl(safeOpts.sku, 'UNKNOWN-SKU');
  const productName = sanitizeZpl(safeOpts.productName, sku).slice(0, 32);
  const lotNumber = sanitizeZpl(safeOpts.lotNumber, 'N/A');
  const expDate = sanitizeZpl(safeOpts.expDate, 'N/A');
  const qty = Number.isFinite(Number(safeOpts.qty)) ? Number(safeOpts.qty) : 0;
  const uom = sanitizeZpl(safeOpts.uom, 'PCS');
  const destinationDock = sanitizeZpl(safeOpts.destinationDock, 'BAY-01');
  const sscc = sanitizeZpl(safeOpts.sscc, '000000000000000000');

  return `^XA
^PW812
^LL1218
^LH0,0

^FX Header ^FS
^FO50,50^A0N,40,40^FDNEXUS SMART WMS - LOGISTICS PALLET^FS
^FO50,95^GB712,3,3^FS

^FX Product & SKU Info ^FS
^FO50,120^A0N,28,28^FDSKU / ITEM CODE:^FS
^FO50,155^A0N,55,55^FD${sku}^FS
^FO50,225^A0N,32,32^FD${productName}^FS

^FO50,270^GB712,2,2^FS

^FX Lot & Expiry Grid ^FS
^FO50,290^A0N,26,26^FDLOT / BATCH:^FS
^FO50,325^A0N,36,36^FD${lotNumber}^FS

^FO400,290^A0N,26,26^FDEXPIRY DATE:^FS
^FO400,325^A0N,36,36^FD${expDate}^FS

^FO50,380^A0N,26,26^FDQUANTITY:^FS
^FO50,415^A0N,50,50^FD${qty} ${uom}^FS

^FO400,380^A0N,26,26^FDDOCK BAY:^FS
^FO400,415^A0N,50,50^FD${destinationDock}^FS

^FO50,480^GB712,2,2^FS

^FX Primary Barcode (Code 128) ^FS
^FO100,520^BY3,3,130^BCN,130,Y,N,N^FD${sku}^FS

^FX SSCC-18 Logistics Barcode ^FS
^FO50,750^A0N,26,26^FDSSCC PALLET IDENTIFIER:^FS
^FO50,790^A0N,30,30^FD(00) ${sscc}^FS
^FO80,840^BY3,3,160^BCN,160,Y,N,N^FD>800${sscc}^FS

^FO50,1080^GB712,2,2^FS
^FO50,1100^A0N,22,22^FDDATE: ${new Date().toLocaleDateString('th-TH')} | ENTERPRISE PALLET TAG^FS
^XZ`;
}

/**
 * Generate 2x1" or 3x2" Product SKU Bin / Shelf Barcode Label
 */
export function generateProductZpl(opts: Partial<ZplProductLabelOptions> = {}): string {
  const safeOpts = opts || {};
  const sku = sanitizeZpl(safeOpts.sku, 'UNKNOWN-SKU');
  const productName = sanitizeZpl(safeOpts.productName, sku).slice(0, 24);
  const barcode = sanitizeZpl(safeOpts.barcode, sku);
  const lotNumber = safeOpts.lotNumber ? sanitizeZpl(safeOpts.lotNumber) : '';
  const expDate = sanitizeZpl(safeOpts.expDate, '-');
  const price = safeOpts.price != null && Number.isFinite(Number(safeOpts.price)) ? Number(safeOpts.price) : null;

  return `^XA
^PW600
^LL400
^LH0,0

^FO30,30^A0N,28,28^FD${productName}^FS
^FO30,65^A0N,24,24^FDSKU: ${sku}^FS

^FO50,110^BY2,3,90^BCN,90,Y,N,N^FD${barcode}^FS

${lotNumber ? `^FO30,240^A0N,20,20^FDLOT: ${lotNumber} | EXP: ${expDate}^FS` : ''}
${price ? `^FO30,270^A0N,32,32^FD฿${price.toLocaleString()}^FS` : ''}

^XZ`;
}
