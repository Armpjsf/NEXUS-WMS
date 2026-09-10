// Excel (.xlsx) and CSV export helper using xlsx library

import * as XLSX from 'xlsx';

export function exportToExcel(
  data: Record<string, any>[],
  fileName: string,
  sheetName = 'Data'
) {
  if (!data || data.length === 0) {
    alert('ไม่มีข้อมูลสำหรับส่งออก');
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const cleanName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  XLSX.writeFile(workbook, cleanName);
}

export function exportToCsv(
  data: Record<string, any>[],
  fileName: string
) {
  if (!data || data.length === 0) {
    alert('ไม่มีข้อมูลสำหรับส่งออก');
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(worksheet);
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName.endsWith('.csv') ? fileName : `${fileName}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
