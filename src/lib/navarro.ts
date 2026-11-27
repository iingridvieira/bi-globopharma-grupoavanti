import { hasCol, pickCol, rowToBRDate, rowToBRNumber, type ExcelRow } from "./excel";
import { notasComValorNegativo } from "./faturamento";

export type NavarroRegional = "SP" | "RJ" | "MG" | "ES" | "PR";
export const NAVARRO_REGIONAIS: NavarroRegional[] = ["SP", "RJ", "MG", "ES", "PR"];

const VENDEDOR_REGIONAL: Record<string, NavarroRegional> = {
  "PAULO COLELLA": "SP",
  JESSICA: "RJ",
  "JÉSSICA": "RJ",
  VICTOR: "MG",
  CLEBER: "ES",
  SUELLEN: "PR",
};
const MES_ABREV: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

const NF_COLS = ["Número da NF", "Numero da NF", "NF", "Número NF", "Num NF"];
const VALOR_COLS = ["Faturado (R$)", "Soma de Faturado (R$)", "Faturado R$", "Faturado"];
const DATA_COLS = ["Data de Lançamento", "Data Lançamento", "Data de Lancamento", "Data"];

function mesAno(l: ExcelRow): { ano: number; mes: number } | null {
  const ma = String(pickCol(l, "MÊS/ANO", "MES/ANO") ?? "").trim().toLowerCase();
  const mm = ma.match(/^([a-zç]{3})\/(\d{2,4})$/);
  const mes = mm?.[1] ? MES_ABREV[mm[1]] : undefined;
  if (mm?.[2] && mes) return { ano: mm[2].length === 2 ? 2000 + Number(mm[2]) : Number(mm[2]), mes };
  const iso = rowToBRDate(pickCol(l, ...DATA_COLS));
  return iso ? { ano: Number(iso.slice(0, 4)), mes: Number(iso.slice(5, 7)) } : null;
}

/**
 * Sell In do Grupo Navarro a partir do relatório de faturamento.
 * - Só entram linhas cujo Cliente é Navarro (quando a coluna Cliente existe).
 * - Com coluna Vendedor, o vendedor define a regional; sem ela (relatório geral
 *   de faturamento), as notas da Navarro pertencem à regional SP (SP + INTER).
 * - NF com alguma linha negativa fica de fora, como no faturamento.
 * `regionais` = regionais que o arquivo é capaz de informar (as únicas a substituir).
 */
export function somaSellInNavarro(linhas: ExcelRow[]): {
  soma: Map<string, number>;
  regionais: NavarroRegional[];
  ignorados: string[];
} {
  const first = linhas[0];
  const temVendedor = hasCol(first, "Vendedor");
  const temCliente = hasCol(first, "Cliente");
  const negativas = notasComValorNegativo(
    linhas.map((l) => ({
      numero: String(pickCol(l, ...NF_COLS) ?? "").trim(),
      valor: rowToBRNumber(pickCol(l, ...VALOR_COLS)),
    })),
  );
  const soma = new Map<string, number>();
  const ignorados = new Set<string>();
  for (const l of linhas) {
    if (temCliente && !/navarro/i.test(String(pickCol(l, "Cliente") ?? ""))) continue;
    if (negativas.has(String(pickCol(l, ...NF_COLS) ?? "").trim())) continue;
    const ref = mesAno(l);
    if (!ref) continue;
    let reg: NavarroRegional | undefined = "SP";
    if (temVendedor) {
      const vend = String(pickCol(l, "Vendedor") ?? "").trim().toUpperCase();
      reg = VENDEDOR_REGIONAL[vend];
      if (!reg) {
        ignorados.add(vend || "(sem vendedor)");
        continue;
      }
    }
    const k = `${reg}|${ref.ano}|${ref.mes}`;
    soma.set(k, (soma.get(k) ?? 0) + rowToBRNumber(pickCol(l, ...VALOR_COLS)));
  }
  return { soma, regionais: temVendedor ? NAVARRO_REGIONAIS : ["SP"], ignorados: [...ignorados] };
}

/** Linhas de navarro_evolucao (Sell In) para os meses presentes no arquivo. */
export function payloadSellInNavarro(
  { soma, regionais }: Pick<ReturnType<typeof somaSellInNavarro>, "soma" | "regionais">,
  userId: string | null,
) {
  const meses = new Set([...soma.keys()].map((k) => k.split("|").slice(1).join("|")));
  const agora = new Date().toISOString();
  return [...meses].flatMap((am) => {
    const [ano = 0, mes = 0] = am.split("|").map(Number);
    return regionais.map((regional) => ({
      regional,
      tipo: "sell_in" as const,
      ano,
      mes,
      valor: Math.round((soma.get(`${regional}|${am}`) ?? 0) * 100) / 100,
      updated_by: userId,
      updated_at: agora,
    }));
  });
}
