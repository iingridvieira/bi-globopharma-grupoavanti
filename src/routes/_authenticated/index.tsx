import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import { Target, Send, FileCheck, TrendingDown, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/")({
  component: Dashboard,
});

const now = new Date();
const ANO = now.getFullYear();
const MES = now.getMonth() + 1;

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", ANO, MES],
    queryFn: async () => {
      const start = `${ANO}-${String(MES).padStart(2, "0")}-01`;
      const endDate = new Date(ANO, MES, 0).toISOString().slice(0, 10);

      const [clientes, metas, pedidos, nfs] = await Promise.all([
        supabase.from("clientes").select("id,nome").order("nome"),
        supabase.from("metas_mensais").select("cliente_id,valor,pendencia_inicial").eq("ano", ANO).eq("mes", MES),
        supabase.from("pedidos_enviados").select("cliente_id,valor").gte("data", start).lte("data", endDate),
        supabase.from("notas_fiscais").select("cliente_id,valor").gte("data", start).lte("data", endDate),
      ]);

      const map = new Map<string, { nome: string; pendInicial: number; enviado: number; meta: number; faturado: number }>();
      (clientes.data ?? []).forEach((c) => map.set(c.id, { nome: c.nome, pendInicial: 0, enviado: 0, meta: 0, faturado: 0 }));
      (metas.data ?? []).forEach((m) => {
        const r = map.get(m.cliente_id); if (!r) return;
        r.meta = Number(m.valor); r.pendInicial = Number(m.pendencia_inicial);
      });
      (pedidos.data ?? []).forEach((p) => { const r = map.get(p.cliente_id); if (r) r.enviado += Number(p.valor); });
      (nfs.data ?? []).forEach((n) => { const r = map.get(n.cliente_id); if (r) r.faturado += Number(n.valor); });

      const rows = Array.from(map.values()).map((r) => ({ ...r, pendFinal: r.meta - r.faturado }));
      const totals = rows.reduce((a, r) => ({
        meta: a.meta + r.meta, enviado: a.enviado + r.enviado, faturado: a.faturado + r.faturado,
        pendInicial: a.pendInicial + r.pendInicial, pendFinal: a.pendFinal + r.pendFinal,
      }), { meta: 0, enviado: 0, faturado: 0, pendInicial: 0, pendFinal: 0 });

      return { rows, totals };
    },
  });

  const t = data?.totals ?? { meta: 0, enviado: 0, faturado: 0, pendInicial: 0, pendFinal: 0 };
  const gap = t.meta - t.faturado;
  const pctFat = t.meta > 0 ? (t.faturado / t.meta) * 100 : 0;

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <header className="flex items-end justify-between mb-8">
        <div>
          <div className="bi-stat-label">Mês de referência · {String(MES).padStart(2, "0")}/{ANO}</div>
          <h1 className="font-display text-3xl font-bold mt-1">Dashboard Executivo</h1>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard label="Meta do mês" value={formatBRL(t.meta)} icon={Target} accent />
        <StatCard label="Pedidos enviados" value={formatBRL(t.enviado)} icon={Send} />
        <StatCard label="Pedidos faturados" value={formatBRL(t.faturado)} icon={FileCheck} sub={`${pctFat.toFixed(1).replace(".", ",")}% da meta`} />
        <StatCard label="GAP (Meta - Faturado)" value={formatBRL(gap)} icon={TrendingDown} negative={gap > 0} />
      </section>

      <section className="bi-card overflow-hidden mb-8">
        <header className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold">Resumo por cliente</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Pendência inicial · Enviado · Meta · Faturado · Pendência final</p>
          </div>
        </header>
        <div className="overflow-x-auto">
          <table className="bi-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th className="text-right">Pend. Inicial</th>
                <th className="text-right">Enviado</th>
                <th className="text-right">Meta</th>
                <th className="text-right">Faturado</th>
                <th className="text-right">Pend. Final</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-10">Carregando…</td></tr>
              )}
              {data?.rows.map((r) => (
                <tr key={r.nome}>
                  <td className="font-medium">{r.nome}</td>
                  <td className="text-right tabular-nums">{formatBRL(r.pendInicial)}</td>
                  <td className="text-right tabular-nums">{formatBRL(r.enviado)}</td>
                  <td className="text-right tabular-nums">{formatBRL(r.meta)}</td>
                  <td className="text-right tabular-nums">{formatBRL(r.faturado)}</td>
                  <td className={"text-right tabular-nums font-semibold " + (r.pendFinal > 0 ? "text-warning" : "text-success")}>
                    {formatBRL(r.pendFinal)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>TOTAL GERAL</td>
                <td className="text-right tabular-nums">{formatBRL(t.pendInicial)}</td>
                <td className="text-right tabular-nums">{formatBRL(t.enviado)}</td>
                <td className="text-right tabular-nums">{formatBRL(t.meta)}</td>
                <td className="text-right tabular-nums">{formatBRL(t.faturado)}</td>
                <td className="text-right tabular-nums text-primary">{formatBRL(t.pendFinal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <BigButton to="/sell-in" title="Sell in" desc="Tabela dinâmica · mês a mês · acumulado" />
        <BigButton to="/sell-out" title="Sell Out" desc="Detalhe por cliente · mapas de vendas" />
      </section>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, accent, sub, negative }: {
  label: string; value: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  accent?: boolean; sub?: string; negative?: boolean;
}) {
  return (
    <div className={accent ? "bi-card-accent p-5" : "bi-card p-5"}>
      <div className="flex items-start justify-between">
        <div className={accent ? "text-primary-foreground/80 bi-stat-label" : "bi-stat-label"}>{label}</div>
        <Icon className={"h-5 w-5 " + (accent ? "text-primary-foreground/80" : "text-primary")} strokeWidth={2} />
      </div>
      <div className={"bi-stat-value mt-3 text-3xl " + (negative ? "text-warning" : "")}>{value}</div>
      {sub && <div className={"text-xs mt-1 " + (accent ? "text-primary-foreground/75" : "text-muted-foreground")}>{sub}</div>}
    </div>
  );
}

function BigButton({ to, title, desc }: { to: string; title: string; desc: string }) {
  return (
    <Link to={to} className="bi-card p-6 group hover:border-primary transition-colors flex items-center justify-between">
      <div>
        <div className="font-display text-xl font-bold">{title}</div>
        <div className="text-sm text-muted-foreground mt-1">{desc}</div>
      </div>
      <div className="h-12 w-12 rounded-md bg-primary/15 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
        <ArrowRight className="h-5 w-5" />
      </div>
    </Link>
  );
}
