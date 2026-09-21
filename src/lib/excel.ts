import * as XLSX from "xlsx";
import { parseBRDate, parseBRNumber } from "./format";

export type ExcelRow = Record<string, unknown>;

/** UTF-8 (com ou sem BOM); se o arquivo não for UTF-8 válido, cai para Windows-1252 (Excel BR antigo). */
function decodeCsv(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

/**
 * CSV é lido como texto puro (tudo string). Não dá pra deixar a biblioteca
 * "adivinhar" datas: ela lê no padrão americano e troca dia/mês quando o dia
 * é ≤ 12 (03/09/2026 vira 9 de março). Como strings, as datas DD/MM/AAAA
 * chegam intactas em parseBRDate e os números em parseBRNumber.
 */
function readCsv(buffer: ArrayBuffer): XLSX.WorkBook {
  const text = decodeCsv(buffer);
  const header = text.split(/\r?\n/, 1)[0] ?? "";
  // CSV brasileiro costuma usar ";" (a vírgula é o decimal); detecta pelo cabeçalho.
  const FS = [";", "\t", ","]
    .map((s) => ({ s, n: header.split(s).length - 1 }))
    .sort((a, b) => b.n - a.n)[0].s;
  return XLSX.read(text, { type: "string", raw: true, FS });
}

export async function readExcelFile(file: File): Promise<{ sheets: Record<string, ExcelRow[]> }> {
  const buffer = await file.arrayBuffer();
  const isCsv = /\.csv$/i.test(file.name) || file.type === "text/csv";
  // raw: true preserva números nativos do Excel (evita interpretar "3.614" como 3,614)
  // cellDates: true converte datas em objetos Date
  const wb = isCsv ? readCsv(buffer) : XLSX.read(buffer, { type: "array", cellDates: true });
  const sheets: Record<string, ExcelRow[]> = {};
  wb.SheetNames.forEach((name) => {
    const ws = wb.Sheets[name];
    sheets[name] = XLSX.utils.sheet_to_json(ws, { defval: "", raw: true });
  });
  return { sheets };
}

const normColName = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");

/** Procura uma coluna pelo nome (case-insensitive, sem acentos). */
export function pickCol(row: ExcelRow, ...names: string[]): unknown {
  const targets = names.map(normColName);
  for (const key of Object.keys(row)) {
    if (targets.includes(normColName(key))) return row[key];
  }
  return undefined;
}

/** A planilha tem alguma dessas colunas (mesmo que vazia)? Use a 1\u00aa linha. */
export function hasCol(row: ExcelRow | undefined, ...names: string[]): boolean {
  if (!row) return false;
  const targets = names.map(normColName);
  return Object.keys(row).some((key) => targets.includes(normColName(key)));
}

/** Como pickCol, mas na ordem dos nomes dados e ignorando colunas vazias (1\u00ba nome preenchido vence). */
export function pickFirst(row: ExcelRow, ...names: string[]): unknown {
  for (const name of names) {
    const v = pickCol(row, name);
    if (v != null && String(v).trim() !== "") return v;
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
