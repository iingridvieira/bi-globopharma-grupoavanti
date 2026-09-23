import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { forwardRef, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDateBR, MESES_BR } from "@/lib/format";
import { exportToExcel } from "@/lib/excel";
import { MultiSelect } from "@/components/MultiSelect";
import { Send, FileText, Percent, Building2, ImageDown, PackageOpen, FileDown } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/imec/dashboard")({
  head: () => ({
    meta: [
      { title: "BI IMEC" },
      {
        name: "description",
        content: "Dashboard executivo do BI IMEC — enviado x faturado por cliente.",
      },
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
};

type PendenciaItem = {
  id: string;
  cliente: string;
  empresa: string;
  numeroPedido: string;
  dataEmissao: string | null;
  dataEntrega: string | null;
  codigoProduto: string;
  produto: string;
  precoUnitario: number;
  quantidade: number;
  valor: number;
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

      // Pendências não têm mês/ano (é o backlog atual de pedidos em aberto,
      // substituído por completo a cada importação — como no BI Globo), por
      // isso a busca não filtra por período.
      const [pedidosRes, nfsRes, pendRes] = await Promise.all([
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
        supabase
          .from("imec_pendencias_produtos")
          .select(
            "id,cliente_id,empresa,numero_pedido,data_emissao,data_entrega,codigo_produto,produto,preco_unitario,quantidade,valor,imec_clientes(nome)",
          )
          .limit(10000),
      ]);
      if (pedidosRes.error) throw pedidosRes.error;
      if (nfsRes.error) throw nfsRes.error;
      if (pendRes.error) throw pendRes.error;

      const map = new Map<string, ResumoRow>();
      const get = (id: string, nome: string) => {
        const row = map.get(id) ?? {
          id,
          nome,
          enviado: 0,
          faturado: 0,
          pedidos: 0,
          nfs: 0,
          pendencia: 0,
        };
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
      (pendRes.data ?? []).forEach((p) => {
        const r = get(p.cliente_id, p.imec_clientes?.nome ?? "—");
        r.pendencia += Number(p.valor);
      });
      const pendenciaItens: PendenciaItem[] = (pendRes.data ?? []).map((p) => ({
        id: p.id,
        cliente: p.imec_clientes?.nome ?? "—",
        empresa: p.empresa,
        numeroPedido: p.numero_pedido ?? "",
        dataEmissao: p.data_emissao,
        dataEntrega: p.data_entrega,
        codigoProduto: p.codigo_produto ?? "",
        produto: p.produto,
        precoUnitario: Number(p.preco_unitario),
        quantidade: Number(p.quantidade),
        valor: Number(p.valor),
      }));

      const rows = Array.from(map.values()).sort(
        (a, b) => b.faturado - a.faturado || b.enviado - a.enviado,
      );
      const totals = rows.reduce(
        (a, r) => ({
          enviado: a.enviado + r.enviado,
          faturado: a.faturado + r.faturado,
          pedidos: a.pedidos + r.pedidos,
          nfs: a.nfs + r.nfs,
          pendencia: a.pendencia + r.pendencia,
        }),
        { enviado: 0, faturado: 0, pedidos: 0, nfs: 0, pendencia: 0 },
      );
      // "Clientes atendidos" reflete movimento (pedido/NF) no mês selecionado;
      // um cliente que só tem pendência (sem filtro de mês) não conta aqui.
      const clientesAtendidos = rows.filter((r) => r.pedidos > 0 || r.nfs > 0).length;

      return { rows, totals, clientesAtendidos, pendenciaItens };
    },
  });

  const t = data?.totals ?? { enviado: 0, faturado: 0, pedidos: 0, nfs: 0, pendencia: 0 };
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

      <section className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <StatCard label="Enviado no mês" value={formatBRL(t.enviado)} icon={Send} />
        <StatCard label="Faturado no mês" value={formatBRL(t.faturado)} icon={FileText} accent />
        <StatCard
          label="Conversão"
          value={`${conversao.toFixed(1).replace(".", ",")}%`}
          icon={Percent}
        />
        <StatCard label="Clientes atendidos" value={String(clientesAtendidos)} icon={Building2} />
        <StatCard label="Pendências em aberto" value={formatBRL(t.pendencia)} icon={PackageOpen} />
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
                <th className="text-right">Pendência</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={8} className="text-center text-muted-foreground py-10">
                    Carregando…
                  </td>
                </tr>
              )}
              {!isLoading && (data?.rows.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-muted-foreground py-10">
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
                    <td className="text-right tabular-nums font-semibold">
                      {formatBRL(r.faturado)}
                    </td>
                    <td
                      className={`text-right tabular-nums ${diff >= 0 ? "text-success" : "text-warning"}`}
                    >
                      {formatBRL(diff)}
                    </td>
                    <td className="text-right tabular-nums">
                      {pct == null ? "—" : `${pct.toFixed(0)}%`}
                    </td>
                    <td
                      className={`text-right tabular-nums font-semibold ${r.pendencia > 0 ? "text-warning" : "text-muted-foreground"}`}
                    >
                      {r.pendencia > 0 ? formatBRL(r.pendencia) : "—"}
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
                <td className="text-right tabular-nums text-primary">{formatBRL(t.pendencia)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <PendenciasSection itens={data?.pendenciaItens ?? []} isLoading={isLoading} />

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

/**
 * Área de Pendências (pedidos em aberto) do BI IMEC — mesma ideia da seção
 * "Pendências em aberto" do BI Globo (por-clientes/$clienteId), só que aqui
 * cobrindo todos os clientes de uma vez (o IMEC não tem uma tela por
 * cliente), por isso a tabela ganha uma coluna "Cliente" a mais.
 */
function PendenciasSection({ itens, isLoading }: { itens: PendenciaItem[]; isLoading: boolean }) {
  const [clienteFiltro, setClienteFiltro] = useState<string[]>([]);
  const [produtoFiltro, setProdutoFiltro] = useState<string[]>([]);

  const clienteOpcoes = useMemo(() => {
    const set = new Set(itens.map((i) => i.cliente));
    return Array.from(set)
      .sort((a, b) => a.localeCompare(b, "pt-BR"))
      .map((v) => ({ value: v, label: v }));
  }, [itens]);

  const produtoOpcoes = useMemo(() => {
    const set = new Set(itens.map((i) => i.produto || "—"));
    return Array.from(set)
      .sort((a, b) => a.localeCompare(b, "pt-BR"))
      .map((v) => ({ value: v, label: v }));
  }, [itens]);

  const filtrados = useMemo(() => {
    const cSet = new Set(clienteFiltro);
    const pSet = new Set(produtoFiltro);
    return itens
      .filter((i) => cSet.size === 0 || cSet.has(i.cliente))
      .filter((i) => pSet.size === 0 || pSet.has(i.produto || "—"))
      .sort(
        (a, b) =>
          a.cliente.localeCompare(b.cliente, "pt-BR") ||
          a.produto.localeCompare(b.produto, "pt-BR"),
      );
  }, [itens, clienteFiltro, produtoFiltro]);

  const totais = useMemo(
    () => ({
      vol: filtrados.reduce((a, b) => a + b.quantidade, 0),
      valor: filtrados.reduce((a, b) => a + b.valor, 0),
    }),
    [filtrados],
  );

  function exportar() {
    const rows = filtrados.map((i) => ({
      Cliente: i.cliente,
      Empresa: i.empresa,
      "Nº Pedido": i.numeroPedido,
      "Data Emissão": i.dataEmissao ? formatDateBR(i.dataEmissao) : "",
      "Previsão Entrega": i.dataEntrega ? formatDateBR(i.dataEntrega) : "",
      "Código do Produto": i.codigoProduto,
      Produto: i.produto,
      "Preço Unitário": i.precoUnitario,
      "Pend em aberto (VOL)": i.quantidade,
      "Pend em aberto (R$)": i.valor,
    }));
    if (rows.length === 0) {
      toast.error("Sem pendências para exportar.");
      return;
    }
    exportToExcel(rows, "pendencias-imec.xlsx", "Pendências");
  }

  return (
    <section className="bi-card mb-8 overflow-hidden">
      <header className="px-6 py-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Pendências em aberto</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pedidos ainda não faturados (backlog atual) · IMEC e Nutivit
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap text-right">
          <MultiSelect
            width={220}
            placeholder="Filtrar cliente"
            searchPlaceholder="Buscar cliente..."
            options={clienteOpcoes}
            selected={clienteFiltro}
            onChange={setClienteFiltro}
          />
          <MultiSelect
            width={220}
            placeholder="Filtrar produto"
            searchPlaceholder="Buscar produto..."
            options={produtoOpcoes}
            selected={produtoFiltro}
            onChange={setProdutoFiltro}
          />
          <div>
            <div className="bi-stat-label">Total VOL</div>
            <div className="font-display text-lg font-bold tabular-nums">
              {totais.vol.toLocaleString("pt-BR")}
            </div>
          </div>
          <div>
            <div className="bi-stat-label">Total R$</div>
            <div className="font-display text-lg font-bold tabular-nums text-primary">
              {formatBRL(totais.valor)}
            </div>
          </div>
          <button
            onClick={exportar}
            className="h-9 px-3 rounded-md bg-secondary hover:bg-secondary/80 text-secondary-foreground font-semibold text-xs flex items-center gap-2"
          >
            <FileDown className="h-4 w-4" /> Exportar Excel
          </button>
        </div>
      </header>
      <div className="overflow-x-auto">
        <table className="bi-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Nº Pedido</th>
              <th>Data Emissão</th>
              <th>Previsão Entrega</th>
              <th>Produto</th>
              <th className="text-right">Preço Unit.</th>
              <th className="text-right">Pend em aberto (VOL)</th>
              <th className="text-right">Pend em aberto (R$)</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="text-center text-muted-foreground py-10">
                  Carregando…
                </td>
              </tr>
            )}
            {!isLoading && filtrados.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-muted-foreground py-8">
                  Nenhuma pendência registrada.
                </td>
              </tr>
            )}
            {filtrados.map((i) => (
              <tr key={i.id}>
                <td className="font-medium">{i.cliente}</td>
                <td className="text-xs tabular-nums text-muted-foreground">
                  {i.numeroPedido || "—"}
                </td>
                <td className="text-xs tabular-nums">
                  {i.dataEmissao ? formatDateBR(i.dataEmissao) : "—"}
                </td>
                <td className="text-xs tabular-nums">
                  {i.dataEntrega ? formatDateBR(i.dataEntrega) : "—"}
                </td>
                <td>{i.produto || "—"}</td>
                <td className="text-right tabular-nums">
                  {i.precoUnitario ? formatBRL(i.precoUnitario) : "—"}
                </td>
                <td className="text-right tabular-nums">{i.quantidade.toLocaleString("pt-BR")}</td>
                <td className="text-right tabular-nums font-semibold">{formatBRL(i.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
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
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
          gap: 16,
          marginBottom: 24,
        }}
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
              <th style={{ textAlign: "right", padding: "10px 14px", fontWeight: 700 }}>
                Faturado
              </th>
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
