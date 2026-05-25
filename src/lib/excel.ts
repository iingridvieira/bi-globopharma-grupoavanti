import * as XLSX from "xlsx";
import { parseBRDate, parseBRNumber } from "./format";

export type ExcelRow = Record<string, unknown>;

export async function readExcelFile(file: File): Promise<{ sheets: Record<string, ExcelRow[]> }> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheets: Record<string, ExcelRow[]> = {};
  wb.SheetNames.forEach((name) => {
    const ws = wb.Sheets[name];
    sheets[name] = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
  });
  return { sheets };
}

/** Procura uma coluna pelo nome (case-insensitive, sem acentos). */
export function pickCol(row: ExcelRow, ...names: string[]): unknown {
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "");
  const targets = names.map(norm);
  for (const key of Object.keys(row)) {
    if (targets.includes(norm(key))) return row[key];
  }
  return undefined;
}

export function rowToBRDate(value: unknown): string | null {
  return parseBRDate(value);
}
export function rowToBRNumber(value: unknown): number {
  return parseBRNumber(value);
}

/** Exporta dados para .xlsx e dispara download. */
export function exportToExcel(rows: Record<string, unknown>[], filename: string, sheetName = "Dados") {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}
