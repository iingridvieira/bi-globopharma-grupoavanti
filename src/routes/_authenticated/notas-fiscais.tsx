import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDateBR, MESES_BR } from "@/lib/format";
import { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { SmallStyles } from "./pedidos";
import { ChevronDown, ChevronRight, Search, X, FileDown, MessageSquareText, ImageDown } from "lucide-react";
import { MultiSelect } from "@/components/MultiSelect";
import { ColumnFilterHeader, ClearFiltersButton, useColumnFilters } from "@/components/ColumnFilterHeader";
import { ClienteLink } from "@/components/ClienteLink";
import { EntregasReportCard, type EntregaReportRow } from "@/components/EntregasReportCard";
import { useAuth } from "@/hooks/use-auth";
import { exportToExcel } from "@/lib/excel";
import { toPng } from "html-to-image";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/notas-fiscais")({ component: NFsPage });



const RESPONSAVEIS: Record<string, string[]> = {
  Alexandre: ["ANDORINHA", "BANDEIRANTES", "DISMAP", "IMPACTA MED", "MAXIFARMA", "NÚCLEO FARMA", "DISMED", "MED VALLE", "GEMELI"],
  Eduardo: ["CAMPEÃ", "CG MEDICAMENTOS", "DF COMERCIAL", "FARMA CONDE", "MEDLOG"],
};

function normNome(s: string): string {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

const EDITOR_ENTREGAS_EMAIL = "avantipharma.comercial@gmail.com";

function NFsPage() {
  const { restrictedClientes, user } = useAuth();
  const canEditEntregas = (user?.email ?? "").toLowerCase() === EDITOR_ENTREGAS_EMAIL;
  const qc = useQueryClient();
  const allowedNameSet = useMemo(
    () => (restrictedClientes ? new Set(restrictedClientes.map(normNome)) : null),
    [restrictedClientes],
  );
  const now = new Date();
  const [meses, setMeses] = useState<string[]>([String(now.getMonth() + 1)]);
  const [anos, setAnos] = useState<string[]>([String(now.getFullYear())]);
  const [clientesSel, setClientesSel] = useState<string[]>([]);
  const [responsavel, setResponsavel] = useState<string>("");
  const [busca, setBusca] = useState("");
  const [operacoes, setOperacoes] = useState<string[]>([]);
  const [statusEntrega, setStatusEntrega] = useState<string[]>([]);
  const [produtosSel, setProdutosSel] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  const buscaTrim = busca.trim();
  const anoAtual = now.getFullYear();
  const anosOpcoes = [anoAtual - 2, anoAtual - 1, anoAtual, anoAtual + 1];

  const { data: clientes } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => (await supabase.from("clientes").select("id,nome").order("nome")).data ?? [],
  });

  // Quando busca por produto, primeiro coleta nota_fiscal_ids dos itens que casam.
  const { data: nfIdsPorProduto } = useQuery({
    queryKey: ["nf-ids-produto", buscaTrim],
    enabled: buscaTrim.length >= 2,
    queryFn: async () => {
      const term = `%${buscaTrim}%`;
      const { data } = await supabase
        .from("itens_nf")
        .select("nota_fiscal_id")
        .or(`produto.ilike.${term},codigo_produto.ilike.${term}`)
        .limit(5000);
      return Array.from(new Set((data ?? []).map((r) => r.nota_fiscal_id)));
    },
  });

  // Lista de produtos distintos para o filtro estilo Excel
  const { data: produtosOpcoes } = useQuery({
    queryKey: ["produtos-distintos"],
    queryFn: async () => {
      const set = new Set<string>();
      const PAGE = 1000;
      for (let from = 0; from < 50000; from += PAGE) {
        const { data, error } = await supabase
          .from("itens_nf")
          .select("produto")
          .not("produto", "is", null)
          .order("produto", { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) break;
        const rows = data ?? [];
        rows.forEach((r) => { const p = (r.produto ?? "").trim(); if (p) set.add(p); });
        if (rows.length < PAGE) break;
      }
      return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
    },
    staleTime: 5 * 60 * 1000,
  });

  // NF ids dos produtos selecionados no filtro
  const { data: nfIdsPorProdutosSel } = useQuery({
    queryKey: ["nf-ids-produtos-sel", produtosSel.slice().sort().join("|")],
    enabled: produtosSel.length > 0,
    queryFn: async () => {
      const ids = new Set<string>();
      const BATCH = 100;
      for (let i = 0; i < produtosSel.length; i += BATCH) {
        const { data } = await supabase
          .from("itens_nf")
          .select("nota_fiscal_id")
          .in("produto", produtosSel.slice(i, i + BATCH))
          .limit(20000);
        (data ?? []).forEach((r) => ids.add(r.nota_fiscal_id));
      }
      return Array.from(ids);
    },
  });


  const { data: nfs, isLoading } = useQuery({
    queryKey: ["nfs", anos, meses, clientesSel, buscaTrim, nfIdsPorProduto, produtosSel, nfIdsPorProdutosSel, (clientes ?? []).length],
    enabled: produtosSel.length === 0 || (nfIdsPorProdutosSel != null),
    queryFn: async () => {
      let q = supabase.from("notas_fiscais")
        .select("id,data,numero,valor,desconto,cliente_id,observacao,clientes(nome)")
        .order("data", { ascending: false })
        .limit(5000);

      // Período: meses/anos selecionados (nenhum selecionado = todo período)
      const anosNum = anos.map(Number);
      const mesesNum = meses.map(Number);
      if (anosNum.length > 0 || mesesNum.length > 0) {
        const anosAplicar = anosNum.length > 0 ? anosNum : anosOpcoes;
        const mesesAplicar = mesesNum.length > 0 ? mesesNum : Array.from({ length: 12 }, (_, i) => i + 1);
        const ranges: string[] = [];
        anosAplicar.forEach((a) => {
          mesesAplicar.forEach((m) => {
            const start = `${a}-${String(m).padStart(2, "0")}-01`;
            const end = new Date(a, m, 0).toISOString().slice(0, 10);
            ranges.push(`and(data.gte.${start},data.lte.${end})`);
          });
        });
        if (ranges.length > 0) q = q.or(ranges.join(","));
      }

      if (clientesSel.length > 0) q = q.in("cliente_id", clientesSel);

      if (buscaTrim.length >= 2) {
        const orParts: string[] = [`numero.ilike.%${buscaTrim}%`];
        if (nfIdsPorProduto && nfIdsPorProduto.length > 0) {
          orParts.push(`id.in.(${nfIdsPorProduto.join(",")})`);
        }
        const buscaNorm = normNome(buscaTrim);
        const clienteIdsBusca = (clientes ?? [])
          .filter((c) => normNome(c.nome).includes(buscaNorm))
          .map((c) => c.id);
        if (clienteIdsBusca.length > 0) {
          orParts.push(`cliente_id.in.(${clienteIdsBusca.join(",")})`);
        }
        q = q.or(orParts.join(","));
      }


      if (produtosSel.length > 0) {
        const ids = nfIdsPorProdutosSel ?? [];
        if (ids.length === 0) return [];
        q = q.in("id", ids);
      }

      const { data } = await q;
      return data ?? [];
    },
  });


  const clientesPorResponsavel = useMemo(() => {
    const map: Record<string, Set<string>> = { Alexandre: new Set(), Eduardo: new Set(), Paulo: new Set() };
    const alexNorm = RESPONSAVEIS.Alexandre.map(normNome);
    const eduNorm = RESPONSAVEIS.Eduardo.map(normNome);
    (clientes ?? []).forEach((c) => {
      const n = normNome(c.nome);
      if (alexNorm.includes(n)) map.Alexandre.add(c.id);
      else if (eduNorm.includes(n)) map.Eduardo.add(c.id);
      else map.Paulo.add(c.id);
    });
    return map;
  }, [clientes]);

  const allowedIdSet = useMemo(() => {
    if (!allowedNameSet) return null;
    const s = new Set<string>();
    (clientes ?? []).forEach((c) => { if (allowedNameSet.has(normNome(c.nome))) s.add(c.id); });
    return s;
  }, [allowedNameSet, clientes]);

  const numerosNFAll = useMemo(() => (nfs ?? []).map((n) => n.numero), [nfs]);
  const { data: entregasMap } = useQuery({
    queryKey: ["nf-entregas", numerosNFAll.slice().sort().join("|")],
    enabled: numerosNFAll.length > 0,
    queryFn: async () => {
      const map: Record<string, { status: string; data_entrega: string | null; data_agendamento: string | null; previsao_entrega: string | null }> = {};
      const BATCH = 500;
      for (let i = 0; i < numerosNFAll.length; i += BATCH) {
        const { data } = await supabase
          .from("nf_entregas")
          .select("numero,status,data_entrega,data_agendamento,previsao_entrega")
          .in("numero", numerosNFAll.slice(i, i + BATCH));
        (data ?? []).forEach((d) => { map[d.numero] = d; });
      }
      return map;
    },
  });

  const filtradas = useMemo(() => {
    const respSet = responsavel ? clientesPorResponsavel[responsavel] : null;
    return (nfs ?? []).filter((n) => {
      const v = Number(n.valor);
      if (operacoes.length > 0) {
        const tipo = v > 0 ? "venda" : "bonificacao";
        if (!operacoes.includes(tipo)) return false;
      }
      if (respSet && !respSet.has(n.cliente_id)) return false;
      if (allowedIdSet && !allowedIdSet.has(n.cliente_id)) return false;
      if (statusEntrega.length > 0) {
        const s = entregasMap?.[n.numero]?.status ?? "Não Coletada";
        if (!statusEntrega.includes(s)) return false;
      }
      return true;
    });
  }, [nfs, operacoes, responsavel, clientesPorResponsavel, allowedIdSet, statusEntrega, entregasMap]);


  const buscaAtiva = buscaTrim.length >= 2;
  const usaItens = produtosSel.length > 0 || (buscaAtiva && (nfIdsPorProduto?.length ?? 0) > 0);
  const idsFiltradas = useMemo(() => filtradas.map((n) => n.id), [filtradas]);

  // NFs que casaram com a busca por número da NF ou nome do cliente (não por produto)
  const nfsMatchOutro = useMemo(() => {
    const s = new Set<string>();
    if (!buscaAtiva) return s;
    const b = buscaTrim.toLowerCase();
    const bNorm = normNome(buscaTrim);
    (nfs ?? []).forEach((n) => {
      if ((n.numero ?? "").toLowerCase().includes(b)) s.add(n.id);
      else if (bNorm && normNome(n.clientes?.nome ?? "").includes(bNorm)) s.add(n.id);
    });
    return s;
  }, [nfs, buscaAtiva, buscaTrim]);

  // Itens das NFs filtradas — para o subtotal estilo SUBTOTAL do Excel
  const { data: itensFiltrados } = useQuery({
    queryKey: ["itens-nfs-filtradas", idsFiltradas.slice().sort().join("|")],
    enabled: usaItens && idsFiltradas.length > 0,
    queryFn: async () => {
      const out: { nota_fiscal_id: string; produto: string | null; codigo_produto: string | null; valor_total: number }[] = [];
      const BATCH = 150;
      for (let i = 0; i < idsFiltradas.length; i += BATCH) {
        const { data } = await supabase
          .from("itens_nf")
          .select("nota_fiscal_id,produto,codigo_produto,valor_total")
          .in("nota_fiscal_id", idsFiltradas.slice(i, i + BATCH));
        out.push(...((data ?? []) as typeof out));
      }
      return out;
    },
  });

  // Total estilo SUBTOTAL: considera apenas os itens que casam com a pesquisa/filtro de produto
  const total = useMemo(() => {
    if (!usaItens || !itensFiltrados) {
      return filtradas.reduce((a, n) => a + Number(n.valor), 0);
    }
    const b = buscaTrim.toLowerCase();
    const prodSet = new Set(produtosSel.map((p) => p.trim()));
    const buscaOk = (it: { produto: string | null; codigo_produto: string | null }) =>
      !buscaAtiva || (it.produto ?? "").toLowerCase().includes(b) || (it.codigo_produto ?? "").toLowerCase().includes(b);
    const prodOk = (it: { produto: string | null }) =>
      prodSet.size === 0 || prodSet.has((it.produto ?? "").trim());
    const porNf = new Map<string, number>();
    itensFiltrados.forEach((it) => {
      const matchedOutro = nfsMatchOutro.has(it.nota_fiscal_id);
      let conta: boolean;
      if (prodSet.size > 0) conta = prodOk(it) && (matchedOutro || buscaOk(it));
      else conta = matchedOutro ? false : buscaOk(it);
      if (!conta) return;
      porNf.set(it.nota_fiscal_id, (porNf.get(it.nota_fiscal_id) ?? 0) + Number(it.valor_total));
    });
    let soma = 0;
    filtradas.forEach((n) => {
      const matchedOutro = nfsMatchOutro.has(n.id);
      if (prodSet.size === 0 && matchedOutro) soma += Number(n.valor);
      else soma += porNf.get(n.id) ?? 0;
    });
    return soma;
  }, [usaItens, itensFiltrados, filtradas, buscaTrim, buscaAtiva, produtosSel, nfsMatchOutro]);

  // Total geral de todas as NFs (ignora pesquisa e filtros; respeita restrições de acesso)
  const { data: totalGeral } = useQuery({
    queryKey: ["nfs-total-geral", restrictedClientes?.join("|") ?? "all", allowedIdSet ? allowedIdSet.size : -1],
    enabled: !allowedNameSet || (allowedIdSet != null && (clientes ?? []).length > 0),
    queryFn: async () => {
      let sum = 0;
      const PAGE = 1000;
      for (let from = 0; from < 100000; from += PAGE) {
        const { data, error } = await supabase
          .from("notas_fiscais")
          .select("valor,cliente_id")
          .range(from, from + PAGE - 1);
        if (error) break;
        const rows = data ?? [];
        rows.forEach((r) => {
          if (!allowedIdSet || allowedIdSet.has(r.cliente_id)) sum += Number(r.valor);
        });
        if (rows.length < PAGE) break;
      }
      return sum;
    },
  });

  const totalVendas = useMemo(() => filtradas.filter((n) => Number(n.valor) > 0).length, [filtradas]);
  const totalBonif = useMemo(() => filtradas.filter((n) => Number(n.valor) <= 0).length, [filtradas]);

  // Enriched rows + column-level Excel-style filters
  type NfRow = typeof filtradas[number];
  const colGetters = useMemo(() => ({
    data: (n: NfRow) => formatDateBR(n.data),
    numero: (n: NfRow) => String(n.numero ?? ""),
    cliente: (n: NfRow) => n.clientes?.nome ?? "",
    status: (n: NfRow) => entregasMap?.[n.numero]?.status ?? "Não Coletada",
    lead: (n: NfRow) => {
      const e = entregasMap?.[n.numero];
      const d = e?.data_entrega ?? e?.data_agendamento ?? e?.previsao_entrega ?? null;
      if (!d || !n.data) return "";
      const ms = new Date(d).getTime() - new Date(n.data).getTime();
      return Number.isFinite(ms) ? String(Math.round(ms / 86400000)) : "";
    },
    dataEntrega: (n: NfRow) => {
      const e = entregasMap?.[n.numero];
      const d = e?.data_entrega ?? e?.data_agendamento ?? e?.previsao_entrega ?? null;
      return d ? formatDateBR(d) : "";
    },
    operacao: (n: NfRow) => (Number(n.valor) > 0 ? "Venda" : "Bonificação"),
    valor: (n: NfRow) => String(n.valor ?? 0),
  }), [entregasMap]);
  const colTypes = useMemo(() => ({
    data: "date" as const, numero: "text" as const, cliente: "text" as const,
    status: "text" as const, lead: "number" as const, dataEntrega: "date" as const,
    operacao: "text" as const, valor: "number" as const,
  }), []);
  const { view, distinct, filters: colFilters, sorts: colSorts, setFilter: setColFilter, setSort: setColSort, reset: resetColFilters } =
    useColumnFilters(filtradas, colGetters, colTypes);

  function toggle(id: string) {
    setExpanded((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  const allVisibleSelected = view.length > 0 && view.every((n) => selectedIds.has(n.id));
  const someVisibleSelected = view.some((n) => selectedIds.has(n.id));

  function toggleSelectAllVisible() {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (allVisibleSelected) view.forEach((f) => n.delete(f.id));
      else view.forEach((f) => n.add(f.id));
      return n;
    });
  }


  async function exportarSelecionadas() {
    const selecionadas = filtradas.filter((n) => selectedIds.has(n.id));
    if (selecionadas.length === 0) return;
    setExporting(true);
    try {
      const ids = selecionadas.map((n) => n.id);
      const itensAll: { nota_fiscal_id: string; produto: string | null; quantidade: number | string; valor_unitario: number | string; valor_total: number | string; ean?: string | null }[] = [];
      const BATCH = 150;
      for (let i = 0; i < ids.length; i += BATCH) {
        const { data } = await supabase.from("itens_nf").select("*").in("nota_fiscal_id", ids.slice(i, i + BATCH));
        itensAll.push(...((data ?? []) as typeof itensAll));
      }
      const produtos = Array.from(new Set(itensAll.map((i) => (i.produto ?? "").trim()).filter(Boolean)));
      const eanMap: Record<string, string> = {};
      if (produtos.length > 0) {
        const [a, b] = await Promise.all([
          supabase.from("pendencias_produtos").select("produto,ean").in("produto", produtos).not("ean", "is", null),
          supabase.from("pendencias_anteriores_produtos").select("produto,ean").in("produto", produtos).not("ean", "is", null),
        ]);
        [...(a.data ?? []), ...(b.data ?? [])].forEach((r: { produto: string | null; ean: string | null }) => {
          const p = (r.produto ?? "").trim();
          if (p && r.ean && !eanMap[p]) eanMap[p] = r.ean;
        });
      }
      const nfById = new Map(selecionadas.map((n) => [n.id, n]));
      // Buscar entregas das NFs selecionadas
      const numerosSel = selecionadas.map((n) => n.numero);
      const entregasSelMap: Record<string, { status: string; data_entrega: string | null; data_agendamento: string | null; previsao_entrega: string | null }> = {};
      const BATCH_E = 500;
      for (let i = 0; i < numerosSel.length; i += BATCH_E) {
        const { data } = await supabase
          .from("nf_entregas")
          .select("numero,status,data_entrega,data_agendamento,previsao_entrega")
          .in("numero", numerosSel.slice(i, i + BATCH_E));
        (data ?? []).forEach((d) => { entregasSelMap[d.numero] = d; });
      }
      const rows = itensAll.map((i) => {
        const nf = nfById.get(i.nota_fiscal_id);
        const ent = nf ? entregasSelMap[nf.numero] : undefined;
        const dataEnt = ent?.data_entrega ?? ent?.data_agendamento ?? ent?.previsao_entrega ?? null;
        const lead = (dataEnt && nf?.data)
          ? Math.round((new Date(dataEnt).getTime() - new Date(nf.data).getTime()) / 86400000)
          : null;
        return {
          "Data de Faturamento": nf ? formatDateBR(nf.data) : "",
          "NF": nf?.numero ?? "",
          "Cliente": nf?.clientes?.nome ?? "",
          "EAN": i.ean ?? eanMap[(i.produto ?? "").trim()] ?? "",
          "Descrição do Produto": i.produto ?? "",
          "Quantidade": Number(i.quantidade ?? 0),
          "Valor": Number(i.valor_unitario ?? 0),
          "Total": Number(i.valor_total ?? 0),
          "Status Entrega": ent?.status ?? "Não Coletada",
          "Lead Time (dias)": lead ?? "",
          "Data Entrega": dataEnt ? formatDateBR(dataEnt) : "",
          "Observação": (nf as { observacao?: string | null } | undefined)?.observacao ?? "",
        };
      });
      if (rows.length === 0) { toast.error("Nenhum item para exportar."); return; }
      exportToExcel(rows, `nfs-selecionadas-${selecionadas.length}.xlsx`, "Itens");
      toast.success(`${selecionadas.length} NF(s) exportadas.`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao exportar.");
    } finally {
      setExporting(false);
    }
  }

  // ===== Relatório de entregas em PNG (mês selecionado) =====
  const entregasReportRows = useMemo<EntregaReportRow[]>(
    () =>
      view.map((n) => {
        const e = entregasMap?.[n.numero];
        const d = e?.data_entrega ?? e?.data_agendamento ?? e?.previsao_entrega ?? null;
        const dias = d && n.data ? Math.round((new Date(d).getTime() - new Date(n.data).getTime()) / 86400000) : null;
        return {
          numero: String(n.numero ?? ""),
          cliente: n.clientes?.nome ?? "",
          dataFaturamento: formatDateBR(n.data),
          dataEntrega: d ? formatDateBR(d) : "",
          dias: dias != null && Number.isFinite(dias) ? dias : null,
          status: e?.status ?? "Não Coletada",
        };
      }),
    [view, entregasMap],
  );

  const periodoLabel = useMemo(() => {
    const anosLbl = anos.length > 0 ? anos.slice().sort().join(", ") : "Todos os anos";
    const mesesLbl = meses.length > 0 ? meses.map((m) => MESES_BR[Number(m) - 1]).join(", ") : "Todos os meses";
    return `${mesesLbl} · ${anosLbl}`;
  }, [meses, anos]);

  const reportRef = useRef<HTMLDivElement>(null);
  const [exportingPng, setExportingPng] = useState(false);

  async function exportarRelatorioEntregasPNG() {
    if (!reportRef.current) return;
    if (entregasReportRows.length === 0) { toast.error("Nenhuma NF no período selecionado."); return; }
    setExportingPng(true);
    try {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const dataUrl = await toPng(reportRef.current, { pixelRatio: 2, cacheBust: true, backgroundColor: "#0E0F0C" });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `relatorio-entregas-${periodoLabel.replace(/[^\w]+/g, "-").toLowerCase()}.png`;
      a.click();
      toast.success("Relatório de entregas gerado");
    } catch (e) {
      toast.error("Erro ao gerar imagem: " + (e as Error).message);
    } finally {
      setExportingPng(false);
    }
  }

  function limparFiltros() {
    setBusca(""); setClientesSel([]); setOperacoes([]); setResponsavel(""); setStatusEntrega([]); setProdutosSel([]);
  }




  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">Notas Fiscais Faturadas</h1>
        <button
          type="button"
          onClick={() => void exportarRelatorioEntregasPNG()}
          disabled={exportingPng}
          className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/20 disabled:opacity-50"
          title="Exportar relatório de entregas do período selecionado (PNG)"
        >
          <ImageDown className="h-4 w-4" /> {exportingPng ? "Gerando…" : "Relatório de Entregas (PNG)"}
        </button>
      </div>

      <p className="text-muted-foreground mt-1">Pesquise por NF ou produto. Filtre por período, cliente e operação. Clique em uma linha para ver os itens.</p>

      {/* Barra de busca */}
      <div className="bi-card mt-6 p-4 space-y-3">
        <div className="relative">
          {!busca && (
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          )}
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="          Pesquisar por número da NF, produto ou código..."
            className={`bi-input-sm w-full pr-10 ${busca ? 'pl-3' : 'pl-10'}`}
            style={{ height: 44 }}
          />
          {busca && (
            <button onClick={() => setBusca("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <MultiSelect
            width={200}
            placeholder="Meses (todos)"
            options={MESES_BR.map((m, i) => ({ value: String(i + 1), label: m }))}
            selected={meses}
            onChange={setMeses}
          />
          <MultiSelect
            width={160}
            placeholder="Anos (todos)"
            options={anosOpcoes.map((a) => ({ value: String(a), label: String(a) }))}
            selected={anos}
            onChange={setAnos}
          />

          <MultiSelect
            width={260}
            placeholder="Todos os clientes"
            options={(clientes ?? []).filter((c) => !allowedNameSet || allowedNameSet.has(normNome(c.nome))).map((c) => ({ value: c.id, label: c.nome }))}
            selected={clientesSel}
            onChange={setClientesSel}
          />

          <MultiSelect
            width={180}
            placeholder="Operações"
            options={[
              { value: "venda", label: "Venda" },
              { value: "bonificacao", label: "Bonificação" },
            ]}
            selected={operacoes}
            onChange={setOperacoes}
          />

          <MultiSelect
            width={200}
            placeholder="Status entrega"
            options={STATUS_OPCOES.map((s) => ({ value: s, label: s }))}
            selected={statusEntrega}
            onChange={setStatusEntrega}
          />

          <MultiSelect
            width={280}
            placeholder="Produtos"
            searchPlaceholder="Buscar produto..."
            resizable
            options={(produtosOpcoes ?? []).map((p) => ({ value: p, label: p }))}
            selected={produtosSel}
            onChange={setProdutosSel}
          />

          <select value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className="bi-input-sm w-44">
            <option value="">Representantes</option>
            <option value="Alexandre">Alexandre</option>
            <option value="Eduardo">Eduardo</option>
            <option value="Paulo">Paulo</option>
          </select>

          {(busca || clientesSel.length > 0 || operacoes.length > 0 || responsavel || statusEntrega.length > 0 || produtosSel.length > 0) && (
            <button onClick={limparFiltros} className="text-sm text-primary hover:underline">
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        <div className="bi-card p-4">
          <div className="bi-stat-label">NFs encontradas</div>
          <div className="text-2xl font-bold tabular-nums mt-1">{filtradas.length.toLocaleString("pt-BR")}</div>
        </div>
        <div className="bi-card p-4">
          <div className="bi-stat-label">Total faturado (filtros aplicados)</div>
          <div className="text-2xl font-bold tabular-nums mt-1 text-primary">{formatBRL(total)}</div>
        </div>
        <div className="bi-card p-4">
          <div className="bi-stat-label">Operações</div>
          <div className="text-2xl font-bold tabular-nums mt-1">
            <span className="text-success">{totalVendas}</span>
            <span className="text-muted-foreground text-base mx-1">venda</span>
            <span className="text-warning">{totalBonif}</span>
            <span className="text-muted-foreground text-base ml-1">bonif.</span>
          </div>
        </div>
      </div>

      <div className="bi-card mt-4 overflow-hidden">
        <div className="flex justify-end px-3 py-1.5">
          <ClearFiltersButton filters={colFilters} sorts={colSorts} onReset={resetColFilters} />
        </div>
        <table className="bi-table">
          <thead>
            <tr>
              <th style={{ width: 32 }}>
                <input
                  type="checkbox"
                  aria-label="Selecionar todas visíveis"
                  checked={allVisibleSelected}
                  ref={(el) => { if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected; }}
                  onChange={toggleSelectAllVisible}
                  className="cursor-pointer"
                />
              </th>
              <th style={{ width: 38 }}></th>
              <th><ColumnFilterHeader label="Data" type="date" values={distinct.data ?? []} selected={colFilters.data ?? []} onChange={(v) => setColFilter("data", v)} sort={colSorts.data ?? null} onSortChange={(s) => setColSort("data", s)} /></th>
              <th><ColumnFilterHeader label="Número" values={distinct.numero ?? []} selected={colFilters.numero ?? []} onChange={(v) => setColFilter("numero", v)} sort={colSorts.numero ?? null} onSortChange={(s) => setColSort("numero", s)} /></th>
              <th><ColumnFilterHeader label="Cliente" values={distinct.cliente ?? []} selected={colFilters.cliente ?? []} onChange={(v) => setColFilter("cliente", v)} sort={colSorts.cliente ?? null} onSortChange={(s) => setColSort("cliente", s)} /></th>
              <th className="text-center"><ColumnFilterHeader label="Status Entrega" align="center" values={distinct.status ?? []} selected={colFilters.status ?? []} onChange={(v) => setColFilter("status", v)} sort={colSorts.status ?? null} onSortChange={(s) => setColSort("status", s)} /></th>
              <th className="text-center"><ColumnFilterHeader label="Lead Time" align="center" type="number" values={distinct.lead ?? []} selected={colFilters.lead ?? []} onChange={(v) => setColFilter("lead", v)} sort={colSorts.lead ?? null} onSortChange={(s) => setColSort("lead", s)} /></th>
              <th className="text-center"><ColumnFilterHeader label="Data Entrega" align="center" type="date" values={distinct.dataEntrega ?? []} selected={colFilters.dataEntrega ?? []} onChange={(v) => setColFilter("dataEntrega", v)} sort={colSorts.dataEntrega ?? null} onSortChange={(s) => setColSort("dataEntrega", s)} /></th>
              <th className="text-center"><ColumnFilterHeader label="Operação" align="center" values={distinct.operacao ?? []} selected={colFilters.operacao ?? []} onChange={(v) => setColFilter("operacao", v)} sort={colSorts.operacao ?? null} onSortChange={(s) => setColSort("operacao", s)} /></th>
              <th className="text-right"><ColumnFilterHeader label="Valor" align="right" type="number" values={distinct.valor ?? []} selected={colFilters.valor ?? []} onChange={(v) => setColFilter("valor", v)} sort={colSorts.valor ?? null} onSortChange={(s) => setColSort("valor", s)} /></th>
              <th style={{ width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={11} className="text-center text-muted-foreground py-8">Carregando…</td></tr>}
            {!isLoading && view.map((n) => {
              const open = expanded.has(n.id);
              const isVenda = Number(n.valor) > 0;
              const entrega = entregasMap?.[n.numero];
              const dataExibida = entrega?.data_entrega ?? entrega?.data_agendamento ?? entrega?.previsao_entrega ?? null;
              const statusAtual = entrega?.status ?? "Não Coletada";
              const leadDays = (() => {
                if (!dataExibida || !n.data) return null;
                const ms = new Date(dataExibida).getTime() - new Date(n.data).getTime();
                if (!Number.isFinite(ms)) return null;
                return Math.round(ms / 86400000);
              })();
              const leadCls = leadDays == null
                ? "text-muted-foreground"
                : leadDays <= 10
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : leadDays <= 15
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : "bg-red-500/20 text-red-400 border border-red-500/30";
              const isSelected = selectedIds.has(n.id);
              return (
                <>
                  <tr key={n.id} onClick={() => toggle(n.id)} className="cursor-pointer">
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Selecionar NF ${n.numero}`}
                        checked={isSelected}
                        onChange={() => toggleSelected(n.id)}
                        className="cursor-pointer"
                      />
                    </td>
                    <td>{open ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}</td>
                    <td>{formatDateBR(n.data)}</td>
                    <td className="font-medium text-primary">
                      <span className="inline-flex items-center gap-1.5">
                        {n.numero}
                        {((n as { observacao?: string | null }).observacao ?? "").trim() && (
                          <MessageSquareText
                            className="h-3.5 w-3.5 text-amber-400"
                            aria-label="Possui observação"
                          >
                            <title>Possui observação</title>
                          </MessageSquareText>
                        )}
                      </span>
                    </td>
                    <td><ClienteLink id={n.cliente_id} nome={n.clientes?.nome} /></td>
                    <td className="text-center" onClick={(e) => e.stopPropagation()}>
                      <StatusEntregaBadge
                        numero={n.numero}
                        status={statusAtual}
                        canEdit={canEditEntregas}
                        onChanged={() => qc.invalidateQueries({ queryKey: ["nf-entregas"] })}
                      />
                    </td>
                    <td className="text-center">
                      {leadDays == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold tabular-nums ${leadCls}`}>
                          {leadDays} {leadDays === 1 ? "dia" : "dias"}
                        </span>
                      )}
                    </td>
                    <td className="text-center text-sm">
                      {dataExibida ? formatDateBR(dataExibida) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="text-center">{isVenda ? "Venda" : "Bonificação"}</td>
                    <td className="text-right tabular-nums">{formatBRL(n.valor)}</td>
                    <td className="text-right">
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          const { data: itens } = await supabase.from("itens_nf").select("*").eq("nota_fiscal_id", n.id);
                          if (!itens || itens.length === 0) { toast.error("Sem itens para exportar."); return; }
                          const produtos = Array.from(new Set(itens.map((i) => (i.produto ?? "").trim()).filter(Boolean)));
                          const eanMap: Record<string, string> = {};
                          if (produtos.length > 0) {
                            const [a, b] = await Promise.all([
                              supabase.from("pendencias_produtos").select("produto,ean").in("produto", produtos).not("ean", "is", null),
                              supabase.from("pendencias_anteriores_produtos").select("produto,ean").in("produto", produtos).not("ean", "is", null),
                            ]);
                            [...(a.data ?? []), ...(b.data ?? [])].forEach((r: { produto: string | null; ean: string | null }) => {
                              const p = (r.produto ?? "").trim();
                              if (p && r.ean && !eanMap[p]) eanMap[p] = r.ean;
                            });
                          }
                          const rows = itens.map((i) => ({
                            "Data de Faturamento": formatDateBR(n.data),
                            "EAN": (i as { ean?: string | null }).ean ?? eanMap[(i.produto ?? "").trim()] ?? "",
                            "Descrição do Produto": i.produto ?? "",
                            "Quantidade": Number(i.quantidade ?? 0),
                            "Valor": Number(i.valor_unitario ?? 0),
                            "Total": Number(i.valor_total ?? 0),
                            "Status Entrega": statusAtual,
                            "Lead Time (dias)": leadDays ?? "",
                            "Data Entrega": dataExibida ? formatDateBR(dataExibida) : "",
                            "Observação": (n as { observacao?: string | null }).observacao ?? "",
                          }));
                          exportToExcel(rows, `nf-${n.numero}-${n.clientes?.nome ?? "cliente"}.xlsx`, "Itens");
                        }}
                        className="h-7 px-2 rounded bg-secondary hover:bg-secondary/80 inline-flex items-center gap-1 text-xs"
                        title="Exportar itens em Excel"
                      >
                        <FileDown className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                  {open && <ItensRow key={n.id + "-items"} nfId={n.id} clienteId={n.cliente_id} highlight={buscaTrim} observacaoInicial={(n as { observacao?: string | null }).observacao ?? ""} onObservacaoSaved={() => qc.invalidateQueries({ queryKey: ["nfs"] })} />}
                </>
              );
            })}
            {!isLoading && view.length === 0 && <tr><td colSpan={11} className="text-center text-muted-foreground py-8">Nenhuma NF encontrada com os filtros aplicados.</td></tr>}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={11}>
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={exportarSelecionadas}
                    disabled={selectedIds.size === 0 || exporting}
                    className="h-8 px-3 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5 text-xs font-semibold"
                    title="Exportar NFs selecionadas"
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    {exporting
                      ? "Exportando..."
                      : `Exportar Selecionadas (${selectedIds.size.toLocaleString("pt-BR")})`}
                  </button>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <SmallStyles />
    </div>
  );
}

const STATUS_OPCOES = ["Entregue", "Com Previsão", "Agendada", "Não Coletada", "Extraviada", "Devolvida"] as const;

function statusClasses(s: string): string {
  switch (s) {
    case "Entregue": return "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
    case "Agendada": return "bg-blue-500/20 text-blue-400 border border-blue-500/30";
    case "Com Previsão": return "bg-amber-500/20 text-amber-400 border border-amber-500/30";
    case "Extraviada": return "bg-red-500/20 text-red-400 border border-red-500/30";
    case "Devolvida": return "bg-violet-500/20 text-violet-400 border border-violet-500/30";
    default: return "bg-muted text-muted-foreground border border-border";
  }
}

function StatusEntregaBadge({
  numero, status, canEdit, onChanged,
}: { numero: string; status: string; canEdit: boolean; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 4, left: r.left + r.width / 2 });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  async function change(novo: string) {
    setSaving(true);
    try {
      const { data: existing } = await supabase.from("nf_entregas").select("id").eq("numero", numero).maybeSingle();
      if (existing) {
        const { error } = await supabase.from("nf_entregas").update({ status: novo } as never).eq("numero", numero);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("nf_entregas").insert({ numero, status: novo } as never);
        if (error) throw error;
      }
      toast.success("Status atualizado");
      onChanged();
      setOpen(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar status");
    } finally {
      setSaving(false);
    }
  }

  if (!canEdit) {
    return <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${statusClasses(status)}`}>{status}</span>;
  }

  return (
    <div className="relative inline-block">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={saving}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider cursor-pointer hover:opacity-80 ${statusClasses(status)}`}
        title="Clique para alterar"
      >
        {status}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
      {open && pos && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[9999] bg-popover border border-border rounded-md shadow-lg overflow-hidden min-w-[160px] -translate-x-1/2"
            style={{ top: pos.top, left: pos.left }}
          >
            {STATUS_OPCOES.map((s) => (
              <button
                key={s}
                onClick={() => change(s)}
                disabled={saving}
                className={`block w-full text-left px-3 py-2 text-xs hover:bg-muted ${s === status ? "font-semibold text-primary" : ""}`}
              >
                {s}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

function normProduto(s: string | null | undefined): string {
  return (s ?? "").trim().toUpperCase().replace(/\s+/g, " ");
}

function quantil(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base];
}

/** Média dos preços do produto, ignorando valores "Nitro" (outliers extremos). */
function mediaSemNitro(valores: number[]): number {
  if (valores.length === 0) return NaN;
  const sorted = [...valores].sort((a, b) => a - b);
  if (sorted.length <= 2) return sorted.reduce((s, v) => s + v, 0) / sorted.length;
  const mediana = quantil(sorted, 0.5);
  let lo: number;
  let hi: number;
  if (sorted.length >= 5) {
    const q1 = quantil(sorted, 0.25);
    const q3 = quantil(sorted, 0.75);
    const iqr = q3 - q1;
    // Cerca de Tukey, alargada por banda relativa à mediana p/ não punir variação normal
    lo = Math.min(q1 - 1.5 * iqr, mediana * 0.5);
    hi = Math.max(q3 + 1.5 * iqr, mediana * 2);
  } else {
    // Poucas amostras: banda relativa à mediana
    lo = mediana / 3;
    hi = mediana * 3;
  }
  const validos = sorted.filter((v) => v >= lo && v <= hi);
  const base = validos.length > 0 ? validos : sorted;
  return base.reduce((s, v) => s + v, 0) / base.length;
}

function ItensRow({ nfId, clienteId, highlight, observacaoInicial, onObservacaoSaved }: { nfId: string; clienteId: string; highlight?: string; observacaoInicial?: string; onObservacaoSaved?: () => void }) {
  const [obs, setObs] = useState(observacaoInicial ?? "");
  const [savingObs, setSavingObs] = useState(false);
  const obsDirty = (obs ?? "") !== (observacaoInicial ?? "");

  async function salvarObs() {
    setSavingObs(true);
    try {
      const { error } = await supabase.from("notas_fiscais").update({ observacao: obs || null } as never).eq("id", nfId);
      if (error) throw error;
      toast.success("Observação salva");
      onObservacaoSaved?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar observação");
    } finally {
      setSavingObs(false);
    }
  }

  const { data: itens, isLoading } = useQuery({
    queryKey: ["nf-itens", nfId],
    queryFn: async () => (await supabase.from("itens_nf").select("*").eq("nota_fiscal_id", nfId)).data ?? [],
  });

  const produtosItens = useMemo(() => Array.from(new Set((itens ?? []).map((i) => (i.produto ?? "").trim()).filter(Boolean))), [itens]);

  const { data: eanMap } = useQuery({
    queryKey: ["ean-by-produto", produtosItens.slice().sort().join("|")],
    enabled: produtosItens.length > 0,
    queryFn: async () => {
      const out: Record<string, string> = {};
      const [a, b] = await Promise.all([
        supabase.from("pendencias_produtos").select("produto,ean").in("produto", produtosItens).not("ean", "is", null),
        supabase.from("pendencias_anteriores_produtos").select("produto,ean").in("produto", produtosItens).not("ean", "is", null),
      ]);
      [...(a.data ?? []), ...(b.data ?? [])].forEach((r: { produto: string | null; ean: string | null }) => {
        const p = (r.produto ?? "").trim();
        if (p && r.ean && !out[p]) out[p] = r.ean;
      });
      return out;
    },
  });

  const { data: ticketMap } = useQuery({
    queryKey: ["ticket-medio-produto", clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data } = await supabase
        .from("itens_nf")
        .select("produto,valor_unitario,notas_fiscais!inner(cliente_id)")
        .eq("notas_fiscais.cliente_id", clienteId)
        .limit(10000);
      // Agrupa preços por produto (nome normalizado)
      const grupos = new Map<string, number[]>();
      (data ?? []).forEach((r: { produto: string | null; valor_unitario: number | string }) => {
        const k = normProduto(r.produto);
        if (!k) return;
        const v = Number(r.valor_unitario);
        if (!Number.isFinite(v) || v <= 0) return;
        const arr = grupos.get(k) ?? [];
        arr.push(v);
        grupos.set(k, arr);
      });
      const out: Record<string, number> = {};
      grupos.forEach((valores, k) => {
        out[k] = mediaSemNitro(valores);
      });
      return out;
    },
  });

  const h = (highlight ?? "").trim().toLowerCase();
  const match = (s: string) => h.length >= 2 && s.toLowerCase().includes(h);

  return (
    <tr>
      <td colSpan={11} className="bg-muted/30 p-0">
        <div className="px-6 py-4">
          <div className="bi-stat-label mb-2">Itens da NF</div>
          {isLoading && <div className="text-sm text-muted-foreground py-2">Carregando…</div>}
          {!isLoading && itens && itens.length === 0 && <div className="text-sm text-muted-foreground py-2">Sem itens registrados. Importe a planilha de faturamento.</div>}
          {itens && itens.length > 0 && (
            <table className="bi-table">
              <thead>
                <tr>
                  <th>EAN</th><th>Produto</th>
                  <th className="text-right">Qtd</th>
                  <th className="text-right">V. Unit</th>
                  <th className="text-right">Ticket Médio</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((i) => {
                  const hit = match(i.produto ?? "") || match(i.codigo_produto ?? "");
                  const tm = ticketMap?.[normProduto(i.produto)];
                  const eanShow = eanMap?.[(i.produto ?? "").trim()] ?? (i as { ean?: string | null }).ean ?? "—";
                  return (
                    <tr key={i.id} className={hit ? "bg-primary/10" : undefined}>
                      <td className="text-xs text-muted-foreground tabular-nums">{eanShow}</td>
                      <td>{i.produto}</td>
                      <td className="text-right tabular-nums">{Number(i.quantidade).toLocaleString("pt-BR")}</td>
                      <td className="text-right tabular-nums">{formatBRL(i.valor_unitario)}</td>
                      <td className="text-right tabular-nums text-muted-foreground">{tm != null ? formatBRL(tm) : "—"}</td>
                      <td className="text-right tabular-nums font-semibold">{formatBRL(i.valor_total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <div className="mt-4">
            <div className="bi-stat-label mb-1">Observação</div>
            <div className="flex items-start gap-2">
              <textarea
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                placeholder="Adicione detalhes específicos desta NF (visível nos relatórios exportados)…"
                rows={2}
                className="bi-input-sm flex-1 resize-y min-h-[44px]"
              />
              <button
                type="button"
                onClick={salvarObs}
                disabled={!obsDirty || savingObs}
                className="h-9 px-3 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold"
              >
                {savingObs ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}
