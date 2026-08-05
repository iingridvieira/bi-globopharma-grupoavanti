import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDateBR, formatNumberBR, MESES_BR } from "@/lib/format";
import { MultiSelect } from "@/components/MultiSelect";
import {
  ColumnFilterHeader,
  ClearFiltersButton,
  useColumnFilters,
} from "@/components/ColumnFilterHeader";
import { exportToExcel } from "@/lib/excel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ChevronDown,
  ChevronRight,
  FileDown,
  Search,
  X,
  Settings2,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/imec/notas-fiscais")({
  head: () => ({
    meta: [
      { title: "Notas Fiscais · BI IMEC" },
      {
        name: "description",
        content: "Notas fiscais de faturamento IMEC e NUTIVIT com itens e exportação.",
      },
    ],
  }),
  component: ImecNFsPage,
});

const EMPRESAS = ["IMEC", "NUTIVIT"];

type NF = {
  id: string;
  data: string;
  numero: string;
  empresa: string;
  valor: number | string;
  cliente_id: string;
  razao_social: string | null;
  imec_clientes: { nome: string } | null;
};

type ItemNF = {
  nota_fiscal_id: string;
  ean: string | null;
  codigo_produto: string | null;
  produto: string | null;
  quantidade: number | string;
  valor_unitario: number | string;
  valor_total: number | string;
};

