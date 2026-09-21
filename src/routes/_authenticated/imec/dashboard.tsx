import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { forwardRef, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, MESES_BR } from "@/lib/format";
import { Send, FileText, Percent, Building2, ImageDown } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/imec/dashboard")({
  head: () => ({
    meta: [
      { title: "BI IMEC" },
      { name: "description", content: "Dashboard executivo do BI IMEC — enviado x faturado por cliente." },
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
};

function ImecDashboard() {
  const [ANO, setAno] = useState(ANO_ATUAL);
  const [MES, setMes] = useState(MES_ATUAL);
  const shareRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["imec-dashboard", ANO, MES],
    queryFn: async () => {
      const start = `${ANO}-${String(MES).padStart(2, "0")}-01`;
      const endDate = new Date(ANO, MES, 0).toISOString().slice(0, 10);

      const [pedidosRes, nfsRes] = await Promise.all([
        supabase
          .from("imec_pedidos_enviados")
          .select("cliente_id,valor,imec_clientes(nome)")
          .gte("data", start)
          .lte("data", endDate),
        supabase
          .from("imec_notas_fiscais")
          .select("cliente_id,valor,imec_clientes(nome)")
          .gte("data", start)
          .lte("data", endDate)
          .limit(10000),
      ]);
      if (pedidosRes.error) throw pedidosRes.error;
      if (nfsRes.error) throw nfsRes.error;

      const map = new Map<string, ResumoRow>();
      const get = (id: string, nome: string) => {
        const row = map.get(id) ?? { id, nome, enviado: 0, faturado: 0, pedidos: 0, nfs: 0 };
        map.set(id, row);
        return row;
      };

      (pedidosRes.data ?? []).forEach((p) => {
        const r = get(p.cliente_id, p.imec_clientes?.nome ?? "—");
        r.enviado += Number(p.valor);
        r.pedidos += 1;
      });
      (nfsRes.data ?? []).forEach((n) => {
        const r = get(n.cliente_id, n.imec_clientes?.nome ?? "—");
        r.faturado += Number(n.valor);
        r.nfs += 1;
      });

      const rows = Array.from(map.values()).sort((a, b) => b.faturado - a.faturado || b.enviado - a.enviado);
      const totals = rows.reduce(
        (a, r) => ({
          enviado: a.enviado + r.enviado,
          faturado: a.faturado + r.faturado,
          pedidos: a.pedidos + r.pedidos,
          nfs: a.nfs + r.nfs,
        }),
        { enviado: 0, faturado: 0, pedidos: 0, nfs: 0 },
      );

      return { rows, totals, clientesAtendidos: rows.length };
    },
  });

  const t = data?.totals ?? { enviado: 0, faturado: 0, pedidos: 0, nfs: 0 };
  const clientesAtendidos = data?.clientesAtendidos ?? 0;
  const conversao = t.enviado > 0 ? (t.faturado / t.enviado) * 100 : 0;

  async function exportarPNG() {
    if (!shareRef.current) return;
    setExporting(true);
    try {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const dataUrl = await toPng(shareRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#0A0F1C",
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `imec-dashboard-${String(MES).padStart(2, "0")}-${ANO}.png`;
      a.click();
      toast.success("Imagem gerada");
    } catch (e) {
      toast.error("Erro ao gerar imagem: " + (e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <header className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <div className="bi-stat-label">
            Mês de referência · {String(MES).padStart(2, "0")}/{ANO}
          </div>
          <h1 className="font-display text-3xl font-bold mt-1">Dashboard BI IMEC</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Comparativo entre valor enviado e valor faturado no mês, por cliente.
          </p>
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
        <StatCard label="Enviado no mês" value={formatBRL(t.enviado)} icon={Send} />
        <StatCard label="Faturado no mês" value={formatBRL(t.faturado)} icon={FileText} accent />
        <StatCard label="Conversão" value={`${conversao.toFixed(1).replace(".", ",")}%`} icon={Percent} />
        <StatCard label="Clientes atendidos" value={String(clientesAtendidos)} icon={Building2} />
      </section>

      <section className="bi-card overflow-hidden mb-8">
        <header className="px-6 py-4 border-b border-border">
          <h2 className="font-display text-lg font-semibold">Enviado × Faturado por cliente</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pedidos enviados e notas fiscais faturadas no mês selecionado.
          </p>
        </header>
        <div className="overflow-x-auto">
          <table className="bi-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th className="text-right">Pedidos</th>
                <th className="text-right">Enviado</th>
                <th className="text-right">NFs</th>
                <th className="text-right">Faturado</th>
                <th className="text-right">Diferença</th>
                <th className="text-right">% Faturado</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="text-center text-muted-foreground py-10">
                    Carregando…
                  </td>
                </tr>
              )}
              {!isLoading && (data?.rows.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-muted-foreground py-10">
                    Nenhum movimento neste mês.
                  </td>
                </tr>
              )}
              {data?.rows.map((r) => {
                const diff = r.faturado - r.enviado;
                const pct = r.enviado > 0 ? (r.faturado / r.enviado) * 100 : null;
                return (
                  <tr key={r.id}>
                    <td className="font-medium">{r.nome}</td>
                    <td className="text-right tabular-nums">{r.pedidos}</td>
                    <td className="text-right tabular-nums">{formatBRL(r.enviado)}</td>
                    <td className="text-right tabular-nums">{r.nfs}</td>
                    <td className="text-right tabular-nums font-semibold">{formatBRL(r.faturado)}</td>
                    <td
                      className={`text-right tabular-nums ${diff >= 0 ? "text-success" : "text-warning"}`}
                    >
                      {formatBRL(diff)}
                    </td>
                    <td className="text-right tabular-nums">
                      {pct == null ? "—" : `${pct.toFixed(0)}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>TOTAL GERAL</td>
                <td className="text-right tabular-nums">{t.pedidos}</td>
                <td className="text-right tabular-nums">{formatBRL(t.enviado)}</td>
                <td className="text-right tabular-nums">{t.nfs}</td>
                <td className="text-right tabular-nums text-primary">{formatBRL(t.faturado)}</td>
                <td className="text-right tabular-nums">{formatBRL(t.faturado - t.enviado)}</td>
                <td className="text-right tabular-nums">{conversao.toFixed(0)}%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Card off-screen para exportação PNG (WhatsApp) */}
      <div
        style={{ position: "fixed", left: "-10000px", top: 0, pointerEvents: "none" }}
        aria-hidden
      >
        <ShareCard
          ref={shareRef}
          mes={MES}
          ano={ANO}
          totals={t}
          clientesAtendidos={clientesAtendidos}
          rows={data?.rows ?? []}
        />
      </div>
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
    <div
      className={
        accent
          ? "rounded-md p-5 bg-primary text-primary-foreground shadow-[0_12px_32px_-10px_var(--primary)]"
          : "bi-card p-5"
      }
    >
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

type Totals = { enviado: number; faturado: number; pedidos: number; nfs: number };

type ShareCardProps = {
  mes: number;
  ano: number;
  totals: Totals;
  clientesAtendidos: number;
  rows: ResumoRow[];
};

const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(function ShareCardImpl(props, ref) {
  const { mes, ano, totals, clientesAtendidos, rows } = props;
  const mesNome = MESES_BR[mes - 1];
  const sorted = [...rows].sort((a, b) => b.faturado - a.faturado);
  const geradoEm = new Date().toLocaleDateString("pt-BR");
  const AZUL = "#044CB6";
  const conversao = totals.enviado > 0 ? (totals.faturado / totals.enviado) * 100 : 0;

  return (
    <div
      ref={ref}
      style={{
        width: 1080,
        background: "linear-gradient(180deg, #0A0F1C 0%, #101733 100%)",
        color: "#E5E7EF",
        fontFamily: "'Inter', system-ui, sans-serif",
        padding: 48,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 32,
          borderBottom: `2px solid ${AZUL}`,
          paddingBottom: 20,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 14,
              letterSpacing: 3,
              color: AZUL,
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            BI IMEC · Dashboard Executivo
          </div>
          <div style={{ fontSize: 44, fontWeight: 800, marginTop: 8, letterSpacing: -1 }}>
            {mesNome} <span style={{ color: AZUL }}>{ano}</span>
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: 13, color: "#9aa3b9" }}>
          <div>Gerado em</div>
          <div style={{ fontSize: 18, color: "#E5E7EF", fontWeight: 600 }}>{geradoEm}</div>
        </div>
      </div>

      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 24 }}
      >
        {[
          { label: "ENVIADO", value: formatBRL(totals.enviado) },
          { label: "FATURADO", value: formatBRL(totals.faturado), highlight: true },
          { label: "CONVERSÃO", value: `${conversao.toFixed(1).replace(".", ",")}%` },
          { label: "CLIENTES", value: String(clientesAtendidos) },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              background: s.highlight ? `${AZUL}1A` : "#141B33",
              borderRadius: 8,
              padding: 18,
              border: "1px solid #263056",
            }}
          >
            <div style={{ fontSize: 11, letterSpacing: 2, fontWeight: 700, color: "#9aa3b9" }}>
              {s.label}
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                marginTop: 6,
                color: s.highlight ? AZUL : "#fff",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          background: "#0F1530",
          borderRadius: 8,
          border: "1px solid #263056",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid #263056",
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: 2,
            color: AZUL,
            textTransform: "uppercase",
          }}
        >
          Enviado × Faturado por cliente
        </div>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 14,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <thead>
            <tr
              style={{
                background: "#141B33",
                color: "#9aa3b9",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 700 }}>Cliente</th>
              <th style={{ textAlign: "right", padding: "10px 14px", fontWeight: 700 }}>Enviado</th>
              <th style={{ textAlign: "right", padding: "10px 14px", fontWeight: 700 }}>Faturado</th>
              <th style={{ textAlign: "right", padding: "10px 14px", fontWeight: 700 }}>%</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr
                key={r.id}
                style={{
                  background: i % 2 ? "#131A34" : "transparent",
                  borderTop: "1px solid #202a4a",
                }}
              >
                <td style={{ padding: "9px 14px", fontWeight: 600 }}>{r.nome}</td>
                <td style={{ padding: "9px 14px", textAlign: "right" }}>{formatBRL(r.enviado)}</td>
                <td style={{ padding: "9px 14px", textAlign: "right", fontWeight: 700 }}>
                  {formatBRL(r.faturado)}
                </td>
                <td style={{ padding: "9px 14px", textAlign: "right" }}>
                  {r.enviado > 0 ? `${((r.faturado / r.enviado) * 100).toFixed(0)}%` : "—"}
                </td>
              </tr>
            ))}
            <tr style={{ background: AZUL, color: "#fff", fontWeight: 800 }}>
              <td style={{ padding: "12px 14px" }}>TOTAL GERAL</td>
              <td style={{ padding: "12px 14px", textAlign: "right" }}>
                {formatBRL(totals.enviado)}
              </td>
              <td style={{ padding: "12px 14px", textAlign: "right" }}>
                {formatBRL(totals.faturado)}
              </td>
              <td style={{ padding: "12px 14px", textAlign: "right" }}>{conversao.toFixed(0)}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
});
