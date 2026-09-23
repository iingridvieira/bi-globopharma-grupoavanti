import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { forwardRef, useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Building2, Check, FileCheck, ImageDown, Pencil, Send, Target, TrendingDown, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatBRLSmart, formatDateBR, MESES_BR, parseBRNumber } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/imec/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard Executivo · BI IMEC" },
      { name: "description", content: "Metas, faturamento, pedidos e pendências por cliente do BI IMEC." },
      { property: "og:title", content: "Dashboard Executivo · BI IMEC" },
      { property: "og:description", content: "Metas, faturamento, pedidos e pendências por cliente do BI IMEC." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ImecDashboard,
});

const now = new Date();
const ANO_ATUAL = now.getFullYear();
const MES_ATUAL = now.getMonth() + 1;

type ResumoRow = {
  id: string;
  nome: string;
  enviado: number;
  faturado: number;
  pedidos: number;
  nfs: number;
  pendencia: number;
  ultimaCompraData: string | null;
  ultimaCompraValor: number;
};

function ImecDashboard() {
  const { isAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  const [ano, setAno] = useState(ANO_ATUAL);
  const [mes, setMes] = useState(MES_ATUAL);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const shareRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["imec-dashboard", ano, mes],
    queryFn: async () => {
      const start = `${ano}-${String(mes).padStart(2, "0")}-01`;
      const end = new Date(ano, mes, 0).toISOString().slice(0, 10);
      const recentStart = new Date(ano, mes - 6, 1).toISOString().slice(0, 10);
      const [clientesRes, pedidosRes, nfsRes, recentNfsRes, pendRes, metaRes] = await Promise.all([
        supabase.from("imec_clientes").select("id,nome").eq("ativo", true).order("nome"),
        supabase.from("imec_pedidos_enviados").select("cliente_id,valor").gte("data", start).lte("data", end).limit(10000),
        supabase.from("imec_notas_fiscais").select("cliente_id,valor").gte("data", start).lte("data", end).limit(10000),
        supabase.from("imec_notas_fiscais").select("cliente_id,data,valor").gte("data", recentStart).lte("data", end).limit(10000),
        supabase.from("imec_pendencias_produtos").select("cliente_id,valor").limit(10000),
        supabase.from("imec_metas_mensais").select("valor").eq("ano", ano).eq("mes", mes).maybeSingle(),
      ]);
      const error = clientesRes.error ?? pedidosRes.error ?? nfsRes.error ?? recentNfsRes.error ?? pendRes.error ?? metaRes.error;
      if (error) throw error;

      const map = new Map<string, ResumoRow>();
      (clientesRes.data ?? []).forEach((cliente) => map.set(cliente.id, {
        id: cliente.id,
        nome: cliente.nome,
        enviado: 0,
        faturado: 0,
        pedidos: 0,
        nfs: 0,
        pendencia: 0,
        ultimaCompraData: null,
        ultimaCompraValor: 0,
      }));
      (pedidosRes.data ?? []).forEach((pedido) => {
        const row = map.get(pedido.cliente_id);
        if (!row) return;
        row.enviado += Number(pedido.valor);
        row.pedidos += 1;
      });
      (nfsRes.data ?? []).forEach((nf) => {
        const row = map.get(nf.cliente_id);
        if (!row) return;
        row.faturado += Number(nf.valor);
        row.nfs += 1;
      });
      (pendRes.data ?? []).forEach((pendencia) => {
        const row = map.get(pendencia.cliente_id);
        if (row) row.pendencia += Number(pendencia.valor);
      });

      const clientesComNfRecente = new Set((recentNfsRes.data ?? []).map((nf) => nf.cliente_id));
      (recentNfsRes.data ?? []).forEach((nf) => {
        const row = map.get(nf.cliente_id);
        if (!row || !nf.data) return;
        if (!row.ultimaCompraData || nf.data > row.ultimaCompraData) {
          row.ultimaCompraData = nf.data;
          row.ultimaCompraValor = Number(nf.valor);
        }
      });
      const rows = Array.from(map.values())
        .filter((row) => row.enviado > 0 || row.faturado > 0 || row.pendencia > 0 || clientesComNfRecente.has(row.id))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      const totals = rows.reduce((acc, row) => ({
        enviado: acc.enviado + row.enviado,
        faturado: acc.faturado + row.faturado,
        pedidos: acc.pedidos + row.pedidos,
        nfs: acc.nfs + row.nfs,
        pendencia: acc.pendencia + row.pendencia,
      }), { enviado: 0, faturado: 0, pedidos: 0, nfs: 0, pendencia: 0 });
      const clientesAtendidos = rows.filter((row) => row.pedidos > 0 || row.nfs > 0).length;
      return { rows, totals, clientesAtendidos, meta: Number(metaRes.data?.valor ?? 0) };
    },
  });

  const totals = data?.totals ?? { enviado: 0, faturado: 0, pedidos: 0, nfs: 0, pendencia: 0 };
  const meta = data?.meta ?? 0;
  const pctMeta = meta > 0 ? (totals.faturado / meta) * 100 : 0;
  const conversao = totals.enviado > 0 ? (totals.faturado / totals.enviado) * 100 : 0;
  const gap = meta - totals.faturado;

  async function saveMeta(valor: number) {
    const { error } = await supabase.from("imec_metas_mensais").upsert({
      ano,
      mes,
      valor,
      updated_by: user?.id ?? null,
    }, { onConflict: "ano,mes" });
    if (error) {
      toast.error("Erro ao salvar meta: " + error.message);
      return false;
    }
    toast.success("Meta IMEC atualizada");
    await queryClient.invalidateQueries({ queryKey: ["imec-dashboard", ano, mes] });
    return true;
  }

  async function exportarPNG() {
    const node = shareRef.current;
    if (!node) return;
    setExporting(true);
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const dataUrl = await toPng(node, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#07122A",
      });
      const anchor = document.createElement("a");
      anchor.href = dataUrl;
      anchor.download = `imec-dashboard-${String(mes).padStart(2, "0")}-${ano}.png`;
      anchor.click();
      toast.success("Imagem pronta para compartilhar");
    } catch (error) {
      toast.error("Erro ao gerar imagem: " + (error as Error).message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div ref={dashboardRef} className="p-5 sm:p-8 max-w-[1600px] mx-auto bg-background">
      <header className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <div className="bi-stat-label">Mês de referência · {String(mes).padStart(2, "0")}/{ano}</div>
          <h1 className="font-display text-3xl font-bold mt-1">Dashboard Executivo</h1>
          <p className="text-muted-foreground text-sm mt-1">Visão consolidada do BI IMEC por cliente.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2" data-png-ignore="true">
          <Button variant="outline" onClick={() => void exportarPNG()} disabled={exporting || isLoading}>
            <ImageDown /> {exporting ? "Gerando…" : "Exportar PNG"}
          </Button>
          <select className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary" value={mes} onChange={(event) => setMes(Number(event.target.value))} aria-label="Mês">
            {MESES_BR.map((nome, index) => <option key={nome} value={index + 1}>{nome}</option>)}
          </select>
          <select className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary" value={ano} onChange={(event) => setAno(Number(event.target.value))} aria-label="Ano">
            {Array.from({ length: 5 }, (_, index) => ANO_ATUAL - 2 + index).map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <MetaCard label="META MENSAL IMEC" value={meta} pct={pctMeta} icon={Target} editable={isAdmin} onSave={saveMeta} />
        <StatCard label="Faturado no mês" value={formatBRLSmart(totals.faturado)} icon={FileCheck} accent />
        <StatCard label="GAP (Meta - Faturado)" value={formatBRLSmart(gap)} icon={TrendingDown} warning={gap > 0} />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard label="Pedidos enviados" value={formatBRLSmart(totals.enviado)} icon={Send} pct={meta > 0 ? (totals.enviado / meta) * 100 : undefined} />
        <StatCard label="Conversão" value={`${conversao.toFixed(1).replace(".", ",")}%`} icon={TrendingDown} />
        <StatCard label="Clientes atendidos" value={String(data?.clientesAtendidos ?? 0)} icon={Building2} />
      </section>

      <section className="bi-card overflow-hidden mb-8">
        <header className="px-6 py-4 border-b border-border">
          <h2 className="font-display text-lg font-semibold">Resumo por cliente</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Enviado · Faturado · Pendência total em aberto</p>
        </header>
        <div className="overflow-x-auto">
          <table className="bi-table">
            <thead><tr><th>Cliente</th><th className="text-right">Pedidos</th><th className="text-right">Enviado</th><th className="text-right">NFs</th><th className="text-right">Faturado</th><th className="text-right">Pendência</th><th className="text-right">Última Compra</th><th className="text-right">Valor Últ. Compra</th></tr></thead>
            <tbody>
              {isLoading && <tr><td colSpan={8} className="text-center text-muted-foreground py-10">Carregando…</td></tr>}
              {!isLoading && (data?.rows.length ?? 0) === 0 && <tr><td colSpan={8} className="text-center text-muted-foreground py-10">Nenhum movimento neste mês.</td></tr>}
              {data?.rows.map((row) => (
                <tr key={row.id}>
                  <td className="font-medium"><Link to="/imec/por-clientes/$clienteId" params={{ clienteId: row.id }} className="hover:text-primary hover:underline">{row.nome}</Link></td>
                  <td className="text-right tabular-nums">{row.pedidos}</td>
                  <td className="text-right tabular-nums">{formatBRL(row.enviado)}</td>
                  <td className="text-right tabular-nums">{row.nfs}</td>
                  <td className="text-right tabular-nums font-semibold">{formatBRL(row.faturado)}</td>
                  <td className={`text-right tabular-nums font-semibold ${row.pendencia > 0 ? "text-warning" : "text-muted-foreground"}`}>{row.pendencia > 0 ? formatBRL(row.pendencia) : "—"}</td>
                  <td className="text-right tabular-nums">{row.ultimaCompraData ? formatDateBR(row.ultimaCompraData) : "—"}</td>
                  <td className="text-right tabular-nums">{row.ultimaCompraData ? formatBRL(row.ultimaCompraValor) : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td>TOTAL GERAL</td><td className="text-right tabular-nums">{totals.pedidos}</td><td className="text-right tabular-nums">{formatBRL(totals.enviado)}</td><td className="text-right tabular-nums">{totals.nfs}</td><td className="text-right tabular-nums text-primary">{formatBRL(totals.faturado)}</td><td className="text-right tabular-nums text-primary">{formatBRL(totals.pendencia)}</td><td /><td /></tr></tfoot>
          </table>
        </div>
      </section>

      <div style={{ position: "fixed", left: "-10000px", top: 0, pointerEvents: "none" }} aria-hidden>
        <ImecShareCard
          ref={shareRef}
          mes={mes}
          ano={ano}
          meta={meta}
          pctMeta={pctMeta}
          faturado={totals.faturado}
          enviado={totals.enviado}
          gap={gap}
          conversao={conversao}
          clientesAtendidos={data?.clientesAtendidos ?? 0}
          rows={data?.rows ?? []}
          totals={totals}
        />
      </div>
    </div>
  );
}

type ShareProps = {
  mes: number; ano: number; meta: number; pctMeta: number; faturado: number; enviado: number; gap: number;
  conversao: number; clientesAtendidos: number; rows: ResumoRow[];
  totals: { enviado: number; faturado: number; pedidos: number; nfs: number; pendencia: number };
};

const ImecShareCard = forwardRef<HTMLDivElement, ShareProps>(function ImecShareCardImpl(p, ref) {
  const AZUL = "#3B82F6";
  const AZUL_CLARO = "#93C5FD";
  const BORDA = "#1E3A66";
  const fmtPct = (v: number) => `${v.toFixed(1).replace(".", ",")}%`;
  const sorted = [...p.rows].sort((a, b) => b.faturado - a.faturado || a.nome.localeCompare(b.nome, "pt-BR"));
  const barra = (pct: number) => (
    <div style={{ marginTop: 14, height: 8, borderRadius: 99, background: "rgba(147,197,253,0.15)", overflow: "hidden" }}>
      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%", borderRadius: 99, background: `linear-gradient(90deg, #2563EB, ${AZUL_CLARO})` }} />
    </div>
  );
  const stat = (label: string, value: string, color = "#fff", sub?: string, pct?: number) => (
    <div style={{ background: "rgba(15,35,70,0.75)", border: `1px solid ${BORDA}`, borderRadius: 14, padding: 20 }}>
      <div style={{ fontSize: 11, letterSpacing: 2, fontWeight: 700, color: "#8FA6CC", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8, color, fontVariantNumeric: "tabular-nums", letterSpacing: -0.5 }}>{value}</div>
      {sub && <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4, color: AZUL_CLARO }}>{sub}</div>}
      {typeof pct === "number" && barra(pct)}
    </div>
  );
  return (
    <div ref={ref} style={{ width: 1080, background: "radial-gradient(circle at 85% 0%, #1D4ED8 0%, rgba(29,78,216,0) 45%), linear-gradient(180deg, #07122A 0%, #0B1B3A 100%)", color: "#E6EEFB", fontFamily: "'Inter', system-ui, sans-serif", padding: 48, boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32, paddingBottom: 22, borderBottom: `2px solid ${AZUL}` }}>
        <div>
          <div style={{ fontSize: 14, letterSpacing: 3, color: AZUL_CLARO, fontWeight: 700, textTransform: "uppercase" }}>BI IMEC · Dashboard Executivo</div>
          <div style={{ fontSize: 46, fontWeight: 800, marginTop: 8, letterSpacing: -1 }}>{MESES_BR[p.mes - 1]} <span style={{ color: AZUL }}>{p.ano}</span></div>
        </div>
        <div style={{ textAlign: "right", fontSize: 13, color: "#8FA6CC" }}>
          <div>Gerado em</div>
          <div style={{ fontSize: 18, color: "#fff", fontWeight: 600 }}>{new Date().toLocaleDateString("pt-BR")}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, marginBottom: 16 }}>
        <div style={{ background: "linear-gradient(135deg, #1D4ED8 0%, #1E3A8A 100%)", borderRadius: 16, padding: 26, boxShadow: "0 20px 40px -20px rgba(59,130,246,0.6)" }}>
          <div style={{ fontSize: 12, letterSpacing: 2, fontWeight: 700, color: "#DBEAFE" }}>META MENSAL IMEC</div>
          <div style={{ fontSize: 40, fontWeight: 800, marginTop: 8, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{p.meta > 0 ? formatBRLSmart(p.meta) : "Sem meta"}</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 14, fontWeight: 700, color: "#DBEAFE" }}>
            <span>Faturado {formatBRLSmart(p.faturado)}</span>
            <span>{p.meta > 0 ? `${fmtPct(p.pctMeta)} atingido` : "—"}</span>
          </div>
          <div style={{ marginTop: 16, height: 12, borderRadius: 99, background: "rgba(255,255,255,0.18)", overflow: "hidden" }}>
            <div style={{ width: `${Math.max(0, Math.min(100, p.pctMeta))}%`, height: "100%", borderRadius: 99, background: "linear-gradient(90deg, #BFDBFE, #fff)" }} />
          </div>
        </div>
        {stat("GAP (Meta - Faturado)", formatBRLSmart(p.gap), p.gap > 0 ? "#FBBF24" : "#34D399", p.gap > 0 ? "Falta para bater a meta" : "Meta atingida")}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 26 }}>
        {stat("Pedidos enviados", formatBRLSmart(p.enviado), "#fff", p.meta > 0 ? `${fmtPct((p.enviado / p.meta) * 100)} da meta` : undefined, p.meta > 0 ? (p.enviado / p.meta) * 100 : undefined)}
        {stat("Conversão", fmtPct(p.conversao), "#fff", "Faturado ÷ Enviado")}
        {stat("Clientes atendidos", String(p.clientesAtendidos), "#fff", `${p.rows.length} clientes no resumo`)}
      </div>

      <div style={{ background: "rgba(7,18,42,0.85)", borderRadius: 14, border: `1px solid ${BORDA}`, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${BORDA}`, fontSize: 14, fontWeight: 700, letterSpacing: 2, color: AZUL_CLARO, textTransform: "uppercase" }}>Resumo por cliente</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, fontVariantNumeric: "tabular-nums" }}>
          <thead>
            <tr style={{ background: "#0F2347", color: "#8FA6CC", fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>
              {["Cliente", "Pedidos", "Enviado", "NFs", "Faturado", "Pendência", "Últ. Compra", "Valor Últ. Compra"].map((h, i) => <th key={h} style={{ textAlign: i === 0 ? "left" : "right", padding: "10px 14px", fontWeight: 700 }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.id} style={{ background: i % 2 ? "rgba(30,58,102,0.25)" : "transparent", borderTop: "1px solid #14294D" }}>
                <td style={{ padding: "9px 14px", fontWeight: 600 }}>{r.nome}</td>
                <td style={{ padding: "9px 14px", textAlign: "right" }}>{r.pedidos}</td>
                <td style={{ padding: "9px 14px", textAlign: "right" }}>{formatBRL(r.enviado)}</td>
                <td style={{ padding: "9px 14px", textAlign: "right" }}>{r.nfs}</td>
                <td style={{ padding: "9px 14px", textAlign: "right", fontWeight: 700, color: r.faturado > 0 ? "#fff" : "#4B5E80" }}>{formatBRL(r.faturado)}</td>
                <td style={{ padding: "9px 14px", textAlign: "right", fontWeight: 700, color: r.pendencia > 0 ? "#FBBF24" : "#4B5E80" }}>{r.pendencia > 0 ? formatBRL(r.pendencia) : "—"}</td>
                <td style={{ padding: "9px 14px", textAlign: "right", color: "#C7D7F2" }}>{r.ultimaCompraData ? formatDateBR(r.ultimaCompraData) : "—"}</td>
                <td style={{ padding: "9px 14px", textAlign: "right", color: "#C7D7F2" }}>{r.ultimaCompraData ? formatBRL(r.ultimaCompraValor) : "—"}</td>
              </tr>
            ))}
            <tr style={{ background: "linear-gradient(90deg, #2563EB, #1D4ED8)", color: "#fff", fontWeight: 800 }}>
              <td style={{ padding: "12px 14px" }}>TOTAL GERAL</td>
              <td style={{ padding: "12px 14px", textAlign: "right" }}>{p.totals.pedidos}</td>
              <td style={{ padding: "12px 14px", textAlign: "right" }}>{formatBRL(p.totals.enviado)}</td>
              <td style={{ padding: "12px 14px", textAlign: "right" }}>{p.totals.nfs}</td>
              <td style={{ padding: "12px 14px", textAlign: "right" }}>{formatBRL(p.totals.faturado)}</td>
              <td style={{ padding: "12px 14px", textAlign: "right" }}>{formatBRL(p.totals.pendencia)}</td>
              <td style={{ padding: "12px 14px" }} colSpan={2} />
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 20, textAlign: "center", fontSize: 12, color: "#5F7499" }}>BI IMEC · Grupo Avanti</div>
    </div>
  );
});

function CardFill({ pct }: { pct: number }) {
  const [width, setWidth] = useState(0);
  const clamped = Math.max(0, Math.min(100, pct));
  useEffect(() => {
    const id = requestAnimationFrame(() => setWidth(clamped));
    return () => cancelAnimationFrame(id);
  }, [clamped]);
  return <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"><div className="absolute inset-0 bg-primary/10" /><div className="absolute inset-y-0 left-0 bg-primary/85" style={{ width: `${width}%`, transition: "width 900ms cubic-bezier(0.22, 1, 0.36, 1)" }} /></div>;
}

function MetaCard({ label, value, pct, icon: Icon, editable, onSave }: { label: string; value: number; pct: number; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; editable: boolean; onSave: (value: number) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  async function handleSave() {
    setSaving(true);
    const ok = await onSave(parseBRNumber(draft));
    setSaving(false);
    if (ok) setEditing(false);
  }
  return (
    <div className="bi-card p-5 relative overflow-hidden ring-1 ring-primary/60">
      {value > 0 && <CardFill pct={pct} />}
      <div className="relative z-10">
        <div className="flex items-start justify-between"><div className="bi-stat-label">{label}</div><Icon className="h-5 w-5 text-primary" strokeWidth={2} /></div>
        {editing ? (
          <div className="mt-3 flex items-center gap-2" data-png-ignore="true">
            <input autoFocus className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-lg font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void handleSave(); if (event.key === "Escape") setEditing(false); }} />
            <Button size="icon" onClick={() => void handleSave()} disabled={saving} aria-label="Salvar meta"><Check /></Button>
            <Button size="icon" variant="ghost" onClick={() => setEditing(false)} aria-label="Cancelar edição"><X /></Button>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-2"><div className="bi-stat-value text-3xl">{formatBRLSmart(value)}</div>{editable && <Button data-png-ignore="true" size="icon" variant="ghost" onClick={() => { setDraft(value > 0 ? String(value).replace(".", ",") : ""); setEditing(true); }} aria-label="Editar meta"><Pencil /></Button>}</div>
        )}
        <div className={`text-xs mt-2 font-medium ${pct >= 100 ? "text-success" : pct >= 70 ? "text-primary" : "text-warning"}`}>{value > 0 ? `${pct.toFixed(1).replace(".", ",")}% atingido` : "Sem meta definida"}</div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, accent, warning, pct }: { label: string; value: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; accent?: boolean; warning?: boolean; pct?: number }) {
  return (
    <div className={`${accent && pct == null ? "bi-card-accent" : "bi-card"} p-5 relative overflow-hidden`}>
      {pct != null && <CardFill pct={pct} />}
      <div className="relative z-10"><div className="flex items-start justify-between"><div className={accent && pct == null ? "text-primary-foreground/80 bi-stat-label" : "bi-stat-label"}>{label}</div><Icon className={`h-5 w-5 ${accent && pct == null ? "text-primary-foreground/80" : "text-primary"}`} strokeWidth={2} /></div><div className={`bi-stat-value mt-3 text-3xl ${warning ? "text-warning" : ""}`}>{value}</div></div>
    </div>
  );
}
