import { supabase } from "@/integrations/supabase/client";
import type { ExcelRow } from "./excel";
import { payloadSellInNavarro, somaSellInNavarro, type NavarroRegional } from "./navarro";

/** Soma mensal das notas fiscais dos clientes Navarro já gravadas no BI (regional SP + INTER). */
async function somaNotasNavarro(meses: Set<string>): Promise<Map<string, number>> {
  const { data: clientes, error: cErr } = await supabase.from("clientes").select("id").ilike("nome", "NAVARRO%");
  if (cErr) throw new Error(`Navarro: ${cErr.message}`);
  const ids = (clientes ?? []).map((c) => c.id);
  const soma = new Map<string, number>([...meses].map((m) => [`SP|${m}`, 0]));
  if (ids.length === 0) return soma;
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("notas_fiscais")
      .select("data,valor")
      .in("cliente_id", ids)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Navarro: ${error.message}`);
    for (const n of data ?? []) {
      const am = `${Number(n.data.slice(0, 4))}|${Number(n.data.slice(5, 7))}`;
      if (meses.has(am)) soma.set(`SP|${am}`, (soma.get(`SP|${am}`) ?? 0) + Number(n.valor));
    }
    if (!data || data.length < PAGE) break;
  }
  return soma;
}

/**
 * Atualiza o Sell In do Grupo Navarro a partir do relatório de faturamento.
 * Relatório geral (sem Vendedor) só informa a regional SP e, como pode trazer
 * meses parciais, o valor vem das notas já gravadas (`spDasNotas`) — por isso
 * só é aceito logo depois da importação de faturamento.
 * Retorna null quando o arquivo não tem linhas da Navarro.
 */
export async function importarSellInNavarro(
  linhas: ExcelRow[],
  opts: { spDasNotas: boolean },
): Promise<{ meses: number; regionais: NavarroRegional[]; ignorados: string[] } | null> {
  const r = somaSellInNavarro(linhas);
  if (r.soma.size === 0) return null;
  let soma = r.soma;
  if (r.regionais.length === 1) {
    if (!opts.spDasNotas)
      throw new Error(
        "Este é o relatório geral de faturamento (sem a coluna Vendedor). Envie em Importar Excel → Faturamento Sell In: a Navarro SP é atualizada junto.",
      );
    soma = await somaNotasNavarro(new Set([...r.soma.keys()].map((k) => k.split("|").slice(1).join("|"))));
  }
  const { data: u } = await supabase.auth.getUser();
  const payload = payloadSellInNavarro({ soma, regionais: r.regionais }, u.user?.id ?? null);
  const { error } = await supabase
    .from("navarro_evolucao")
    .upsert(payload, { onConflict: "regional,tipo,ano,mes" });
  if (error) throw new Error(`Navarro: ${error.message}`);
  return { meses: payload.length / r.regionais.length, regionais: r.regionais, ignorados: r.ignorados };
}
