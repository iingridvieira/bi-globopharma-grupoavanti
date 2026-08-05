import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
import { ChevronDown, ChevronRight, FileDown, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/imec/notas-fiscais")({
  head: () => ({
    meta: [
      { title: "Notas Fiscais · BI IMEC" },
      { name: "description", content: "Notas fiscais de faturamento IMEC e NUTIVIT com itens e exportação." },
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

function ImecNFsPage() {
  const now = new Date();
  const anoAtual = now.getFullYear();
  const [meses, setMeses] = useState<string[]>([]);
  const [anos, setAnos] = useState<string[]>([String(anoAtual)]);
  const [clientesSel, setClientesSel] = useState<string[]>([]);
  const [empresasSel, setEmpresasSel] = useState<string[]>([]);
  const [busca, setBusca] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: clientes } = useQuery({
    queryKey: ["imec-clientes"],
    queryFn: async () =>
      (await supabase.from("imec_clientes").select("id,nome").order("nome")).data ?? [],
  });

  const { data: nfs, isLoading } = useQuery({
    queryKey: ["imec-nfs", anos, meses, clientesSel, empresasSel],
    queryFn: async () => {
      let q = supabase
        .from("imec_notas_fiscais")
        .select("id,data,numero,empresa,valor,cliente_id,razao_social,imec_clientes(nome)")
        .order("data", { ascending: false })
        .limit(5000);

      const anosAplicar = anos.length > 0 ? anos.map(Number) : [anoAtual - 2, anoAtual - 1, anoAtual, anoAtual + 1];
      const mesesAplicar = meses.length > 0 ? meses.map(Number) : Array.from({ length: 12 }, (_, i) => i + 1);
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

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as NF[];
    },
  });

  const buscaTrim = busca.trim().toLowerCase();
  const filtradas = useMemo(() => {
    if (buscaTrim.length < 2) return nfs ?? [];
    return (nfs ?? []).filter(
      (n) =>
        n.numero.toLowerCase().includes(buscaTrim) ||
        (n.imec_clientes?.nome ?? "").toLowerCase().includes(buscaTrim) ||
        (n.razao_social ?? "").toLowerCase().includes(buscaTrim),
    );
  }, [nfs, buscaTrim]);

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
  const labels: Record<string, string> = {
    data: "Emissão",
    numero: "NF",
    empresa: "Empresa",
    cliente: "Cliente",
    valor: "Valor",
  };
  const { view, distinct, filters, sorts, setFilter, setSort, reset } = useColumnFilters(
    filtradas,
    colGetters,
    colTypes,
  );

  const total = view.reduce((a, n) => a + Number(n.valor), 0);

  function toggle(id: string) {
    setExpanded((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }

  async function exportarTodas() {
    if (view.length === 0) return;
    const ids = view.map((n) => n.id);
    const itens: { nota_fiscal_id: string; ean: string | null; produto: string; quantidade: number | string; valor_unitario: number | string; valor_total: number | string }[] = [];
    for (let i = 0; i < ids.length; i += 150) {
      const { data } = await supabase
        .from("imec_itens_nf")
        .select("nota_fiscal_id,ean,produto,quantidade,valor_unitario,valor_total")
        .in("nota_fiscal_id", ids.slice(i, i + 150));
      itens.push(...((data ?? []) as typeof itens));
    }
    const byId = new Map(view.map((n) => [n.id, n]));
    const rows = itens.map((it) => {
      const nf = byId.get(it.nota_fiscal_id);
      return {
        "Data de faturamento": nf ? formatDateBR(nf.data) : "",
        NF: nf?.numero ?? "",
        Empresa: nf?.empresa ?? "",
        Cliente: nf?.imec_clientes?.nome ?? "",
        EAN: it.ean ?? "",
        "Descrição do produto": it.produto,
        Quantidade: Number(it.quantidade),
        Valor: Number(it.valor_unitario),
        Total: Number(it.valor_total),
      };
    });
    exportToExcel(rows, `imec-notas-fiscais.xlsx`, "Notas Fiscais");
    toast.success("Exportação gerada");
  }

  return (
    <div className="p-8 max-w-[1500px] mx-auto">
      <header className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="bi-stat-label">Faturamento IMEC / NUTIVIT</div>
          <h1 className="font-display text-3xl font-bold mt-1">Notas Fiscais</h1>
        </div>
        <button
          onClick={() => void exportarTodas()}
          className="h-10 px-4 rounded-md bg-primary text-primary-foreground font-semibold text-sm flex items-center gap-2"
        >
          <FileDown className="h-4 w-4" /> Exportar Excel
        </button>
      </header>

      <div className="bi-card p-4 mb-5 flex flex-wrap items-center gap-3">
        <MultiSelect
          options={MESES_BR.map((m, i) => ({ value: String(i + 1), label: m }))}
          selected={meses}
          onChange={setMeses}
          placeholder="Todos os meses"
        />
        <MultiSelect
          options={[anoAtual - 2, anoAtual - 1, anoAtual, anoAtual + 1].map((a) => ({
            value: String(a),
            label: String(a),
          }))}
          selected={anos}
          onChange={setAnos}
          placeholder="Todos os anos"
          width={140}
        />
        <MultiSelect
          options={(clientes ?? []).map((c) => ({ value: c.id, label: c.nome }))}
          selected={clientesSel}
          onChange={setClientesSel}
          placeholder="Todos os clientes"
          width={260}
        />
        <MultiSelect
          options={EMPRESAS.map((e) => ({ value: e, label: e }))}
          selected={empresasSel}
          onChange={setEmpresasSel}
          placeholder="Todas as empresas"
          width={170}
        />
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar NF ou cliente…"
            className="h-10 w-full pl-9 pr-3 bg-input border border-border rounded-md text-sm outline-none focus:border-primary"
          />
        </div>
      </div>

      <div className="bi-card overflow-x-auto">
        <div className="flex items-center justify-between px-3 py-1.5">
          <span className="text-xs text-muted-foreground">
            {view.length} nota(s) · Total {formatBRL(total)}
          </span>
          <ClearFiltersButton filters={filters} sorts={sorts} onReset={reset} />
        </div>
        <table className="bi-table">
          <thead>
            <tr>
              <th className="w-8" />
              {Object.keys(colGetters).map((k) => (
                <th key={k} className={k === "valor" ? "text-right" : undefined}>
                  <ColumnFilterHeader
                    label={labels[k]}
                    values={distinct[k] ?? []}
                    selected={filters[k] ?? []}
                    onChange={(v) => setFilter(k, v)}
                    sort={sorts[k] ?? null}
                    onSortChange={(s) => setSort(k, s)}
                    type={colTypes[k as keyof typeof colTypes]}
                    align={k === "valor" ? "right" : "left"}
                  />
                </th>
              ))}
              <th className="text-right w-20">Itens</th>
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
            {!isLoading && view.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-muted-foreground py-10">
                  Nenhuma nota fiscal no período.
                </td>
              </tr>
            )}
            {view.map((n) => (
              <ImecNFRow key={n.id} nf={n} open={expanded.has(n.id)} onToggle={() => toggle(n.id)} />
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5}>TOTAL</td>
              <td className="text-right text-primary">{formatBRL(total)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function ImecNFRow({ nf, open, onToggle }: { nf: NF; open: boolean; onToggle: () => void }) {
  const { data: itens } = useQuery({
    queryKey: ["imec-itens-nf", nf.id],
    enabled: open,
    queryFn: async () =>
      (
        await supabase
          .from("imec_itens_nf")
          .select("id,ean,produto,quantidade,valor_unitario,valor_total")
          .eq("nota_fiscal_id", nf.id)
          .order("produto")
      ).data ?? [],
  });

  async function exportarNF() {
    const { data } = await supabase
      .from("imec_itens_nf")
      .select("ean,produto,quantidade,valor_unitario,valor_total")
      .eq("nota_fiscal_id", nf.id);
    const rows = (data ?? []).map((it) => ({
      "Data de faturamento": formatDateBR(nf.data),
      EAN: it.ean ?? "",
      "Descrição do produto": it.produto,
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
        <td>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </td>
        <td className="tabular-nums">{formatDateBR(nf.data)}</td>
        <td className="font-medium">{nf.numero}</td>
        <td className="text-xs">{nf.empresa}</td>
        <td>{nf.imec_clientes?.nome ?? "—"}</td>
        <td className="text-right tabular-nums font-semibold">{formatBRL(nf.valor)}</td>
        <td className="text-right">
          <button
            onClick={(e) => {
              e.stopPropagation();
              void exportarNF();
            }}
            className="inline-flex items-center gap-1 text-xs text-primary font-semibold hover:underline"
            title="Exportar itens desta NF"
          >
            <FileDown className="h-3.5 w-3.5" /> Excel
          </button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={7} className="bg-secondary/30 p-0">
            <table className="bi-table w-full">
              <thead>
                <tr>
                  <th>EAN</th>
                  <th>Descrição do produto</th>
                  <th className="text-right">Quantidade</th>
                  <th className="text-right">Valor unitário</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {(itens ?? []).map((it) => (
                  <tr key={it.id}>
                    <td className="text-xs tabular-nums">{it.ean ?? "—"}</td>
                    <td>{it.produto}</td>
                    <td className="text-right tabular-nums">{formatNumberBR(it.quantidade)}</td>
                    <td className="text-right tabular-nums">{formatBRL(it.valor_unitario)}</td>
                    <td className="text-right tabular-nums font-semibold">
                      {formatBRL(it.valor_total)}
                    </td>
                  </tr>
                ))}
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
