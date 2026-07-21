import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { forwardRef, useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatBRLSmart, parseBRNumber } from "@/lib/format";
import { Target, Send, FileCheck, TrendingDown, Trophy, Sparkles, Pencil, Check, X, Table2, ImageDown } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const now = new Date();
const ANO_ATUAL = now.getFullYear();
const MES_ATUAL = now.getMonth() + 1;
const MESES_BR = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function Dashboard() {
  const { isAdmin, restrictedClientes } = useAuth();
  const queryClient = useQueryClient();
  const shareRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [ANO, setAno] = useState(ANO_ATUAL);
  const [MES, setMes] = useState(MES_ATUAL);
  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
  const allowedSet = restrictedClientes ? new Set(restrictedClientes.map(norm)) : null;

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", ANO, MES, restrictedClientes?.join("|") ?? "all"],
    queryFn: async () => {
      const start = `${ANO}-${String(MES).padStart(2, "0")}-01`;
      const endDate = new Date(ANO, MES, 0).toISOString().slice(0, 10);

      const [clientes, metas, pedidos, nfs, pendencias, pendAnt, metaGlobo] = await Promise.all([
        supabase.from("clientes").select("id,nome").order("nome"),
        supabase.from("metas_mensais").select("cliente_id,valor").eq("ano", ANO).eq("mes", MES),
        supabase.from("pedidos_enviados").select("cliente_id,valor").gte("data", start).lte("data", endDate),
        supabase.from("notas_fiscais").select("cliente_id,valor").gte("data", start).lte("data", endDate),
        supabase.from("pendencias_produtos").select("cliente_id,valor"),
        (supabase.from("pendencias_anteriores_produtos").select("cliente_id,valor") as unknown as { eq: (c: string, v: number) => { eq: (c: string, v: number) => Promise<{ data: { cliente_id: string; valor: number }[] | null }> } }).eq("ano", ANO).eq("mes", MES),
        supabase.from("metas_globo").select("valor").eq("ano", ANO).eq("mes", MES).maybeSingle(),
      ]);

      const clientesFiltrados = allowedSet
        ? (clientes.data ?? []).filter((c) => allowedSet.has(norm(c.nome)))
        : (clientes.data ?? []);

      const map = new Map<string, { nome: string; pendencia: number; pendAnt: number; enviado: number; meta: number; faturado: number }>();
      clientesFiltrados.forEach((c) => map.set(c.id, { nome: c.nome, pendencia: 0, pendAnt: 0, enviado: 0, meta: 0, faturado: 0 }));
      (metas.data ?? []).forEach((m) => { const r = map.get(m.cliente_id); if (r) r.meta = Number(m.valor); });
      (pedidos.data ?? []).forEach((p) => { const r = map.get(p.cliente_id); if (r) r.enviado += Number(p.valor); });
      (nfs.data ?? []).forEach((n) => { const r = map.get(n.cliente_id); if (r) r.faturado += Number(n.valor); });
      (pendencias.data ?? []).forEach((p) => { const r = map.get(p.cliente_id); if (r) r.pendencia += Number(p.valor); });
      (pendAnt.data ?? []).forEach((p) => { const r = map.get(p.cliente_id); if (r) r.pendAnt += Number(p.valor); });

      const rows = Array.from(map.values()).filter((r) => r.meta > 0 || r.faturado > 0 || r.enviado > 0 || r.pendencia > 0 || r.pendAnt > 0);
      const totals = rows.reduce((a, r) => ({
        meta: a.meta + r.meta, enviado: a.enviado + r.enviado, faturado: a.faturado + r.faturado,
        pendencia: a.pendencia + r.pendencia, pendAnt: a.pendAnt + r.pendAnt,
      }), { meta: 0, enviado: 0, faturado: 0, pendencia: 0, pendAnt: 0 });

      return { rows, totals, metaGlobo: Number(metaGlobo.data?.valor ?? 0) };
    },
  });

  const t = data?.totals ?? { meta: 0, enviado: 0, faturado: 0, pendencia: 0, pendAnt: 0 };
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

  async function exportarPNG() {
    if (!shareRef.current) return;
    setExporting(true);
    try {
      // Wait a frame so the off-screen card is fully laid out
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const dataUrl = await toPng(shareRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#0E0F0C",
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `dashboard-${String(MES).padStart(2, "0")}-${ANO}.png`;
      a.click();
      toast.success("Imagem gerada");
    } catch (e) {
      toast.error("Erro ao gerar imagem: " + (e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <header className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <div className="bi-stat-label">Mês de referência · {String(MES).padStart(2, "0")}/{ANO}</div>
          <h1 className="font-display text-3xl font-bold mt-1">Dashboard Executivo</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void exportarPNG()}
            disabled={exporting || isLoading}
            className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/20 disabled:opacity-50"
            title="Exportar imagem do mês (PNG) para WhatsApp"
          >
            <ImageDown className="h-4 w-4" /> {exporting ? "Gerando…" : "Exportar PNG"}
          </button>
          <Link
            to="/consolidado"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90"
          >
            <Table2 className="h-4 w-4" /> Consolidado
          </Link>
          <select
            className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
            value={MES}
            onChange={(e) => setMes(Number(e.target.value))}
            aria-label="Mês"
          >
            {MESES_BR.map((nome, i) => (
              <option key={i + 1} value={i + 1}>{nome}</option>
            ))}
          </select>
          <select
            className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
            value={ANO}
            onChange={(e) => setAno(Number(e.target.value))}
            aria-label="Ano"
          >
            {Array.from({ length: 5 }, (_, i) => ANO_ATUAL - 2 + i).map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
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
        <StatCard label="Pedidos enviados" value={formatBRL(t.enviado)} icon={Send} pct={t.meta > 0 ? (t.enviado / t.meta) * 100 : undefined} sub={t.meta > 0 ? `${((t.enviado / t.meta) * 100).toFixed(1).replace(".", ",")}% da previsão` : undefined} />
        <StatCard label="Pedidos faturados" value={formatBRL(t.faturado)} icon={FileCheck} sub={`${pctFat.toFixed(1).replace(".", ",")}% da previsão`} accent />
        <StatCard label="GAP (Previsão - Faturado)" value={formatBRL(gap)} icon={TrendingDown} negative={gap > 0} />
      </section>

      <section className="bi-card overflow-hidden mb-8">
        <header className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold">Resumo por cliente</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Pend. Anterior · Enviado · Pend Ant. + Enviado · Previsão · Faturado (% meta) · Pendência</p>
          </div>
        </header>
        <div className="overflow-x-auto">
          <table className="bi-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th className="text-right">Pendência Anterior</th>
                <th className="text-right">Enviado</th>
                <th className="text-right">Pend Ant. + Enviado</th>
                <th className="text-right">Previsão</th>
                <th className="text-right">Faturado</th>
                <th className="text-right">Pendência</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={7} className="text-center text-muted-foreground py-10">Carregando…</td></tr>
              )}
              {data?.rows.map((r) => {
                const pctCliente = r.meta > 0 ? (r.faturado / r.meta) * 100 : 0;
                const pctColor = pctCliente >= 100 ? "text-emerald-500" : pctCliente >= 70 ? "text-primary" : "text-warning";
                return (
                  <tr key={r.nome}>
                    <td className="font-medium">{r.nome}</td>
                    <td className="text-right tabular-nums">{r.pendAnt > 0 ? formatBRL(r.pendAnt) : "—"}</td>
                    <td className="text-right tabular-nums">{formatBRL(r.enviado)}</td>
                    <td className="text-right tabular-nums font-medium">{formatBRL(r.pendAnt + r.enviado)}</td>
                    <td className="text-right tabular-nums">{formatBRL(r.meta)}</td>
                    <td className="text-right tabular-nums">
                      <div>{formatBRL(r.faturado)}</div>
                      {r.meta > 0 && (
                        <div className={"text-[10px] font-semibold mt-0.5 " + pctColor}>
                          {pctCliente.toFixed(1).replace(".", ",")}%
                        </div>
                      )}
                    </td>
                    <td className={"text-right tabular-nums font-semibold " + (r.pendencia > 0 ? "text-warning" : "text-muted-foreground")}>
                      {r.pendencia > 0 ? formatBRL(r.pendencia) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>TOTAL GERAL</td>
                <td className="text-right tabular-nums">{formatBRL(t.pendAnt)}</td>
                <td className="text-right tabular-nums">{formatBRL(t.enviado)}</td>
                <td className="text-right tabular-nums">{formatBRL(t.pendAnt + t.enviado)}</td>
                <td className="text-right tabular-nums">{formatBRL(t.meta)}</td>
                <td className="text-right tabular-nums">{formatBRL(t.faturado)}</td>
                <td className="text-right tabular-nums text-primary">{formatBRL(t.pendencia)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Off-screen share card for PNG export (WhatsApp) */}
      <div style={{ position: "fixed", left: "-10000px", top: 0, pointerEvents: "none" }} aria-hidden>
        <ShareCard
          ref={shareRef}
          mes={MES}
          ano={ANO}
          metaGlobo={metaGlobo}
          metaAvanti={metaAvanti}
          previsao={t.meta}
          enviado={t.enviado}
          faturado={t.faturado}
          pendencia={t.pendencia}
          pendAnt={t.pendAnt}
          gap={gap}
          pctGlobo={pctGlobo}
          pctAvanti={pctAvanti}
          pctProjecao={pctProjecao}
          rows={data?.rows ?? []}
        />
      </div>
    </div>
  );
}

function CardFill({ pct }: { pct: number }) {
  const [w, setW] = useState(0);
  const clamped = Math.max(0, Math.min(100, pct));
  useEffect(() => {
    const id = requestAnimationFrame(() => setW(clamped));
    return () => cancelAnimationFrame(id);
  }, [clamped]);
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
    >
      {/* Área não atingida — laranja com opacidade reduzida */}
      <div className="absolute inset-0 bg-primary/10" />
      {/* Área atingida — laranja sólido, com animação suave */}
      <div
        className="absolute inset-y-0 left-0 bg-primary/85"
        style={{ width: `${w}%`, transition: "width 900ms cubic-bezier(0.22, 1, 0.36, 1)" }}
      />
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
    <div className={"bi-card p-5 relative overflow-hidden " + (accent ? "ring-1 ring-primary/60" : "")}>
      {value > 0 && <CardFill pct={pct} />}
      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div className="bi-stat-label">{label}</div>
          <Icon className="h-5 w-5 text-primary" strokeWidth={2} />
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
            <div className="bi-stat-value text-3xl">{formatBRLSmart(value)}</div>
            {editable && (
              <button
                className="p-1.5 rounded-md transition-colors text-muted-foreground hover:bg-muted"
                onClick={() => { setDraft(value > 0 ? String(value).replace(".", ",") : ""); setEditing(true); }}
                aria-label="Editar"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        <div className={"text-xs mt-2 font-medium " + pctColor}>
          {value > 0 ? pctStr : "Sem meta definida"}
        </div>
        {sub && (
          <div className="text-[10px] mt-1 text-muted-foreground">{sub}</div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, accent, sub, negative, pct }: {
  label: string; value: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  accent?: boolean; sub?: string; negative?: boolean; pct?: number;
}) {
  const showFill = typeof pct === "number";
  return (
    <div className={(accent && !showFill ? "bi-card-accent" : "bi-card") + " p-5 relative overflow-hidden"}>
      {showFill && <CardFill pct={pct!} />}
      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div className={accent && !showFill ? "text-primary-foreground/80 bi-stat-label" : "bi-stat-label"}>{label}</div>
          <Icon className={"h-5 w-5 " + (accent && !showFill ? "text-primary-foreground/80" : "text-primary")} strokeWidth={2} />
        </div>
        <div className={"bi-stat-value mt-3 text-3xl " + (negative ? "text-warning" : "")}>{value}</div>
        {sub && <div className={"text-xs mt-1 " + (accent && !showFill ? "text-primary-foreground/75" : "text-muted-foreground")}>{sub}</div>}
      </div>
    </div>
  );
}

const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(function ShareCardImpl(props, ref) {
    const { mes, ano, metaGlobo, metaAvanti, previsao, enviado, faturado, pendencia, pendAnt, gap, pctGlobo, pctAvanti, pctProjecao, rows } = props;
    const mesNome = MESES_BR[mes - 1];
    const sorted = [...rows].sort((a, b) => b.faturado - a.faturado);
    const fmtPct = (p: number) => `${p.toFixed(1).replace(".", ",")}%`;
    const pctColor = (p: number) => p >= 100 ? "#10b981" : p >= 70 ? "#F26A1F" : "#eab308";
    return (
      <div
        ref={ref}
        style={{
          width: 1080,
          background: "linear-gradient(180deg, #0E0F0C 0%, #1A1D17 100%)",
          color: "#E5E7E1",
          fontFamily: "'Inter', system-ui, sans-serif",
          padding: 48,
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32, borderBottom: "2px solid #F26A1F", paddingBottom: 20 }}>
          <div>
            <div style={{ fontSize: 14, letterSpacing: 3, color: "#F26A1F", fontWeight: 700, textTransform: "uppercase" }}>BI Globo Pharma · Dashboard Executivo</div>
            <div style={{ fontSize: 44, fontWeight: 800, marginTop: 8, letterSpacing: -1 }}>{mesNome} <span style={{ color: "#F26A1F" }}>{ano}</span></div>
          </div>
          <div style={{ textAlign: "right", fontSize: 13, color: "#9ca39a" }}>
            <div>Gerado em</div>
            <div style={{ fontSize: 18, color: "#E5E7E1", fontWeight: 600 }}>{new Date().toLocaleDateString("pt-BR")}</div>
          </div>
        </div>

        {/* Metas */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
          {[
            { label: "META GLOBO", value: metaGlobo, pct: pctGlobo, accent: true },
            { label: "META AVANTI (+20%)", value: metaAvanti, pct: pctAvanti },
            { label: "PREVISÃO SELL IN", value: previsao, pct: pctProjecao },
          ].map((m) => {
            const clamped = Math.max(0, Math.min(100, m.pct));
            const barColor = m.accent ? "rgba(255,255,255,0.95)" : pctColor(m.pct);
            const trackBg = m.accent ? "rgba(255,255,255,0.25)" : "#3a3f34";
            return (
              <div key={m.label} style={{ background: m.accent ? "#F26A1F" : "#2A2E26", borderRadius: 8, padding: 20, border: m.accent ? "none" : "1px solid #3a3f34" }}>
                <div style={{ fontSize: 12, letterSpacing: 2, fontWeight: 700, color: m.accent ? "rgba(255,255,255,0.85)" : "#9ca39a" }}>{m.label}</div>
                <div style={{ fontSize: 30, fontWeight: 800, marginTop: 6, color: m.accent ? "#fff" : "#E5E7E1", fontVariantNumeric: "tabular-nums" }}>{formatBRLSmart(m.value)}</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4, color: m.accent ? "rgba(255,255,255,0.95)" : pctColor(m.pct) }}>{m.value > 0 ? `${fmtPct(m.pct)} atingido` : "Sem meta"}</div>
                {m.value > 0 && (
                  <div style={{ marginTop: 10, height: 8, width: "100%", borderRadius: 999, background: trackBg, overflow: "hidden" }}>
                    <div style={{ width: `${clamped}%`, height: "100%", background: barColor, borderRadius: 999 }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
          {[
            { label: "PEDIDOS ENVIADOS", value: enviado, color: "#E5E7E1", pct: previsao > 0 ? (enviado / previsao) * 100 : undefined },
            { label: "PEDIDOS FATURADOS", value: faturado, color: "#10b981", pct: previsao > 0 ? (faturado / previsao) * 100 : undefined },
            { label: "GAP (Previsão - Faturado)", value: gap, color: gap > 0 ? "#eab308" : "#10b981", pct: undefined as number | undefined },
          ].map((s) => {
            const clamped = typeof s.pct === "number" ? Math.max(0, Math.min(100, s.pct)) : 0;
            return (
              <div key={s.label} style={{ background: "#2A2E26", borderRadius: 8, padding: 18, border: "1px solid #3a3f34" }}>
                <div style={{ fontSize: 11, letterSpacing: 2, fontWeight: 700, color: "#9ca39a" }}>{s.label}</div>
                <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6, color: s.color, fontVariantNumeric: "tabular-nums" }}>{formatBRL(s.value)}</div>
                {typeof s.pct === "number" && (
                  <div style={{ marginTop: 10, height: 8, width: "100%", borderRadius: 999, background: "#3a3f34", overflow: "hidden" }}>
                    <div style={{ width: `${clamped}%`, height: "100%", background: pctColor(s.pct), borderRadius: 999 }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Tabela clientes */}
        <div style={{ background: "#141612", borderRadius: 8, border: "1px solid #3a3f34", overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #3a3f34", fontSize: 14, fontWeight: 700, letterSpacing: 2, color: "#F26A1F", textTransform: "uppercase" }}>
            Resumo por cliente
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, fontVariantNumeric: "tabular-nums" }}>
            <thead>
              <tr style={{ background: "#1A1D17", color: "#9ca39a", fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>
                <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 700 }}>Cliente</th>
                <th style={{ textAlign: "right", padding: "10px 14px", fontWeight: 700 }}>Pend. Ant.</th>
                <th style={{ textAlign: "right", padding: "10px 14px", fontWeight: 700 }}>Enviado</th>
                <th style={{ textAlign: "right", padding: "10px 14px", fontWeight: 700 }}>Previsão</th>
                <th style={{ textAlign: "right", padding: "10px 14px", fontWeight: 700 }}>Faturado</th>
                <th style={{ textAlign: "right", padding: "10px 14px", fontWeight: 700 }}>%</th>
                <th style={{ textAlign: "right", padding: "10px 14px", fontWeight: 700 }}>Pendência</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => {
                const p = r.meta > 0 ? (r.faturado / r.meta) * 100 : 0;
                return (
                  <tr key={r.nome} style={{ background: i % 2 ? "#161915" : "transparent", borderTop: "1px solid #262a22" }}>
                    <td style={{ padding: "9px 14px", fontWeight: 600 }}>{r.nome}</td>
                    <td style={{ padding: "9px 14px", textAlign: "right" }}>{r.pendAnt > 0 ? formatBRL(r.pendAnt) : "—"}</td>
                    <td style={{ padding: "9px 14px", textAlign: "right" }}>{formatBRL(r.enviado)}</td>
                    <td style={{ padding: "9px 14px", textAlign: "right" }}>{formatBRL(r.meta)}</td>
                    <td style={{ padding: "9px 14px", textAlign: "right", fontWeight: 700 }}>{formatBRL(r.faturado)}</td>
                    <td style={{ padding: "9px 14px", textAlign: "right", fontWeight: 700, color: r.meta > 0 ? pctColor(p) : "#5a5f52" }}>{r.meta > 0 ? fmtPct(p) : "—"}</td>
                    <td style={{ padding: "9px 14px", textAlign: "right", fontWeight: 700, color: r.pendencia > 0 ? "#F2B90C" : "#5a5f52" }}>{r.pendencia > 0 ? formatBRL(r.pendencia) : "—"}</td>
                  </tr>
                );
              })}
              <tr style={{ background: "#F26A1F", color: "#fff", fontWeight: 800 }}>
                <td style={{ padding: "12px 14px" }}>TOTAL GERAL</td>
                <td style={{ padding: "12px 14px", textAlign: "right" }}>{formatBRL(pendAnt)}</td>
                <td style={{ padding: "12px 14px", textAlign: "right" }}>{formatBRL(enviado)}</td>
                <td style={{ padding: "12px 14px", textAlign: "right" }}>{formatBRL(previsao)}</td>
                <td style={{ padding: "12px 14px", textAlign: "right" }}>{formatBRL(faturado)}</td>
                <td style={{ padding: "12px 14px", textAlign: "right" }}>{previsao > 0 ? fmtPct((faturado / previsao) * 100) : "—"}</td>
                <td style={{ padding: "12px 14px", textAlign: "right" }}>{formatBRL(pendencia)}</td>
              </tr>
            </tbody>

          </table>
        </div>

        <div style={{ marginTop: 20, textAlign: "center", fontSize: 12, color: "#5a5f52", letterSpacing: 2, textTransform: "uppercase" }}>
          Pendência total do mês: <span style={{ color: "#F26A1F", fontWeight: 700 }}>{formatBRL(pendencia)}</span>
        </div>
      </div>
    );
  });


type ShareCardProps = {
  mes: number;
  ano: number;
  metaGlobo: number;
  metaAvanti: number;
  previsao: number;
  enviado: number;
  faturado: number;
  pendencia: number;
  pendAnt: number;
  gap: number;
  pctGlobo: number;
  pctAvanti: number;
  pctProjecao: number;
  rows: { nome: string; pendencia: number; pendAnt: number; enviado: number; meta: number; faturado: number }[];
};


