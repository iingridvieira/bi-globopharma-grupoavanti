import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, MESES_BR_SHORT } from "@/lib/format";
import { exportToExcel } from "@/lib/excel";
import { Download } from "lucide-react";
import { MultiSelect } from "@/components/MultiSelect";
import {
  ColumnFilterHeader,
  ClearFiltersButton,
  useColumnFilters,
} from "@/components/ColumnFilterHeader";

export const Route = createFileRoute("/_authenticated/imec/sell-in")({
  head: () => ({
    meta: [
      { title: "Sell In · BI IMEC" },
      { name: "description", content: "Consolidado anual de Sell In por cliente do BI IMEC." },
    ],
  }),
  component: ImecSellInPage,
});

const EMPRESAS = ["IMEC", "NUTIVIT"];

type Row = { id: string; nome: string; meses: number[]; total: number; media: number; repr: number };

function ImecSellInPage() {
  const [ano, setAno] = useState(new Date().getFullYear());
  const [empresasSel, setEmpresasSel] = useState<string[]>([]);

  const { data } = useQuery({
    queryKey: ["imec-sell-in", ano, empresasSel],
    queryFn: async () => {
      let q = supabase.from("imec_sell_in").select("cliente_id,mes,valor,empresa").eq("ano", ano);
      if (empresasSel.length > 0) q = q.in("empresa", empresasSel);
      const [clientes, sellIn] = await Promise.all([
        supabase.from("imec_clientes").select("id,nome").order("nome"),
        q,
      ]);
      const matrix = new Map<string, Row>();
      (clientes.data ?? []).forEach((c) =>
        matrix.set(c.id, { id: c.id, nome: c.nome, meses: Array(12).fill(0), total: 0, media: 0, repr: 0 }),
      );
      (sellIn.data ?? []).forEach((s) => {
        const r = matrix.get(s.cliente_id);
        if (!r) return;
        r.meses[s.mes - 1] += Number(s.valor);
        r.total += Number(s.valor);
      });
      const mesAtual = new Date().getMonth() + 1;
      const rows = Array.from(matrix.values()).filter((r) => r.total !== 0);
      rows.forEach((r) => (r.media = mesAtual > 0 ? r.total / mesAtual : 0));
      const totaisMes = Array(12).fill(0);
      rows.forEach((r) => r.meses.forEach((v, i) => (totaisMes[i] += v)));
      const totalGeral = totaisMes.reduce((a, b) => a + b, 0);
      rows.forEach((r) => (r.repr = totalGeral > 0 ? (r.total / totalGeral) * 100 : 0));
      return { rows, totaisMes, totalGeral, mesAtual };
    },
  });

  const rows = data?.rows ?? [];
  const totaisMes = data?.totaisMes ?? Array(12).fill(0);
  const totalGeral = data?.totalGeral ?? 0;

  const getters = useMemo(() => {
    const g: Record<string, (r: Row) => string> = { cliente: (r) => r.nome };
    MESES_BR_SHORT.forEach((_, i) => (g[`m${i}`] = (r) => String(r.meses[i] ?? 0)));
    g.total = (r) => String(r.total);
    g.media = (r) => String(r.media);
    g.repr = (r) => String(r.repr);
    return g;
  }, []);
  const types = useMemo(() => {
    const t: Record<string, "text" | "number"> = { cliente: "text", total: "number", media: "number", repr: "number" };
    MESES_BR_SHORT.forEach((_, i) => (t[`m${i}`] = "number"));
    return t;
  }, []);
  const labels = useMemo(() => {
    const l: Record<string, string> = { cliente: "Cliente" };
    MESES_BR_SHORT.forEach((m, i) => (l[`m${i}`] = m));
    l.total = "Total";
    l.media = "Média";
    l.repr = "Rep.";
    return l;
  }, []);
  const { view, distinct, filters, sorts, setFilter, setSort, reset } = useColumnFilters(rows, getters, types);

  function handleExport() {
    const out = view.map((r) => {
      const obj: Record<string, unknown> = { Cliente: r.nome };
      MESES_BR_SHORT.forEach((m, i) => (obj[m] = r.meses[i]));
      obj.Total = r.total;
      obj.Média = r.media;
      obj["Rep."] = `${r.repr.toFixed(1).replace(".", ",")}%`;
      return obj;
    });
    exportToExcel(out, `imec-sell-in-${ano}.xlsx`, "Sell In");
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <header className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <div className="bi-stat-label">Consolidado anual · IMEC / NUTIVIT</div>
          <h1 className="font-display text-3xl font-bold mt-1">Sell In · {ano}</h1>
        </div>
        <div className="flex items-center gap-3">
          <MultiSelect
            options={EMPRESAS.map((e) => ({ value: e, label: e }))}
            selected={empresasSel}
            onChange={setEmpresasSel}
            placeholder="Todas as empresas"
            width={170}
          />
          <select
            value={ano}
            onChange={(e) => setAno(Number(e.target.value))}
            className="h-10 px-3 bg-input border border-border rounded-md"
          >
            {[ano - 1, ano, ano + 1].map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <button
            onClick={handleExport}
            className="h-10 px-4 rounded-md bg-primary text-primary-foreground font-semibold text-sm flex items-center gap-2"
          >
            <Download className="h-4 w-4" /> Excel
          </button>
        </div>
      </header>

      <div className="bi-card overflow-x-auto">
        <div className="flex justify-end px-3 py-1.5">
          <ClearFiltersButton filters={filters} sorts={sorts} onReset={reset} />
        </div>
        <table className="bi-table">
          <thead>
            <tr>
              {Object.keys(getters).map((k) => (
                <th key={k} className={k === "cliente" ? "bi-col-sticky" : "text-right"}>
                  <ColumnFilterHeader
                    label={labels[k]}
                    values={distinct[k] ?? []}
                    selected={filters[k] ?? []}
                    onChange={(v) => setFilter(k, v)}
                    sort={sorts[k] ?? null}
                    onSortChange={(s) => setSort(k, s)}
                    type={types[k] ?? "text"}
                    align={k === "cliente" ? "left" : "right"}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.map((r) => (
              <tr key={r.id}>
                <td className="font-medium bi-col-sticky">{r.nome}</td>
                {r.meses.map((v, i) => (
                  <td key={i} className="text-right tabular-nums text-xs">
                    {v ? formatBRL(v) : "—"}
                  </td>
                ))}
                <td className="text-right tabular-nums font-semibold text-primary">{formatBRL(r.total)}</td>
                <td className="text-right tabular-nums text-xs text-muted-foreground">{formatBRL(r.media)}</td>
                <td className="text-right">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                      r.repr <= 5
                        ? "bg-red-500/20 text-red-400"
                        : r.repr <= 10
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-emerald-500/20 text-emerald-400"
                    }`}
                  >
                    {r.repr.toFixed(1).replace(".", ",")}%
                  </span>
                </td>
              </tr>
            ))}
            {view.length === 0 && (
              <tr>
                <td colSpan={16} className="text-center text-muted-foreground py-10">
                  Nenhum faturamento importado para {ano}.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td className="bi-col-sticky">TOTAL</td>
              {totaisMes.map((v, i) => (
                <td key={i} className="text-right text-xs">
                  {formatBRL(v)}
                </td>
              ))}
              <td className="text-right text-primary">{formatBRL(totalGeral)}</td>
              <td className="text-right text-xs text-muted-foreground">
                {formatBRL(data?.mesAtual ? totalGeral / data.mesAtual : 0)}
              </td>
              <td className="text-right text-xs font-semibold">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
