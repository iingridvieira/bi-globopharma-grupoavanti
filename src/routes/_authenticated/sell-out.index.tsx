import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, MESES_BR_SHORT } from "@/lib/format";
import { useState } from "react";
import { exportToExcel } from "@/lib/excel";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sell-out/")({ component: SellOutPage });

function SellOutPage() {
  const [ano, setAno] = useState(new Date().getFullYear());

  const { data } = useQuery({
    queryKey: ["sell-out-consolidado", ano],
    queryFn: async () => {
      const [clientes, sellOut] = await Promise.all([
        supabase.from("clientes").select("id,nome").order("nome"),
        supabase.from("sell_out").select("cliente_id,mes,valor").eq("ano", ano),
      ]);
      const matrix = new Map<string, { nome: string; meses: number[]; total: number }>();
      (clientes.data ?? []).forEach((c) => matrix.set(c.id, { nome: c.nome, meses: Array(12).fill(0), total: 0 }));
      (sellOut.data ?? []).forEach((s) => {
        const r = matrix.get(s.cliente_id); if (!r) return;
        r.meses[s.mes - 1] = Number(s.valor); r.total += Number(s.valor);
      });
      const rows = Array.from(matrix.values()).filter((r) => r.total > 0);
      const totaisMes = Array(12).fill(0);
      rows.forEach((r) => r.meses.forEach((v, i) => (totaisMes[i] += v)));
      const totalGeral = totaisMes.reduce((a, b) => a + b, 0);
      return { rows, totaisMes, totalGeral };
    },
  });

  function handleExport() {
    if (!data) return;
    const rows = data.rows.map((r) => {
      const o: Record<string, unknown> = { Cliente: r.nome };
      MESES_BR_SHORT.forEach((m, i) => (o[m] = r.meses[i]));
      o.Total = r.total;
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

      <div className="bi-card overflow-x-auto">
        <table className="bi-table">
          <thead>
            <tr>
              <th>Cliente</th>
              {MESES_BR_SHORT.map((m) => <th key={m} className="text-right">{m}</th>)}
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {data?.rows.map((r) => (
              <tr key={r.nome}>
                <td className="font-medium">{r.nome}</td>
                {r.meses.map((v, i) => <td key={i} className="text-right tabular-nums text-xs">{v ? formatBRL(v) : "—"}</td>)}
                <td className="text-right tabular-nums font-semibold text-primary">{formatBRL(r.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>TOTAL</td>
              {data?.totaisMes.map((v, i) => <td key={i} className="text-right text-xs">{formatBRL(v)}</td>)}
              <td className="text-right text-primary">{formatBRL(data?.totalGeral ?? 0)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
