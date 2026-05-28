import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, MESES_BR_SHORT } from "@/lib/format";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { exportToExcel } from "@/lib/excel";
import { Download, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/por-clientes/")({ component: PorClientesIndex });

const CLIENTES_PERMITIDOS = new Set([
  "ANDORINHA", "CAMPEÃ", "CG MEDICAMENTOS", "DF COMERCIAL", "DISMAP",
  "JK MEDICAMENTOS", "MAXIFARMA", "MEDSOL", "MILFARMA",
  "NAVARRO INTER", "NAVARRO SP", "NÚCLEO FARMA",
].map((s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()));

function isClientePermitido(nome: string): boolean {
  return CLIENTES_PERMITIDOS.has(nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase());
}

type CellKey = string; // `${cliente_id}|${mes}`

function PorClientesIndex() {
  const { canEdit } = useAuth();
  const qc = useQueryClient();
  const [ano, setAno] = useState(new Date().getFullYear());
  const [edits, setEdits] = useState<Record<CellKey, string>>({});

  const { data } = useQuery({
    queryKey: ["por-clientes-matrix", ano],
    queryFn: async () => {
      const [clientes, sellIn] = await Promise.all([
        supabase.from("clientes").select("id,nome").order("nome"),
        supabase.from("sell_in").select("cliente_id,mes,valor").eq("ano", ano),
      ]);
      const matrix = new Map<string, { id: string; nome: string; meses: number[]; total: number }>();
      (clientes.data ?? []).forEach((c) => matrix.set(c.id, { id: c.id, nome: c.nome, meses: Array(12).fill(0), total: 0 }));
      (sellIn.data ?? []).forEach((s) => {
        const r = matrix.get(s.cliente_id); if (!r) return;
        r.meses[s.mes - 1] = Number(s.valor); r.total += Number(s.valor);
      });
      return Array.from(matrix.values());
    },
  });

  useEffect(() => { setEdits({}); }, [ano, data]);

  const saveCell = useMutation({
    mutationFn: async (v: { cliente_id: string; mes: number; valor: number }) => {
      const { error } = await supabase.from("sell_in").upsert(
        { cliente_id: v.cliente_id, ano, mes: v.mes, valor: v.valor },
        { onConflict: "cliente_id,ano,mes" },
      );
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Valor atualizado"); void qc.invalidateQueries({ queryKey: ["por-clientes-matrix", ano] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  function commit(cliente_id: string, mes: number, original: number) {
    const key = `${cliente_id}|${mes}`;
    const raw = edits[key];
    if (raw === undefined) return;
    const parsed = Number(raw.replace(/\./g, "").replace(",", ".")) || 0;
    if (parsed === original) { setEdits((e) => { const c = { ...e }; delete c[key]; return c; }); return; }
    saveCell.mutate({ cliente_id, mes, valor: parsed });
  }

  const totaisMes = useMemo(() => {
    const t = Array(12).fill(0);
    (data ?? []).forEach((r) => r.meses.forEach((v, i) => (t[i] += v)));
    return t;
  }, [data]);
  const totalGeral = totaisMes.reduce((a, b) => a + b, 0);

  function handleExport() {
    if (!data) return;
    const rows = data.map((r) => {
      const o: Record<string, unknown> = { Cliente: r.nome };
      MESES_BR_SHORT.forEach((m, i) => (o[m] = r.meses[i]));
      o.Total = r.total;
      return o;
    });
    exportToExcel(rows, `por-clientes-${ano}.xlsx`, "Por Clientes");
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <header className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="bi-stat-label">Operação</div>
          <h1 className="font-display text-3xl font-bold mt-1 flex items-center gap-2">
            <Users className="h-7 w-7 text-primary" /> Por Clientes · {ano}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tabela editável manualmente. Clique no nome do cliente para ver Sell In, Sell Out e Mapas de Vendas.
          </p>
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
            {(data ?? []).map((r) => (
              <tr key={r.id}>
                <td className="font-medium">
                  <Link to="/por-clientes/$clienteId" params={{ clienteId: r.id }} className="hover:text-primary">
                    {r.nome}
                  </Link>
                </td>
                {r.meses.map((v, i) => {
                  const key = `${r.id}|${i + 1}`;
                  const editing = edits[key] !== undefined;
                  if (!canEdit) {
                    return <td key={i} className="text-right tabular-nums text-xs">{v ? formatBRL(v) : "—"}</td>;
                  }
                  return (
                    <td key={i} className="text-right tabular-nums text-xs p-1">
                      <input
                        value={editing ? edits[key] : (v ? String(v).replace(".", ",") : "")}
                        onChange={(e) => setEdits((p) => ({ ...p, [key]: e.target.value }))}
                        onBlur={() => commit(r.id, i + 1, v)}
                        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                        placeholder="—"
                        className="w-24 text-right bg-transparent border border-transparent hover:border-border focus:border-primary focus:bg-input rounded px-1.5 py-1 outline-none tabular-nums"
                      />
                    </td>
                  );
                })}
                <td className="text-right tabular-nums font-semibold text-primary">{formatBRL(r.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>TOTAL</td>
              {totaisMes.map((v, i) => <td key={i} className="text-right text-xs">{formatBRL(v)}</td>)}
              <td className="text-right text-primary">{formatBRL(totalGeral)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
