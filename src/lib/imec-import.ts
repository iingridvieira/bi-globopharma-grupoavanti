import * as XLSX from "xlsx";
import { parseBRDate, parseBRNumber } from "./format";
import { mapRazaoSocialToCliente, normalizeKey } from "./cliente-mapping";

export type Empresa = "IMEC" | "NUTIVIT";

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
  empresa: Empresa;
};

const ALVOS = {
  nome: ["nome"],
  descricao: ["descricao"],
  numero: ["numdocto", "numerodocto", "numdoc", "numerodocumento"],
  // "razaosocial" é o nome da coluna no modelo antigo (arquivo por empresa);
  // "nomedocliente" é a coluna equivalente no modelo atual (planilha com uma
  // aba por empresa, sem coluna "Razão Social" separada).
  razao: ["razaosocial", "nomedocliente"],
  emissao: ["emissao"],
  quantidade: ["quantidade"],
  unitario: ["vlrunitario", "valorunitario"],
  total: ["vlrtotal", "valortotal"],
} as const;

export const norm = (v: unknown) =>
  String(v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

/** Nome da aba -> empresa, quando a planilha já organiza os dados por aba (modelo atual). */
export function empresaFromSheetName(sheetName: string): Empresa | null {
  const n = norm(sheetName);
  if (n === "imec") return "IMEC";
  if (n === "nutivit") return "NUTIVIT";
  return null;
}

/** Padroniza o nome do cliente usando a mesma lógica do BI Globo. */
export function padronizarCliente(razaoSocial: string, nome?: string): string {
  const base = (razaoSocial || nome || "").trim();
  if (!base) return "";
  return mapRazaoSocialToCliente(base) ?? mapRazaoSocialToCliente(nome ?? "") ?? base.toUpperCase();
}

/** Acha, nas primeiras `limite` linhas de uma matriz, a linha de cabeçalho que contém alguma das colunas obrigatórias. */
export function localizarCabecalho(
  matrix: unknown[][],
  obrigatorias: readonly string[],
  limite = 30,
): { headerIdx: number; header: string[] } {
  for (let i = 0; i < Math.min(matrix.length, limite); i++) {
    const row = (matrix[i] ?? []).map(norm);
    if (row.some((c) => obrigatorias.includes(c))) return { headerIdx: i, header: row };
  }
  throw new Error("Cabeçalho não encontrado.");
}

function lerAbaItensNf(ws: XLSX.WorkSheet, empresa: Empresa): ImecLinha[] {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: "" });
  const { headerIdx, header } = localizarCabecalho(matrix, ALVOS.numero);

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
    const razaoSocial = iRazao >= 0 ? String(r[iRazao] ?? "").trim() : "";
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
      empresa,
    });
  }
  return out;
}

/**
 * Lê a planilha de "Itens das Notas Fiscais de Saída" (IMEC / NUTIVIT).
 *
 * Aceita dois modelos:
 * - Atual: uma aba por empresa, nomeada "IMEC" e/ou "NUTIVIT" — a empresa de
 *   cada linha vem da aba em que ela está, e `empresaPadrao`/nome do arquivo
 *   são ignorados.
 * - Antigo: uma única aba (geralmente contendo "itens" no nome, ou a última
 *   aba do arquivo) com todos os itens de uma única empresa, indicada por
 *   `empresaPadrao` (detectada pelo nome do arquivo ou escolhida manualmente).
 */
export async function lerPlanilhaImec(
  file: File,
  empresaPadrao: Empresa = "IMEC",
): Promise<ImecLinha[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });

  const abasPorEmpresa = wb.SheetNames.map((name) => ({
    name,
    empresa: empresaFromSheetName(name),
  })).filter((s): s is { name: string; empresa: Empresa } => s.empresa !== null);
  if (abasPorEmpresa.length > 0) {
    return abasPorEmpresa.flatMap(({ name, empresa }) => lerAbaItensNf(wb.Sheets[name], empresa));
  }

  const sheetName =
    wb.SheetNames.find((n) => norm(n).includes("itens")) ?? wb.SheetNames[wb.SheetNames.length - 1];
  return lerAbaItensNf(wb.Sheets[sheetName], empresaPadrao);
}

export { normalizeKey };
