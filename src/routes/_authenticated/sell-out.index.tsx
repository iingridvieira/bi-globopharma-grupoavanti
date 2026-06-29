import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, MESES_BR_SHORT } from "@/lib/format";
import { useMemo, useState } from "react";
import { exportToExcel } from "@/lib/excel";
import { Download } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { ColumnFilterHeader, useColumnFilters } from "@/components/ColumnFilterHeader";

export const Route = createFileRoute("/_authenticated/sell-out/")({ component: SellOutPage });

const normNomeSO = (s: string) => (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();

function SellOutPage() {
  const [ano, setAno] = useState(new Date().getFullYear());
  const { restrictedClientes } = useAuth();
  const allowedSet = restrictedClientes ? new Set(restrictedClientes.map(normNomeSO)) : null;

  const { data } = useQuery({
    queryKey: ["sell-out-consolidado", ano, restrictedClientes?.join("|") ?? "all"],
    queryFn: async () => {
      const [clientes, sellOut] = await Promise.all([
        supabase.from("clientes").select("id,nome").order("nome"),
        supabase.from("sell_out").select("cliente_id,mes,valor").eq("ano", ano),
      ]);
      const matrix = new Map<string, { nome: string; meses: number[]; total: number; media: number; repr: number }>();
      const clientesFiltrados = allowedSet
        ? (clientes.data ?? []).filter((c) => allowedSet.has(normNomeSO(c.nome)))
        : (clientes.data ?? []);
      clientesFiltrados.forEach((c) => matrix.set(c.id, { nome: c.nome, meses: Array(12).fill(0), total: 0, media: 0, repr: 0 }));
      (sellOut.data ?? []).forEach((s) => {
        const r = matrix.get(s.cliente_id); if (!r) return;
        r.meses[s.mes - 1] = Number(s.valor); r.total += Number(s.valor);
      });
      const mesAtual = new Date().getMonth() + 1;
      const rows = Array.from(matrix.values())
        .filter((r) => r.total > 0)
        .map((r) => ({ ...r, media: mesAtual > 0 ? r.total / mesAtual : 0, repr: 0 }));
      const totaisMes = Array(12).fill(0);
      rows.forEach((r) => r.meses.forEach((v, i) => (totaisMes[i] += v)));
      const totalGeral = totaisMes.reduce((a, b) => a + b, 0);
      rows.forEach((r) => (r.repr = totalGeral > 0 ? (r.total / totalGeral) * 100 : 0));
      return { rows, totaisMes, totalGeral, mesAtual };
    },
  });

  function handleExport() {
    if (!data) return;
    const rows = data.rows.map((r) => {
      const o: Record<string, unknown> = { Cliente: r.nome };
      MESES_BR_SHORT.forEach((m, i) => (o[m] = r.meses[i]));
      o.Total = r.total;
      o.Média = r.media;
      o["Rep."] = `${r.repr.toFixed(1).replace(".", ",")}%`;
      return o;
    });
    exportToExcel(rows, `sell-out-${ano}.xlsx`, "Sell Out");
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <header className="flex items-end justify-between mb-6">
        <div>
          <div className="bi-stat-label">Consolidado anual</div>
          <h1 className="font-display text-3xl font-bold mt-1">Sell Out · {ano}</h1>
        </div>
        <div className="flex items-center gap-3">
          <select value={ano} onChange={(e) => setAno(Number(e.target.value))} className="h-10 px-3 bg-input border border-border rounded-md">
            {[ano - 1, ano, ano + 1].map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <button onClick={handleExport} className="h-10 px-4 rounded-md bg-primary text-primary-foreground font-semibold text-sm flex items-center gap-2">
            <Download className="h-4 w-4" /> Excel
          </button>
        </div>
      </header>

      <SellOutTable rows={data?.rows ?? []} totaisMes={data?.totaisMes ?? Array(12).fill(0)} totalGeral={data?.totalGeral ?? 0} mesAtual={data?.mesAtual ?? 0} />
    </div>
  );
}

type SellOutRow = { nome: string; meses: number[]; total: number; media: number; repr: number };

function SellOutTable({ rows, totaisMes, totalGeral, mesAtual }: { rows: SellOutRow[]; totaisMes: number[]; totalGeral: number; mesAtual: number }) {
  const getters = useMemo(() => {
    const g: Record<string, (r: SellOutRow) => string> = { cliente: (r) => r.nome };
    MESES_BR_SHORT.forEach((_, i) => { g[`m${i}`] = (r) => String(r.meses[i] ?? 0); });
    g.total = (r) => String(r.total);
    g.media = (r) => String(r.media);
    g.repr = (r) => String(r.repr);
    return g;
  }, []);
  const types = useMemo(() => {
    const t: Record<string, "text" | "number"> = { cliente: "text", total: "number", media: "number", repr: "number" };
    MESES_BR_SHORT.forEach((_, i) => { t[`m${i}`] = "number"; });
    return t;
  }, []);
  const labels = useMemo(() => {
    const l: Record<string, string> = { cliente: "Cliente" };
    MESES_BR_SHORT.forEach((m, i) => { l[`m${i}`] = m; });
    l.total = "Total"; l.media = "Média"; l.repr = "Rep.";
    return l;
  }, []);
  const { view, distinct, filters, sorts, setFilter, setSort } = useColumnFilters(rows, getters, types);

  return (
    <div className="bi-card overflow-x-auto">
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
            <tr key={r.nome}>
              <td className="font-medium bi-col-sticky">{r.nome}</td>
              {r.meses.map((v, i) => <td key={i} className="text-right tabular-nums text-xs">{v ? formatBRL(v) : "—"}</td>)}
              <td className="text-right tabular-nums font-semibold text-primary">{formatBRL(r.total)}</td>
              <td className="text-right tabular-nums text-xs text-muted-foreground">{formatBRL(r.media)}</td>
              <td className="text-right">
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                  r.repr >= 15 ? "bg-emerald-500/20 text-emerald-400" :
                  r.repr >= 5 ? "bg-yellow-500/20 text-yellow-400" :
                  "bg-red-500/20 text-red-400"
                }`}>
                  {r.repr.toFixed(1).replace(".", ",")}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="bi-col-sticky">TOTAL</td>
            {totaisMes.map((v, i) => <td key={i} className="text-right text-xs">{formatBRL(v)}</td>)}
            <td className="text-right text-primary">{formatBRL(totalGeral)}</td>
            <td className="text-right text-xs text-muted-foreground">
              {totalGeral && mesAtual ? formatBRL(totalGeral / mesAtual) : formatBRL(0)}
            </td>
            <td className="text-right text-xs font-semibold">100%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

