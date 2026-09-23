import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { exportToExcel } from "@/lib/excel";
import { formatBRL, MESES_BR_SHORT } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/imec/sell-out")({
  head: () => ({
    meta: [
      { title: "Sell Out · BI IMEC" },
      { name: "description", content: "Consolidado anual de Sell Out por cliente no BI IMEC." },
      { property: "og:title", content: "Sell Out · BI IMEC" },
      { property: "og:description", content: "Consolidado anual de Sell Out por cliente no BI IMEC." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ImecSellOut,
});

function ImecSellOut() {
  const [ano, setAno] = useState(new Date().getFullYear());
  const { data, isLoading } = useQuery({
    queryKey: ["imec-sell-out", ano],
    queryFn: async () => {
      const [c, s] = await Promise.all([
        supabase.from("imec_clientes").select("id,nome"),
        supabase.from("imec_sell_out").select("cliente_id,mes,valor").eq("ano", ano),
      ]);
      if (c.error ?? s.error) throw c.error ?? s.error;
      return { clientes: c.data ?? [], sellOut: s.data ?? [] };
    },
  });

  const { rows, totaisMes, totalGeral } = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const r of data?.sellOut ?? []) {
      const arr = map.get(r.cliente_id) ?? Array(12).fill(0);
      arr[r.mes - 1] += Number(r.valor);
      map.set(r.cliente_id, arr);
    }
    const nomes = new Map((data?.clientes ?? []).map((c) => [c.id, c.nome]));
    const rows = Array.from(map.entries())
      .map(([id, meses]) => {
        const total = meses.reduce((a, b) => a + b, 0);
        const ativos = meses.filter((v) => v > 0).length;
        return { id, nome: nomes.get(id) ?? "—", meses, total, media: ativos ? total / ativos : 0 };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    const totaisMes = Array.from({ length: 12 }, (_, i) => rows.reduce((t, r) => t + r.meses[i], 0));
    return { rows, totaisMes, totalGeral: totaisMes.reduce((a, b) => a + b, 0) };
  }, [data]);

  function exportar() {
    exportToExcel(
      rows.map((r) => {
        const o: Record<string, string | number> = { Cliente: r.nome };
        MESES_BR_SHORT.forEach((m, i) => (o[m] = r.meses[i]));
        o.Total = r.total;
        o["Média"] = r.media;
        return o;
      }),
      `imec-sell-out-${ano}.xlsx`,
      "Sell Out",
    );
  }

  return (
    <div className="p-5 sm:p-8 max-w-[1600px] mx-auto">
      <header className="flex items-end justify-between mb-6 gap-3 flex-wrap">
        <div>
          <div className="bi-stat-label">Consolidado anual · IMEC</div>
          <h1 className="font-display text-3xl font-bold mt-1">Sell Out · {ano}</h1>
        </div>
        <div className="flex items-center gap-3">
          <select value={ano} onChange={(e) => setAno(Number(e.target.value))} className="h-10 px-3 bg-input border border-border rounded-md" aria-label="Ano">
            {[ano - 1, ano, ano + 1].map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <button onClick={exportar} disabled={rows.length === 0} className="h-10 px-4 rounded-md bg-primary text-primary-foreground font-semibold text-sm flex items-center gap-2 disabled:opacity-50">
            <Download className="h-4 w-4" /> Excel
          </button>
        </div>
      </header>
      <div className="bi-card overflow-x-auto">
        <table className="bi-table">
          <thead>
            <tr>
              <th className="bi-col-sticky">Cliente</th>
              {MESES_BR_SHORT.map((m) => <th key={m} className="text-right">{m}</th>)}
              <th className="text-right">Total</th>
              <th className="text-right">Média</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={15} className="text-center text-muted-foreground py-10">Carregando…</td></tr>}
            {!isLoading && rows.length === 0 && <tr><td colSpan={15} className="text-center text-muted-foreground py-10">Nenhum sell out importado para {ano}.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-medium bi-col-sticky">
                  <Link to="/imec/por-clientes/$clienteId" params={{ clienteId: r.id }} className="hover:text-primary hover:underline">{r.nome}</Link>
                </td>
                {r.meses.map((v, i) => <td key={i} className="text-right tabular-nums text-xs">{v ? formatBRL(v) : "—"}</td>)}
                <td className="text-right tabular-nums font-semibold text-primary">{formatBRL(r.total)}</td>
                <td className="text-right tabular-nums">{formatBRL(r.media)}</td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr>
                <td className="bi-col-sticky">TOTAL</td>
                {totaisMes.map((v, i) => <td key={i} className="text-right tabular-nums text-xs">{v ? formatBRL(v) : "—"}</td>)}
                <td className="text-right tabular-nums text-primary">{formatBRL(totalGeral)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
