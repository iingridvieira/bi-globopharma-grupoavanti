import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, MESES_BR } from "@/lib/format";
import { Send, CheckCircle2, Clock, Users, Send as SendIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/imec/")({
  head: () => ({
    meta: [
      { title: "BI IMEC" },
      { name: "description", content: "Dashboard executivo do BI IMEC." },
    ],
  }),
  component: ImecDashboard,
});

const now = new Date();
const ANO_ATUAL = now.getFullYear();
const MES_ATUAL = now.getMonth() + 1;

function ImecDashboard() {
  const [ANO, setAno] = useState(ANO_ATUAL);
  const [MES, setMes] = useState(MES_ATUAL);

  const { data, isLoading } = useQuery({
    queryKey: ["imec-dashboard", ANO, MES],
    queryFn: async () => {
      const start = `${ANO}-${String(MES).padStart(2, "0")}-01`;
      const endDate = new Date(ANO, MES, 0).toISOString().slice(0, 10);

      const { data: pedidos, error } = await supabase
        .from("imec_pedidos_enviados")
        .select("cliente_id,valor,status,imec_clientes(nome)")
        .gte("data", start)
        .lte("data", endDate);
      if (error) throw error;

      const map = new Map<
        string,
        {
          id: string;
          nome: string;
          total: number;
          aprovado: number;
          aguardando: number;
          pedidos: number;
        }
      >();
      (pedidos ?? []).forEach((p) => {
        const nome = p.imec_clientes?.nome ?? "—";
        const row = map.get(p.cliente_id) ?? {
          id: p.cliente_id,
          nome,
          total: 0,
          aprovado: 0,
          aguardando: 0,
          pedidos: 0,
        };
        row.total += Number(p.valor);
        row.pedidos += 1;
        if (p.status === "aprovado") row.aprovado += Number(p.valor);
        else row.aguardando += Number(p.valor);
        map.set(p.cliente_id, row);
      });

      const rows = Array.from(map.values()).sort((a, b) => b.total - a.total);
      const totals = rows.reduce(
        (a, r) => ({
          total: a.total + r.total,
          aprovado: a.aprovado + r.aprovado,
          aguardando: a.aguardando + r.aguardando,
          pedidos: a.pedidos + r.pedidos,
        }),
        { total: 0, aprovado: 0, aguardando: 0, pedidos: 0 },
      );

      return { rows, totals };
    },
  });

  const t = data?.totals ?? { total: 0, aprovado: 0, aguardando: 0, pedidos: 0 };

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <header className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <div className="bi-stat-label">
            Mês de referência · {String(MES).padStart(2, "0")}/{ANO}
          </div>
          <h1 className="font-display text-3xl font-bold mt-1">Dashboard BI IMEC</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/imec/pedidos"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90"
          >
            <SendIcon className="h-4 w-4" /> Pedidos Enviados
          </Link>
          <select
            className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
            value={MES}
            onChange={(e) => setMes(Number(e.target.value))}
            aria-label="Mês"
          >
            {MESES_BR.map((nome, i) => (
              <option key={i + 1} value={i + 1}>
                {nome}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
            value={ANO}
            onChange={(e) => setAno(Number(e.target.value))}
            aria-label="Ano"
          >
            {Array.from({ length: 5 }, (_, i) => ANO_ATUAL - 2 + i).map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total enviado" value={formatBRL(t.total)} icon={Send} accent />
        <StatCard label="Pedidos no mês" value={String(t.pedidos)} icon={Users} />
        <StatCard label="Aprovado" value={formatBRL(t.aprovado)} icon={CheckCircle2} />
        <StatCard label="Aguardando" value={formatBRL(t.aguardando)} icon={Clock} />
      </section>

      <section className="bi-card overflow-hidden mb-8">
        <header className="px-6 py-4 border-b border-border">
          <h2 className="font-display text-lg font-semibold">Resumo por cliente</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pedidos enviados no mês, separados por status de aprovação.
          </p>
        </header>
        <div className="overflow-x-auto">
          <table className="bi-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th className="text-right">Pedidos</th>
                <th className="text-right">Aprovado</th>
                <th className="text-right">Aguardando</th>
                <th className="text-right">Total enviado</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={5} className="text-center text-muted-foreground py-10">
                    Carregando…
                  </td>
                </tr>
              )}
              {!isLoading && (data?.rows.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-muted-foreground py-10">
                    Nenhum pedido cadastrado neste mês.
                  </td>
                </tr>
              )}
              {data?.rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">{r.nome}</td>
                  <td className="text-right tabular-nums">{r.pedidos}</td>
                  <td className="text-right tabular-nums text-emerald-500">
                    {r.aprovado > 0 ? formatBRL(r.aprovado) : "—"}
                  </td>
                  <td className="text-right tabular-nums text-warning">
                    {r.aguardando > 0 ? formatBRL(r.aguardando) : "—"}
                  </td>
                  <td className="text-right tabular-nums font-semibold">{formatBRL(r.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>TOTAL GERAL</td>
                <td className="text-right tabular-nums">{t.pedidos}</td>
                <td className="text-right tabular-nums">{formatBRL(t.aprovado)}</td>
                <td className="text-right tabular-nums">{formatBRL(t.aguardando)}</td>
                <td className="text-right tabular-nums text-primary">{formatBRL(t.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  accent?: boolean;
}) {
  return (
    <div className={(accent ? "bi-card-accent" : "bi-card") + " p-5"}>
      <div className="flex items-start justify-between">
        <div className={accent ? "text-primary-foreground/80 bi-stat-label" : "bi-stat-label"}>
          {label}
        </div>
        <Icon
          className={"h-5 w-5 " + (accent ? "text-primary-foreground/80" : "text-primary")}
          strokeWidth={2}
        />
      </div>
      <div className="bi-stat-value mt-3 text-3xl">{value}</div>
    </div>
  );
}
