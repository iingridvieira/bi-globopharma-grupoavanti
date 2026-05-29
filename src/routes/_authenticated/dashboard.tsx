import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, parseBRNumber } from "@/lib/format";
import { Target, Send, FileCheck, TrendingDown, ArrowRight, Trophy, Sparkles, Pencil, Check, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const now = new Date();
const ANO = now.getFullYear();
const MES = now.getMonth() + 1;

function Dashboard() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", ANO, MES],
    queryFn: async () => {
      const start = `${ANO}-${String(MES).padStart(2, "0")}-01`;
      const endDate = new Date(ANO, MES, 0).toISOString().slice(0, 10);

      const [clientes, metas, pedidos, nfs, pendencias, metaGlobo] = await Promise.all([
        supabase.from("clientes").select("id,nome").order("nome"),
        supabase.from("metas_mensais").select("cliente_id,valor").eq("ano", ANO).eq("mes", MES),
        supabase.from("pedidos_enviados").select("cliente_id,valor").gte("data", start).lte("data", endDate),
        supabase.from("notas_fiscais").select("cliente_id,valor").gte("data", start).lte("data", endDate),
        supabase.from("pendencias_produtos").select("cliente_id,valor"),
        supabase.from("metas_globo").select("valor").eq("ano", ANO).eq("mes", MES).maybeSingle(),
      ]);

      const map = new Map<string, { nome: string; pendencia: number; enviado: number; meta: number; faturado: number }>();
      (clientes.data ?? []).forEach((c) => map.set(c.id, { nome: c.nome, pendencia: 0, enviado: 0, meta: 0, faturado: 0 }));
      (metas.data ?? []).forEach((m) => { const r = map.get(m.cliente_id); if (r) r.meta = Number(m.valor); });
      (pedidos.data ?? []).forEach((p) => { const r = map.get(p.cliente_id); if (r) r.enviado += Number(p.valor); });
      (nfs.data ?? []).forEach((n) => { const r = map.get(n.cliente_id); if (r) r.faturado += Number(n.valor); });
      (pendencias.data ?? []).forEach((p) => { const r = map.get(p.cliente_id); if (r) r.pendencia += Number(p.valor); });

      const rows = Array.from(map.values()).filter((r) => r.meta > 0 || r.faturado > 0 || r.enviado > 0 || r.pendencia > 0);
      const totals = rows.reduce((a, r) => ({
        meta: a.meta + r.meta, enviado: a.enviado + r.enviado, faturado: a.faturado + r.faturado,
        pendencia: a.pendencia + r.pendencia,
      }), { meta: 0, enviado: 0, faturado: 0, pendencia: 0 });

      return { rows, totals, metaGlobo: Number(metaGlobo.data?.valor ?? 0) };
    },
  });

  const t = data?.totals ?? { meta: 0, enviado: 0, faturado: 0, pendencia: 0 };
  const metaGlobo = data?.metaGlobo ?? 0;
  const metaAvanti = metaGlobo * 1.2;
  const gap = t.meta - t.faturado;
  const pctFat = t.meta > 0 ? (t.faturado / t.meta) * 100 : 0;
  const pctGlobo = metaGlobo > 0 ? (t.faturado / metaGlobo) * 100 : 0;
  const pctAvanti = metaAvanti > 0 ? (t.faturado / metaAvanti) * 100 : 0;
  const pctProjecao = t.meta > 0 ? (t.faturado / t.meta) * 100 : 0;

  async function saveMetaGlobo(valor: number) {
    const { error } = await supabase
      .from("metas_globo")
      .upsert({ ano: ANO, mes: MES, valor }, { onConflict: "ano,mes" });
    if (error) {
      toast.error("Erro ao salvar meta: " + error.message);
      return false;
    }
    toast.success("Meta Globo atualizada");
    await queryClient.invalidateQueries({ queryKey: ["dashboard", ANO, MES] });
    return true;
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <header className="flex items-end justify-between mb-8">
        <div>
          <div className="bi-stat-label">Mês de referência · {String(MES).padStart(2, "0")}/{ANO}</div>
          <h1 className="font-display text-3xl font-bold mt-1">Dashboard Executivo</h1>
        </div>
      </header>

      {/* Metas executivas */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <MetaCard
          label="META MENSAL GLOBO"
          value={metaGlobo}
          pct={pctGlobo}
          faturado={t.faturado}
          icon={Trophy}
          editable={isAdmin}
          onSave={saveMetaGlobo}
          accent
        />
        <MetaCard
          label="META AVANTI"
          value={metaAvanti}
          pct={pctAvanti}
          faturado={t.faturado}
          icon={Sparkles}
          sub="Meta Globo + 20%"
        />
        <MetaCard
          label="PREVISÃO DE SELL IN"
          value={t.meta}
          pct={pctProjecao}
          faturado={t.faturado}
          icon={Target}
        />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard label="Pedidos enviados" value={formatBRL(t.enviado)} icon={Send} />
        <StatCard label="Pedidos faturados" value={formatBRL(t.faturado)} icon={FileCheck} sub={`${pctFat.toFixed(1).replace(".", ",")}% da projeção`} />
        <StatCard label="GAP (Projeção - Faturado)" value={formatBRL(gap)} icon={TrendingDown} negative={gap > 0} />
      </section>

      <section className="bi-card overflow-hidden mb-8">
        <header className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold">Resumo por cliente</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Enviado · Projeção · Faturado · Pendência (importada)</p>
          </div>
        </header>
        <div className="overflow-x-auto">
          <table className="bi-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th className="text-right">Enviado</th>
                <th className="text-right">Projeção</th>
                <th className="text-right">Faturado</th>
                <th className="text-right">Pendência</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={5} className="text-center text-muted-foreground py-10">Carregando…</td></tr>
              )}
              {data?.rows.map((r) => (
                <tr key={r.nome}>
                  <td className="font-medium">{r.nome}</td>
                  <td className="text-right tabular-nums">{formatBRL(r.enviado)}</td>
                  <td className="text-right tabular-nums">{formatBRL(r.meta)}</td>
                  <td className="text-right tabular-nums">{formatBRL(r.faturado)}</td>
                  <td className={"text-right tabular-nums font-semibold " + (r.pendencia > 0 ? "text-warning" : "text-muted-foreground")}>
                    {r.pendencia > 0 ? formatBRL(r.pendencia) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>TOTAL GERAL</td>
                <td className="text-right tabular-nums">{formatBRL(t.enviado)}</td>
                <td className="text-right tabular-nums">{formatBRL(t.meta)}</td>
                <td className="text-right tabular-nums">{formatBRL(t.faturado)}</td>
                <td className="text-right tabular-nums text-primary">{formatBRL(t.pendencia)}</td>
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

function MetaCard({
  label, value, pct, faturado, icon: Icon, accent, sub, editable, onSave,
}: {
  label: string;
  value: number;
  pct: number;
  faturado: number;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  accent?: boolean;
  sub?: string;
  editable?: boolean;
  onSave?: (v: number) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const pctStr = `${pct.toFixed(1).replace(".", ",")}% atingido`;
  const pctColor = pct >= 100 ? "text-emerald-500" : pct >= 70 ? "text-primary" : "text-warning";

  async function handleSave() {
    if (!onSave) return;
    setSaving(true);
    const ok = await onSave(parseBRNumber(draft));
    setSaving(false);
    if (ok) setEditing(false);
  }

  return (
    <div className={accent ? "bi-card-accent p-5 relative" : "bi-card p-5 relative"}>
      <div className="flex items-start justify-between">
        <div className={accent ? "text-primary-foreground/80 bi-stat-label" : "bi-stat-label"}>{label}</div>
        <Icon className={"h-5 w-5 " + (accent ? "text-primary-foreground/80" : "text-primary")} strokeWidth={2} />
      </div>

      {editing ? (
        <div className="mt-3 flex items-center gap-2">
          <input
            autoFocus
            className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-lg font-bold text-foreground tabular-nums focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="0,00"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleSave(); if (e.key === "Escape") setEditing(false); }}
          />
          <button
            className="p-1.5 rounded-md bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30 disabled:opacity-50"
            onClick={() => void handleSave()}
            disabled={saving}
            aria-label="Salvar"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            className="p-1.5 rounded-md bg-muted text-muted-foreground hover:bg-muted/80"
            onClick={() => setEditing(false)}
            aria-label="Cancelar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <div className="bi-stat-value text-3xl">{formatBRL(value)}</div>
          {editable && (
            <button
              className={"p-1.5 rounded-md transition-colors " + (accent ? "text-primary-foreground/70 hover:bg-primary-foreground/10" : "text-muted-foreground hover:bg-muted")}
              onClick={() => { setDraft(value > 0 ? String(value).replace(".", ",") : ""); setEditing(true); }}
              aria-label="Editar"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      <div className={"text-xs mt-2 font-medium " + (accent ? "text-primary-foreground/90" : pctColor)}>
        {value > 0 ? pctStr : "Sem meta definida"}
      </div>
      {sub && (
        <div className={"text-[10px] mt-0.5 " + (accent ? "text-primary-foreground/70" : "text-muted-foreground")}>{sub}</div>
      )}
      {value > 0 && (
        <div className={"mt-2 text-[10px] " + (accent ? "text-primary-foreground/60" : "text-muted-foreground")}>
          Faturado: {formatBRL(faturado)}
        </div>
      )}
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
