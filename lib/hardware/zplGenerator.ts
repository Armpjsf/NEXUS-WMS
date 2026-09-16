/**
 * Industrial ZPL II (Zebra Programming Language) Template Generator
 * WMS Smart Enterprise - Direct Thermal Label Generation
 */

export interface ZplPalletLabelOptions {
  sscc: string; // Serial Shipping Container Code (18 digits)
  sku: string;
  productName: string;
  lotNumber: string;
  qty: number;
  uom: string;
  mfgDate?: string;
  expDate?: string;
  destinationDock?: string;
}

export interface ZplProductLabelOptions {
  sku: string;
  productName: string;
  barcode: string;
  price?: number;
  lotNumber?: string;
  expDate?: string;
}

/**
 * Generate standard GS1 4x6" Pallet Label in ZPL II
 */
export function generatePalletZpl(opts: ZplPalletLabelOptions): string {
  return `^XA
^PW812
^LL1218
^LH0,0

// Header
^FO50,50^A0N,40,40^FDNEXUS SMART WMS - LOGISTICS PALLET^FS
^FO50,95^GB712,3,3^FS

// Product & SKU Info
^FO50,120^A0N,28,28^FDSKU / ITEM CODE:^FS
^FO50,155^A0N,55,55^FD${opts.sku}^FS
^FO50,225^A0N,32,32^FD${opts.productName.slice(0, 32)}^FS

^FO50,270^GB712,2,2^FS

// Lot & Expiry Grid
^FO50,290^A0N,26,26^FDLOT / BATCH:^FS
^FO50,325^A0N,36,36^FD${opts.lotNumber || 'N/A'}^FS

^FO400,290^A0N,26,26^FDEXPIRY DATE:^FS
^FO400,325^A0N,36,36^FD${opts.expDate || 'N/A'}^FS

^FO50,380^A0N,26,26^FDQUANTITY:^FS
^FO50,415^A0N,50,50^FD${opts.qty} ${opts.uom}^FS

^FO400,380^A0N,26,26^FDDOCK BAY:^FS
^FO400,415^A0N,50,50^FD${opts.destinationDock || 'BAY-01'}^FS

^FO50,480^GB712,2,2^FS

// Primary Barcode (Code 128)
^FO100,520^BY3,3,130^BCN,130,Y,N,N^FD${opts.sku}^FS

// SSCC-18 Logistics Barcode
^FO50,750^A0N,26,26^FDSSCC PALLET IDENTIFIER:^FS
^FO50,790^A0N,30,30^FD(00) ${opts.sscc}^FS
^FO80,840^BY3,3,160^BCN,160,Y,N,N^FD>800${opts.sscc}^FS

^FO50,1080^GB712,2,2^FS
^FO50,1100^A0N,22,22^FDDATE: ${new Date().toLocaleDateString('th-TH')} | ENTERPRISE PALLET TAG^FS
^XZ`;
}

/**
 * Generate 2x1" or 3x2" Product SKU Bin / Shelf Barcode Label
 */
export function generateProductZpl(opts: ZplProductLabelOptions): string {
  return `^XA
^PW600
^LL400
^LH0,0

^FO30,30^A0N,28,28^FD${opts.productName.slice(0, 24)}^FS
^FO30,65^A0N,24,24^FDSKU: ${opts.sku}^FS

^FO50,110^BY2,3,90^BCN,90,Y,N,N^FD${opts.barcode || opts.sku}^FS

${opts.lotNumber ? `^FO30,240^A0N,20,20^FDLOT: ${opts.lotNumber} | EXP: ${opts.expDate || '-'}^FS` : ''}
${opts.price ? `^FO30,270^A0N,32,32^FD฿${opts.price.toLocaleString()}^FS` : ''}

^XZ`;
}