function norm(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function ImecNFsPage() {
  const now = new Date();
  const anoAtual = now.getFullYear();
  const anosOpcoes = [anoAtual - 2, anoAtual - 1, anoAtual, anoAtual + 1];
  const [meses, setMeses] = useState<string[]>([String(now.getMonth() + 1)]);
  const [anos, setAnos] = useState<string[]>([String(anoAtual)]);
  const [clientesSel, setClientesSel] = useState<string[]>([]);
  const [empresasSel, setEmpresasSel] = useState<string[]>([]);
  const [produtosSel, setProdutosSel] = useState<string[]>([]);
  const [busca, setBusca] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [catalogoOpen, setCatalogoOpen] = useState(false);

  const buscaTrim = busca.trim();
  const buscaAtiva = buscaTrim.length >= 2;

  const { data: clientes } = useQuery({
    queryKey: ["imec-clientes"],
    queryFn: async () =>
      (await supabase.from("imec_clientes").select("id,nome").order("nome")).data ?? [],
  });

  // Busca por produto: coleta os ids de NF cujos itens casam com o termo
  const { data: nfIdsPorProduto } = useQuery({
    queryKey: ["imec-nf-ids-produto", buscaTrim],
    enabled: buscaAtiva,
    queryFn: async () => {
      const term = `%${buscaTrim}%`;
      const { data } = await supabase
        .from("imec_itens_nf")
        .select("nota_fiscal_id")
        .or(`produto.ilike.${term},ean.ilike.${term}`)
        .limit(20000);
      return Array.from(new Set((data ?? []).map((r) => r.nota_fiscal_id)));
    },
  });

  // Produtos distintos para o filtro estilo Excel
  const { data: produtosOpcoes } = useQuery({
    queryKey: ["imec-produtos-distintos"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const set = new Set<string>();
      const PAGE = 1000;
      for (let from = 0; from < 60000; from += PAGE) {
        const { data, error } = await supabase
          .from("imec_itens_nf")
          .select("produto")
          .not("produto", "is", null)
          .order("produto", { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) break;
        const rows = data ?? [];
        rows.forEach((r) => {
          const p = (r.produto ?? "").trim();
          if (p) set.add(p);
        });
        if (rows.length < PAGE) break;
      }
      return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
    },
  });

  const { data: nfIdsPorProdutosSel } = useQuery({
    queryKey: ["imec-nf-ids-produtos-sel", produtosSel.slice().sort().join("|")],
    enabled: produtosSel.length > 0,
    queryFn: async () => {
      const ids = new Set<string>();
      const BATCH = 100;
      for (let i = 0; i < produtosSel.length; i += BATCH) {
        const { data } = await supabase
          .from("imec_itens_nf")
          .select("nota_fiscal_id")
          .in("produto", produtosSel.slice(i, i + BATCH))
          .limit(20000);
        (data ?? []).forEach((r) => ids.add(r.nota_fiscal_id));
      }
      return Array.from(ids);
    },
  });

  const { data: nfs, isLoading } = useQuery({
    queryKey: [
      "imec-nfs",
      anos,
      meses,
      clientesSel,
      empresasSel,
      buscaTrim,
      nfIdsPorProduto,
      produtosSel,
      nfIdsPorProdutosSel,
      (clientes ?? []).length,
    ],
    enabled: produtosSel.length === 0 || nfIdsPorProdutosSel != null,
    queryFn: async () => {
      let q = supabase
        .from("imec_notas_fiscais")
        .select("id,data,numero,empresa,valor,cliente_id,razao_social,imec_clientes(nome)")
        .order("data", { ascending: false })
        .limit(5000);

      const anosAplicar = anos.length > 0 ? anos.map(Number) : anosOpcoes;
      const mesesAplicar =
        meses.length > 0 ? meses.map(Number) : Array.from({ length: 12 }, (_, i) => i + 1);
      const ranges: string[] = [];
      anosAplicar.forEach((a) =>
        mesesAplicar.forEach((m) => {
          const start = `${a}-${String(m).padStart(2, "0")}-01`;
          const end = new Date(a, m, 0).toISOString().slice(0, 10);
          ranges.push(`and(data.gte.${start},data.lte.${end})`);
        }),
      );
      if (ranges.length > 0) q = q.or(ranges.join(","));
      if (clientesSel.length > 0) q = q.in("cliente_id", clientesSel);
      if (empresasSel.length > 0) q = q.in("empresa", empresasSel);

      if (buscaAtiva) {
        const orParts: string[] = [`numero.ilike.%${buscaTrim}%`];
        if (nfIdsPorProduto && nfIdsPorProduto.length > 0) {
          orParts.push(`id.in.(${nfIdsPorProduto.join(",")})`);
        }
        const bNorm = norm(buscaTrim);
        const clienteIdsBusca = (clientes ?? [])
          .filter((c) => norm(c.nome).includes(bNorm))
          .map((c) => c.id);
        if (clienteIdsBusca.length > 0)
          orParts.push(`cliente_id.in.(${clienteIdsBusca.join(",")})`);
        q = q.or(orParts.join(","));
      }

      if (produtosSel.length > 0) {
        const ids = nfIdsPorProdutosSel ?? [];
        if (ids.length === 0) return [] as NF[];
        q = q.in("id", ids);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as NF[];
    },
  });

  const filtradas = useMemo(() => nfs ?? [], [nfs]);
  const idsFiltradas = useMemo(() => filtradas.map((n) => n.id), [filtradas]);
  const usaItens = produtosSel.length > 0 || (buscaAtiva && (nfIdsPorProduto?.length ?? 0) > 0);

  // NFs que casaram por número ou cliente (não por produto)
  const nfsMatchOutro = useMemo(() => {
    const s = new Set<string>();
    if (!buscaAtiva) return s;
    const b = buscaTrim.toLowerCase();
    const bNorm = norm(buscaTrim);
    filtradas.forEach((n) => {
      if ((n.numero ?? "").toLowerCase().includes(b)) s.add(n.id);
      else if (bNorm && norm(n.imec_clientes?.nome ?? "").includes(bNorm)) s.add(n.id);
    });
    return s;
  }, [filtradas, buscaAtiva, buscaTrim]);

  const { data: itensFiltrados } = useQuery({
    queryKey: ["imec-itens-nfs-filtradas", idsFiltradas.slice().sort().join("|")],
    enabled: usaItens && idsFiltradas.length > 0,
    queryFn: async () => {
      const out: ItemNF[] = [];
      const BATCH = 150;
      for (let i = 0; i < idsFiltradas.length; i += BATCH) {
        const { data } = await supabase
          .from("imec_itens_nf")
          .select("nota_fiscal_id,ean,codigo_produto,produto,quantidade,valor_unitario,valor_total")
          .in("nota_fiscal_id", idsFiltradas.slice(i, i + BATCH));
        out.push(...((data ?? []) as ItemNF[]));
      }
      return out;
    },
  });

  // Total estilo SUBTOTAL: soma apenas itens que casam com a pesquisa/filtro de produto
  const total = useMemo(() => {
    if (!usaItens || !itensFiltrados) return filtradas.reduce((a, n) => a + Number(n.valor), 0);
    const b = buscaTrim.toLowerCase();
    const prodSet = new Set(produtosSel.map((p) => p.trim()));
    const buscaOk = (it: ItemNF) =>
      !buscaAtiva ||
      (it.produto ?? "").toLowerCase().includes(b) ||
      (it.ean ?? "").toLowerCase().includes(b);
    const prodOk = (it: ItemNF) => prodSet.size === 0 || prodSet.has((it.produto ?? "").trim());
    const porNf = new Map<string, number>();
    itensFiltrados.forEach((it) => {
      const matchedOutro = nfsMatchOutro.has(it.nota_fiscal_id);
      const conta =
        prodSet.size > 0
          ? prodOk(it) && (matchedOutro || buscaOk(it))
          : matchedOutro
            ? false
            : buscaOk(it);
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

  const colGetters = useMemo(
    () => ({
      data: (n: NF) => formatDateBR(n.data),
      numero: (n: NF) => n.numero,
      empresa: (n: NF) => n.empresa,
      cliente: (n: NF) => n.imec_clientes?.nome ?? "",
      valor: (n: NF) => String(n.valor ?? 0),
    }),
    [],
  );
  const colTypes = useMemo(
    () => ({
      data: "date" as const,
      numero: "text" as const,
      empresa: "text" as const,
      cliente: "text" as const,
      valor: "number" as const,
    }),
    [],
  );
  const { view, distinct, filters, sorts, setFilter, setSort, reset } = useColumnFilters(
    filtradas,
    colGetters,
    colTypes,
  );

  const clientesAtendidos = useMemo(
    () => new Set(filtradas.map((n) => n.cliente_id)).size,
    [filtradas],
  );

  function toggle(id: string) {
    setExpanded((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }

  const allVisibleSelected = view.length > 0 && view.every((n) => selectedIds.has(n.id));
  const someVisibleSelected = view.some((n) => selectedIds.has(n.id));

  function toggleSelectAllVisible() {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      if (allVisibleSelected) view.forEach((n) => s.delete(n.id));
      else view.forEach((n) => s.add(n.id));
      return s;
    });
  }

  function limparFiltros() {
    setBusca("");
    setClientesSel([]);
    setEmpresasSel([]);
    setProdutosSel([]);
  }

  async function exportarSelecionadas() {
    const alvo = selectedIds.size > 0 ? view.filter((n) => selectedIds.has(n.id)) : view;
    if (alvo.length === 0) return;
    setExporting(true);
    try {
      const ids = alvo.map((n) => n.id);
      const itens: ItemNF[] = [];
      for (let i = 0; i < ids.length; i += 150) {
        const { data } = await supabase
          .from("imec_itens_nf")
          .select("nota_fiscal_id,ean,codigo_produto,produto,quantidade,valor_unitario,valor_total")
          .in("nota_fiscal_id", ids.slice(i, i + 150));
        itens.push(...((data ?? []) as ItemNF[]));
      }
      const byId = new Map(alvo.map((n) => [n.id, n]));
      const rows = itens.map((it) => {
        const nf = byId.get(it.nota_fiscal_id);
        return {
          "Data de Faturamento": nf ? formatDateBR(nf.data) : "",
          NF: nf?.numero ?? "",
          Empresa: nf?.empresa ?? "",
          Cliente: nf?.imec_clientes?.nome ?? "",
          EAN: it.ean ?? "",
          "Código Interno": it.codigo_produto ?? "",
          "Descrição do Produto": it.produto ?? "",
          Quantidade: Number(it.quantidade),
          Valor: Number(it.valor_unitario),
          Total: Number(it.valor_total),
        };
      });
      if (rows.length === 0) {
        toast.error("Nenhum item para exportar.");
        return;
      }
      exportToExcel(rows, `imec-nfs-${alvo.length}.xlsx`, "Itens");
      toast.success(`${alvo.length} NF(s) exportadas.`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao exportar.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold">Notas Fiscais Faturadas</h1>
          <p className="text-muted-foreground mt-1">
            Pesquise por NF, cliente ou produto. Filtre por período, cliente e empresa. Clique em
            uma linha para ver os itens.
          </p>
        </div>
        <button
          onClick={() => setCatalogoOpen(true)}
          className="h-9 px-3 rounded-md bg-secondary hover:bg-secondary/80 inline-flex items-center gap-1.5 text-sm font-medium shrink-0"
        >
          <Settings2 className="h-4 w-4" /> Catálogo de produtos
        </button>
      </div>
      {catalogoOpen && <CatalogoProdutosDialog onClose={() => setCatalogoOpen(false)} />}

      <div className="bi-card mt-6 p-4 space-y-3">
        <div className="relative">
          {!busca && (
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          )}
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="          Pesquisar por número da NF, cliente, produto ou EAN..."
            className={`bi-input-sm w-full pr-10 ${busca ? "pl-3" : "pl-10"}`}
            style={{ height: 44 }}
          />
          {busca && (
            <button
              onClick={() => setBusca("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
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
            options={(clientes ?? []).map((c) => ({ value: c.id, label: c.nome }))}
            selected={clientesSel}
            onChange={setClientesSel}
          />
          <MultiSelect
            width={180}
            placeholder="Todas as empresas"
            options={EMPRESAS.map((e) => ({ value: e, label: e }))}
            selected={empresasSel}
            onChange={setEmpresasSel}
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
          {(busca ||
            clientesSel.length > 0 ||
            empresasSel.length > 0 ||
            produtosSel.length > 0) && (
            <button onClick={limparFiltros} className="text-sm text-primary hover:underline">
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        <div className="bi-card p-4">
          <div className="bi-stat-label">NFs encontradas</div>
          <div className="text-2xl font-bold tabular-nums mt-1">
            {filtradas.length.toLocaleString("pt-BR")}
          </div>
        </div>
        <div className="bi-card p-4">
          <div className="bi-stat-label">Total faturado (filtros aplicados)</div>
          <div className="text-2xl font-bold tabular-nums mt-1 text-primary">
            {formatBRL(total)}
          </div>
        </div>
        <div className="bi-card p-4">
          <div className="bi-stat-label">Clientes atendidos</div>
          <div className="text-2xl font-bold tabular-nums mt-1">{clientesAtendidos}</div>
        </div>
      </div>

      <div className="bi-card mt-4 overflow-x-auto">
        <div className="flex justify-end px-3 py-1.5">
          <ClearFiltersButton filters={filters} sorts={sorts} onReset={reset} />
        </div>
        <table className="bi-table">
          <thead>
            <tr>
              <th style={{ width: 32 }}>
                <input
                  type="checkbox"
                  aria-label="Selecionar todas visíveis"
                  checked={allVisibleSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected;
                  }}
                  onChange={toggleSelectAllVisible}
                  className="cursor-pointer"
                />
              </th>
              <th style={{ width: 38 }} />
              <th>
                <ColumnFilterHeader
                  label="Data"
                  type="date"
                  values={distinct.data ?? []}
                  selected={filters.data ?? []}
                  onChange={(v) => setFilter("data", v)}
                  sort={sorts.data ?? null}
                  onSortChange={(s) => setSort("data", s)}
                />
              </th>
              <th>
                <ColumnFilterHeader
                  label="Número"
                  values={distinct.numero ?? []}
                  selected={filters.numero ?? []}
                  onChange={(v) => setFilter("numero", v)}
                  sort={sorts.numero ?? null}
                  onSortChange={(s) => setSort("numero", s)}
                />
              </th>
              <th>
                <ColumnFilterHeader
                  label="Empresa"
                  values={distinct.empresa ?? []}
                  selected={filters.empresa ?? []}
                  onChange={(v) => setFilter("empresa", v)}
                  sort={sorts.empresa ?? null}
                  onSortChange={(s) => setSort("empresa", s)}
                />
              </th>
              <th>
                <ColumnFilterHeader
                  label="Cliente"
                  values={distinct.cliente ?? []}
                  selected={filters.cliente ?? []}
                  onChange={(v) => setFilter("cliente", v)}
                  sort={sorts.cliente ?? null}
                  onSortChange={(s) => setSort("cliente", s)}
                />
              </th>
              <th className="text-right">
                <ColumnFilterHeader
                  label="Valor"
                  align="right"
                  type="number"
                  values={distinct.valor ?? []}
                  selected={filters.valor ?? []}
                  onChange={(v) => setFilter("valor", v)}
                  sort={sorts.valor ?? null}
                  onSortChange={(s) => setSort("valor", s)}
                />
              </th>
              <th style={{ width: 60 }} />
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
            {!isLoading && view.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-muted-foreground py-10">
                  Nenhuma NF encontrada com os filtros aplicados.
                </td>
              </tr>
            )}
            {!isLoading &&
              view.map((n) => (
                <ImecNFRow
                  key={n.id}
                  nf={n}
                  open={expanded.has(n.id)}
                  onToggle={() => toggle(n.id)}
                  selected={selectedIds.has(n.id)}
                  onSelect={() => toggleSelected(n.id)}
                  highlight={buscaAtiva ? buscaTrim : ""}
                />
              ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={6}>TOTAL</td>
              <td className="text-right text-primary tabular-nums">{formatBRL(total)}</td>
              <td />
            </tr>
            <tr>
              <td colSpan={8}>
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => void exportarSelecionadas()}
                    disabled={view.length === 0 || exporting}
                    className="h-8 px-3 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 inline-flex items-center gap-1.5 text-xs font-semibold"
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    {exporting
                      ? "Exportando..."
                      : selectedIds.size > 0
                        ? `Exportar Selecionadas (${selectedIds.size})`
                        : `Exportar Todas (${view.length})`}
                  </button>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function ImecNFRow({
  nf,
  open,
  onToggle,
  selected,
  onSelect,
  highlight,
}: {
  nf: NF;
  open: boolean;
  onToggle: () => void;
  selected: boolean;
  onSelect: () => void;
  highlight: string;
}) {
  const { data: itens } = useQuery({
    queryKey: ["imec-itens-nf", nf.id],
    enabled: open,
    queryFn: async () =>
      (
        await supabase
          .from("imec_itens_nf")
          .select("id,ean,codigo_produto,produto,quantidade,valor_unitario,valor_total")
          .eq("nota_fiscal_id", nf.id)
          .order("produto")
      ).data ?? [],
  });

  const h = highlight.trim().toLowerCase();

  async function exportarNF() {
    const { data } = await supabase
      .from("imec_itens_nf")
      .select("ean,codigo_produto,produto,quantidade,valor_unitario,valor_total")
      .eq("nota_fiscal_id", nf.id);
    const rows = (data ?? []).map((it) => ({
      "Data de Faturamento": formatDateBR(nf.data),
      NF: nf.numero,
      Empresa: nf.empresa,
      Cliente: nf.imec_clientes?.nome ?? "",
      EAN: it.ean ?? "",
      "Descrição do Produto": it.produto ?? "",
      Quantidade: Number(it.quantidade),
      Valor: Number(it.valor_unitario),
      Total: Number(it.valor_total),
    }));
    if (rows.length === 0) {
      toast.error("Nota sem itens");
      return;
    }
    exportToExcel(rows, `nf-${nf.empresa}-${nf.numero}.xlsx`, "Itens");
  }

  return (
    <>
      <tr className="cursor-pointer" onClick={onToggle}>
        <td onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            aria-label={`Selecionar NF ${nf.numero}`}
            checked={selected}
            onChange={onSelect}
            className="cursor-pointer"
          />
        </td>
        <td>
          {open ? (
            <ChevronDown className="h-4 w-4 text-primary" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </td>
        <td className="tabular-nums">{formatDateBR(nf.data)}</td>
        <td className="font-medium text-primary">{nf.numero}</td>
        <td className="text-xs">{nf.empresa}</td>
        <td>{nf.imec_clientes?.nome ?? "—"}</td>
        <td className="text-right tabular-nums font-semibold">{formatBRL(nf.valor)}</td>
        <td className="text-right">
          <button
            onClick={(e) => {
              e.stopPropagation();
              void exportarNF();
            }}
            className="h-7 px-2 rounded bg-secondary hover:bg-secondary/80 inline-flex items-center gap-1 text-xs"
            title="Exportar itens desta NF"
          >
            <FileDown className="h-3.5 w-3.5" />
          </button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={8} className="bg-secondary/30 p-0">
            <table className="bi-table w-full">
              <thead>
                <tr>
                  <th>EAN</th>
                  <th>Código Interno</th>
                  <th>Descrição do produto</th>
                  <th className="text-right">Quantidade</th>
                  <th className="text-right">Valor unitário</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {(itens ?? []).map((it) => {
                  const match = h.length >= 2 && (it.produto ?? "").toLowerCase().includes(h);
                  return (
                    <tr key={it.id} className={match ? "bg-primary/10" : undefined}>
                      <td className="text-xs tabular-nums">{it.ean ?? "—"}</td>
                      <td className="text-xs tabular-nums">{it.codigo_produto ?? "—"}</td>
                      <td className={match ? "font-semibold text-primary" : undefined}>
                        {it.produto}
                      </td>
                      <td className="text-right tabular-nums">{formatNumberBR(it.quantidade)}</td>
                      <td className="text-right tabular-nums">{formatBRL(it.valor_unitario)}</td>
                      <td className="text-right tabular-nums font-semibold">
                        {formatBRL(it.valor_total)}
                      </td>
                    </tr>
                  );
                })}
                {(itens ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-muted-foreground py-6">
                      Sem itens.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}

type Produto = {
  id: string;
  codigo_interno: string;
  produto: string;
  ean: string;
  ativo: boolean;
  updated_at: string;
};

/** Catálogo mestre de produtos (código interno, nome oficial e EAN), a partir
 * das Fichas Técnicas IMEC. Usado para preencher automaticamente o EAN e o
 * código interno dos itens de NF (que só vêm com a descrição solta) e para o
 * cálculo de investimento. Editável aqui caso um produto novo apareça. */
function CatalogoProdutosDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: produtos } = useQuery({
    queryKey: ["imec-produtos-catalogo"],
    queryFn: async () =>
      ((await supabase.from("imec_produtos").select("*").order("produto")).data ?? []) as Produto[],
  });

  const salvar = useMutation({
    mutationFn: async (vars: { id: string; campo: string; valor: string | boolean }) => {
      const { error } = await supabase
        .from("imec_produtos")
        .update({
          [vars.campo]: vars.valor,
        } as Database["public"]["Tables"]["imec_produtos"]["Update"])
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["imec-produtos-catalogo"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const criar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("imec_produtos")
        .insert({ codigo_interno: "", produto: "Novo produto", ean: "" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["imec-produtos-catalogo"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("imec_produtos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["imec-produtos-catalogo"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Catálogo de produtos (Ficha Técnica)</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">
          Código interno, nome oficial e EAN de cada produto. Usado para reconhecer os produtos das
          NFs (que vêm sem EAN) automaticamente pelo nome. Desative um produto em vez de apagar se
          ele sair de linha.
        </p>
        <div className="overflow-x-auto">
          <table className="bi-table">
            <thead>
              <tr>
                <th>Código Interno</th>
                <th>Produto</th>
                <th>EAN</th>
                <th className="text-center">Ativo</th>
                <th style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {(produtos ?? []).map((p) => (
                <tr key={p.id}>
                  <td>
                    <input
                      defaultValue={p.codigo_interno}
                      onBlur={(e) =>
                        salvar.mutate({
                          id: p.id,
                          campo: "codigo_interno",
                          valor: e.target.value.trim(),
                        })
                      }
                      className="bi-input-sm w-28"
                    />
                  </td>
                  <td>
                    <input
                      defaultValue={p.produto}
                      onBlur={(e) =>
                        salvar.mutate({ id: p.id, campo: "produto", valor: e.target.value })
                      }
                      className="bi-input-sm w-full"
                    />
                  </td>
                  <td>
                    <input
                      defaultValue={p.ean}
                      onBlur={(e) =>
                        salvar.mutate({ id: p.id, campo: "ean", valor: e.target.value.trim() })
                      }
                      className="bi-input-sm w-32"
                    />
                  </td>
                  <td className="text-center">
                    <input
                      type="checkbox"
                      checked={p.ativo}
                      onChange={(e) =>
                        salvar.mutate({ id: p.id, campo: "ativo", valor: e.target.checked })
                      }
                    />
                  </td>
                  <td className="text-center">
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Remover "${p.produto}" do catálogo?`)) remover.mutate(p.id);
                      }}
                      className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-destructive/10 text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={() => criar.mutate()}
          className="mt-2 h-9 px-3 rounded-md bg-secondary hover:bg-secondary/80 inline-flex items-center gap-1.5 text-sm font-medium self-start"
        >
          <Plus className="h-4 w-4" /> Novo produto
        </button>
      </DialogContent>
    </Dialog>
  );
}
