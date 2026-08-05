import * as XLSX from "xlsx";
import { parseBRDate, parseBRNumber } from "./format";
import { mapRazaoSocialToCliente, normalizeKey } from "./cliente-mapping";

export type ImecLinha = {
  nome: string;
  descricao: string;
  numero: string;
  razaoSocial: string;
  data: string; // ISO
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  clientePadrao: string;
};

const ALVOS = {
  nome: ["nome"],
  descricao: ["descricao"],
  numero: ["numdocto", "numerodocto", "numdoc", "numerodocumento"],
  razao: ["razaosocial"],
  emissao: ["emissao"],
  quantidade: ["quantidade"],
  unitario: ["vlrunitario", "valorunitario"],
  total: ["vlrtotal", "valortotal"],
} as const;

const norm = (v: unknown) =>
  String(v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

/** Padroniza o nome do cliente usando a mesma lógica do BI Globo. */
export function padronizarCliente(razaoSocial: string, nome?: string): string {
  const base = (razaoSocial || nome || "").trim();
  if (!base) return "";
  return mapRazaoSocialToCliente(base) ?? mapRazaoSocialToCliente(nome ?? "") ?? base.toUpperCase();
}

/**
 * Lê a planilha de "Itens das Notas Fiscais de Saída" (IMEC / NUTIVIT).
 * O cabeçalho não fica na primeira linha, então é localizado dinamicamente.
 */
export async function lerPlanilhaImec(file: File): Promise<ImecLinha[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheetName =
    wb.SheetNames.find((n) => norm(n).includes("itens")) ??
    wb.SheetNames[wb.SheetNames.length - 1];
  const ws = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: "" });

  let headerIdx = -1;
  for (let i = 0; i < Math.min(matrix.length, 30); i++) {
    const row = matrix[i] ?? [];
    if (row.some((c) => ALVOS.numero.includes(norm(c) as never))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) throw new Error("Cabeçalho não encontrado (coluna 'Num. Docto.').");

  const header = (matrix[headerIdx] ?? []).map(norm);
  const col = (alvos: readonly string[]) => header.findIndex((h) => alvos.includes(h));
  const iNome = col(ALVOS.nome);
  const iDesc = col(ALVOS.descricao);
  const iNum = col(ALVOS.numero);
  const iRazao = col(ALVOS.razao);
  const iData = col(ALVOS.emissao);
  const iQtd = col(ALVOS.quantidade);
  const iUni = col(ALVOS.unitario);
  const iTot = col(ALVOS.total);

  const out: ImecLinha[] = [];
  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const r = matrix[i] ?? [];
    const numero = String(r[iNum] ?? "").trim();
    const razaoSocial = String(r[iRazao] ?? "").trim();
    const nome = iNome >= 0 ? String(r[iNome] ?? "").trim() : "";
    const data = parseBRDate(r[iData]);
    if (!numero || !data || (!razaoSocial && !nome)) continue;

    const quantidade = parseBRNumber(r[iQtd]);
    const valorUnitario = parseBRNumber(r[iUni]);
    const valorTotal = parseBRNumber(r[iTot]);
    const clientePadrao = padronizarCliente(razaoSocial, nome);
    if (!clientePadrao) continue;

    out.push({
      nome,
      descricao: iDesc >= 0 ? String(r[iDesc] ?? "").trim() : "",
      numero,
      razaoSocial: razaoSocial || nome,
      data,
      quantidade,
      valorUnitario,
      valorTotal,
      clientePadrao,
    });
  }
  return out;
}

export { normalizeKey };
