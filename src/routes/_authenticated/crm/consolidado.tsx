import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Download, Loader2, Filter, Users } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { useMes, formatMesLabel } from "@/lib/crm/mes";
import { useUltimasCompras } from "@/lib/crm/compras";
import { ordenar, SortDropdown, type SortKey } from "@/lib/crm/sort";
import { STATUS_META, STATUS_ORDER, type ClienteStatus } from "@/lib/crm/status";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/crm/consolidado")({
  head: () => ({
    meta: [
      { title: "Consolidado | CRM · BI Avanti Pharma" },
      {
        name: "description",
        content: "Visão consolidada de todos os clientes e representadas em uma única lista.",
      },
    ],
  }),
  component: ConsolidadoPage,
});

type ClienteConsolidado = {
  id: string;
  nome: string;
  porRepresentada: Map<string, { crId: string; status: ClienteStatus }>;
};

/** Paleta discreta usada no PNG exportado (independente do tema da tela). */
const PRINT = {
  comprou: "#16a34a",
  negociacao: "#d97706",
  nao_comprou: "#dc2626",
  inativo: "#94a3b8",
} as const;

const STATUS_GLYPH: Record<ClienteStatus, string> = {
  comprou: "●",
  negociacao: "◐",
  nao_comprou: "○",
  inativo: "—",
};

