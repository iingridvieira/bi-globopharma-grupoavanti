import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { forwardRef, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, MESES_BR } from "@/lib/format";
import { Send, CheckCircle2, Clock, Users, ImageDown } from "lucide-react";
import { toast } from "sonner";

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

type ResumoRow = {
  id: string;
  nome: string;
  total: number;
  aprovado: number;
  aguardando: number;
  pedidos: number;
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

      const { data: pedidos, error } = await supabase
        .from("imec_pedidos_enviados")
        .select("cliente_id,valor,status,imec_clientes(nome)")
        .gte("data", start)
        .lte("data", endDate);
      if (error) throw error;

      const map = new Map<string, ResumoRow>();
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

      {/* Card off-screen para exportação PNG (WhatsApp) */}
      <div
        style={{ position: "fixed", left: "-10000px", top: 0, pointerEvents: "none" }}
        aria-hidden
      >
        <ShareCard ref={shareRef} mes={MES} ano={ANO} totals={t} rows={data?.rows ?? []} />
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

type ShareCardProps = {
  mes: number;
  ano: number;
  totals: { total: number; aprovado: number; aguardando: number; pedidos: number };
  rows: ResumoRow[];
};

const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(function ShareCardImpl(props, ref) {
  const { mes, ano, totals, rows } = props;
  const mesNome = MESES_BR[mes - 1];
  const sorted = [...rows].sort((a, b) => b.total - a.total);
  const geradoEm = new Date().toLocaleDateString("pt-BR");
  const AZUL = "#044CB6";

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
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {[
          { label: "TOTAL ENVIADO", value: formatBRL(totals.total), highlight: true },
          { label: "PEDIDOS NO MÊS", value: String(totals.pedidos) },
          { label: "APROVADO", value: formatBRL(totals.aprovado) },
          { label: "AGUARDANDO", value: formatBRL(totals.aguardando) },
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
                fontSize: 26,
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
          Resumo por cliente
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
              <th style={{ textAlign: "right", padding: "10px 14px", fontWeight: 700 }}>
                Aprovado
              </th>
              <th style={{ textAlign: "right", padding: "10px 14px", fontWeight: 700 }}>
                Aguardando
              </th>
              <th style={{ textAlign: "right", padding: "10px 14px", fontWeight: 700 }}>Total</th>
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
                <td style={{ padding: "9px 14px", textAlign: "right" }}>
                  {r.aprovado > 0 ? formatBRL(r.aprovado) : "—"}
                </td>
                <td style={{ padding: "9px 14px", textAlign: "right" }}>
                  {r.aguardando > 0 ? formatBRL(r.aguardando) : "—"}
                </td>
                <td style={{ padding: "9px 14px", textAlign: "right", fontWeight: 700 }}>
                  {formatBRL(r.total)}
                </td>
              </tr>
            ))}
            <tr style={{ background: AZUL, color: "#fff", fontWeight: 800 }}>
              <td style={{ padding: "12px 14px" }}>TOTAL GERAL</td>
              <td style={{ padding: "12px 14px", textAlign: "right" }}>
                {formatBRL(totals.aprovado)}
              </td>
              <td style={{ padding: "12px 14px", textAlign: "right" }}>
                {formatBRL(totals.aguardando)}
              </td>
              <td style={{ padding: "12px 14px", textAlign: "right" }}>
                {formatBRL(totals.total)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
});