function StatusDot({ status }: { status: ClienteStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      title={meta.label}
      aria-label={meta.label}
      className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${meta.bg}`}
    >
      <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
    </span>
  );
}

function ConsolidadoPage() {
  const { mes } = useMes();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("nome-asc");
  const [statusFiltro, setStatusFiltro] = useState<"todos" | ClienteStatus>("todos");
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const repsQuery = useQuery({
    queryKey: ["crm-representadas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_representadas")
        .select("id, nome, slug, ordem, logo_url")
        .order("ordem");
      if (error) throw error;
      return data;
    },
  });

  const clientesQuery = useQuery({
    queryKey: ["crm-consolidado-clientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_clientes")
        .select("id, nome, crm_cliente_representadas(id, representada_id)")
        .order("nome");
      if (error) throw error;
      return data as Array<{
        id: string;
        nome: string;
        crm_cliente_representadas: Array<{ id: string; representada_id: string }>;
      }>;
    },
  });

  const crIds = useMemo(
    () => (clientesQuery.data ?? []).flatMap((c) => c.crm_cliente_representadas.map((cr) => cr.id)),
    [clientesQuery.data],
  );

  const smQuery = useQuery({
    queryKey: ["crm-sm-consolidado", mes, crIds.length],
    enabled: crIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_status_mensal")
        .select("cliente_representada_id, status")
        .in("cliente_representada_id", crIds)
        .eq("mes_ref", mes);
      if (error) throw error;
      return data;
    },
  });

  const ultimasComprasQuery = useUltimasCompras(crIds);

  const statusByCr = new Map<string, ClienteStatus>();
  (smQuery.data ?? []).forEach((s) =>
    statusByCr.set(s.cliente_representada_id, s.status as ClienteStatus),
  );

  const clientes: ClienteConsolidado[] = useMemo(() => {
    return (clientesQuery.data ?? []).map((c) => {
      const porRepresentada = new Map<string, { crId: string; status: ClienteStatus }>();
      c.crm_cliente_representadas.forEach((cr) => {
        porRepresentada.set(cr.representada_id, {
          crId: cr.id,
          status: statusByCr.get(cr.id) ?? "nao_comprou",
        });
      });
      return { id: c.id, nome: c.nome, porRepresentada };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientesQuery.data, smQuery.data]);

  const ultimaCompraGlobal = (c: ClienteConsolidado): string | null => {
    let max: string | null = null;
    c.porRepresentada.forEach((v) => {
      const data = ultimasComprasQuery.data?.get(v.crId);
      if (data && (!max || data > max)) max = data;
    });
    return max;
  };

  const filtrados = useMemo(() => {
    const base = clientes.filter((c) => {
      if (!c.nome.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFiltro === "todos") return true;
      return [...c.porRepresentada.values()].some((v) => v.status === statusFiltro);
    });
    return ordenar(
      base,
      sort,
      (c) => c.nome,
      (c) => ultimaCompraGlobal(c),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientes, search, sort, statusFiltro, ultimasComprasQuery.data]);

  /** Só representadas que possuem ao menos um cliente vinculado entre os exibidos. */
  const reps = useMemo(() => {
    const usadas = new Set<string>();
    filtrados.forEach((c) => c.porRepresentada.forEach((_, repId) => usadas.add(repId)));
    return (repsQuery.data ?? []).filter((r) => usadas.has(r.id));
  }, [repsQuery.data, filtrados]);

  const totaisPorStatus = useMemo(() => {
    const counts: Record<ClienteStatus, number> = {
      comprou: 0,
      negociacao: 0,
      nao_comprou: 0,
      inativo: 0,
    };
    const visiveis = new Set(reps.map((r) => r.id));
    filtrados.forEach((c) =>
      c.porRepresentada.forEach((v, repId) => {
        if (visiveis.has(repId)) counts[v.status] += 1;
      }),
    );

    return counts;
  }, [filtrados, reps]);

  const geradoEm = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  async function exportarPng() {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(reportRef.current, {
        pixelRatio: 3,
        cacheBust: true,
        backgroundColor: "#ffffff",
      });
      const link = document.createElement("a");
      link.download = `crm-consolidado-${mes}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Relatório exportado");
    } catch (e: any) {
      toast.error("Não foi possível exportar a imagem: " + e.message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Consolidado</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Todos os clientes e representadas em uma visão única · {formatMesLabel(mes)}
          </p>
        </div>
        <Button onClick={exportarPng} disabled={exporting || filtrados.length === 0}>
          {exporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Exportar PNG
        </Button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="p-4 bg-card border-border shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
            <Users className="h-3.5 w-3.5" /> Clientes
          </div>
          <p className="text-2xl font-semibold mt-1 tabular-nums">{filtrados.length}</p>
        </Card>
        {STATUS_ORDER.map((s) => (
          <Card key={s} className="p-4 bg-card border-border shadow-sm">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
              <span className={`h-2 w-2 rounded-full ${STATUS_META[s].dot}`} />
              <span className="truncate">{STATUS_META[s].label}</span>
            </div>
            <p className="text-2xl font-semibold mt-1 tabular-nums">{totaisPorStatus[s]}</p>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <Card className="p-3 bg-card border-border shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente..."
              className="pl-9 h-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFiltro} onValueChange={(v) => setStatusFiltro(v as any)}>
            <SelectTrigger className="h-9 w-full sm:w-[200px]">
              <Filter className="h-4 w-4 mr-1.5 text-muted-foreground shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {STATUS_ORDER.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_META[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <SortDropdown value={sort} onChange={setSort} comCompra />
        </div>
      </Card>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
        {STATUS_ORDER.map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${STATUS_META[s].dot}`} />
            {STATUS_META[s].label}
          </span>
        ))}
      </div>

      {filtrados.length === 0 || reps.length === 0 ? (
        <Card className="p-12 text-center bg-card border-border shadow-sm">
          <p className="text-muted-foreground">
            {clientesQuery.isLoading ? "Carregando..." : "Nenhum cliente encontrado."}
          </p>
        </Card>
      ) : (
        <Card className="bg-card border-border shadow-sm overflow-hidden p-0">
          <div className="max-h-[65vh] overflow-auto">
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead className="sticky top-0 z-20">
                <tr>
                  <th className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground px-4 py-3 bg-muted/70 backdrop-blur border-b border-border sticky left-0 z-30">
                    Cliente
                  </th>
                  {reps.map((r) => (
                    <th
                      key={r.id}
                      className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground px-4 py-3 bg-muted/70 backdrop-blur border-b border-border whitespace-nowrap"
                    >
                      {r.nome}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => (
                  <tr key={c.id} className="group hover:bg-accent/50 transition-colors">
                    <td className="px-4 py-2.5 border-b border-border/60 font-medium whitespace-nowrap sticky left-0 bg-card group-hover:bg-accent/50 transition-colors">
                      {c.nome}
                    </td>
                    {reps.map((r) => {
                      const v = c.porRepresentada.get(r.id);
                      return (
                        <td
                          key={r.id}
                          className="px-4 py-2.5 border-b border-border/60 text-center align-middle"
                        >
                          {v ? (
                            <div className="flex justify-center">
                              <StatusDot status={v.status} />
                            </div>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Relatório para exportação (fora da tela) */}
      <div className="fixed -left-[10000px] top-0 pointer-events-none" aria-hidden>
        <div
          ref={reportRef}
          style={{
            background: "#ffffff",
            color: "#0f172a",
            padding: "48px",
            fontFamily:
              "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
            width: "max-content",
            minWidth: "720px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              borderBottom: "2px solid #0f172a",
              paddingBottom: "16px",
              marginBottom: "24px",
              gap: "48px",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "11px",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "#64748b",
                  fontWeight: 600,
                }}
              >
                CRM · BI Avanti Pharma
              </div>
              <div style={{ fontSize: "26px", fontWeight: 700, marginTop: "4px" }}>
                Relatório Consolidado
              </div>
              <div style={{ fontSize: "14px", color: "#475569", marginTop: "2px" }}>
                Período: {formatMesLabel(mes)}
              </div>
            </div>
            <div style={{ textAlign: "right", fontSize: "12px", color: "#64748b" }}>
              <div>Gerado em {geradoEm}</div>
              <div style={{ marginTop: "2px" }}>{filtrados.length} clientes</div>
            </div>
          </div>

          <table style={{ borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: "#f1f5f9" }}>
                <th
                  style={{
                    textAlign: "left",
                    padding: "10px 16px",
                    fontSize: "11px",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "#475569",
                    borderBottom: "1px solid #cbd5e1",
                    whiteSpace: "nowrap",
                  }}
                >
                  Cliente
                </th>
                {reps.map((r) => (
                  <th
                    key={r.id}
                    style={{
                      textAlign: "center",
                      padding: "10px 20px",
                      fontSize: "11px",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "#475569",
                      borderBottom: "1px solid #cbd5e1",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.nome}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c, i) => (
                <tr key={c.id} style={{ background: i % 2 ? "#f8fafc" : "#ffffff" }}>
                  <td
                    style={{
                      padding: "9px 16px",
                      fontWeight: 500,
                      borderBottom: "1px solid #e2e8f0",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.nome}
                  </td>
                  {reps.map((r) => {
                    const v = c.porRepresentada.get(r.id);
                    return (
                      <td
                        key={r.id}
                        style={{
                          padding: "9px 20px",
                          textAlign: "center",
                          borderBottom: "1px solid #e2e8f0",
                          color: v ? PRINT[v.status] : "transparent",
                          fontSize: "15px",
                          lineHeight: 1,
                        }}
                      >
                        {v ? STATUS_GLYPH[v.status] : ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <div
            style={{
              display: "flex",
              gap: "24px",
              marginTop: "22px",
              fontSize: "12px",
              color: "#475569",
              flexWrap: "wrap",
            }}
          >
            {STATUS_ORDER.map((s) => (
              <span key={s} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ color: PRINT[s], fontSize: "14px", lineHeight: 1 }}>
                  {STATUS_GLYPH[s]}
                </span>
                {STATUS_META[s].label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
