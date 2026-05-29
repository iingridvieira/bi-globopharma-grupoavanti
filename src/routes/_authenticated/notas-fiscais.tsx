import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDateBR, MESES_BR } from "@/lib/format";
import { useState, useMemo } from "react";
import { SmallStyles } from "./pedidos";
import { ChevronDown, ChevronRight, Search, X } from "lucide-react";
import { MultiSelect } from "@/components/MultiSelect";

export const Route = createFileRoute("/_authenticated/notas-fiscais")({ component: NFsPage });

type PeriodoMode = "mes" | "ano" | "tudo";

const RESPONSAVEIS: Record<string, string[]> = {
  Alexandre: ["ANDORINHA", "BANDEIRANTES", "DISMAP", "IMPACTA MED", "MAXIFARMA", "NÚCLEO FARMA", "DISMED", "MED VALLE", "GEMELI"],
  Eduardo: ["CAMPEÃ", "CG MEDICAMENTOS", "DF COMERCIAL", "FARMA CONDE", "MEDLOG"],
};

function normNome(s: string): string {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

function NFsPage() {
  const now = new Date();
  const [periodoMode, setPeriodoMode] = useState<PeriodoMode>("mes");
  const [meses, setMeses] = useState<string[]>([String(now.getMonth() + 1)]);
  const [anos, setAnos] = useState<string[]>([String(now.getFullYear())]);
  const [clientesSel, setClientesSel] = useState<string[]>([]);
  const [responsavel, setResponsavel] = useState<string>("");
  const [busca, setBusca] = useState("");
  const [operacoes, setOperacoes] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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

  const { data: nfs, isLoading } = useQuery({
    queryKey: ["nfs", periodoMode, anos, meses, clientesSel, buscaTrim, nfIdsPorProduto],
    queryFn: async () => {
      let q = supabase.from("notas_fiscais")
        .select("id,data,numero,valor,desconto,cliente_id,clientes(nome)")
        .order("data", { ascending: false })
        .limit(5000);

      // Período: gera lista de intervalos (ano/mês) e aplica via or
      if (periodoMode === "mes" || periodoMode === "ano") {
        const anosNum = anos.map(Number);
        const mesesNum = periodoMode === "mes" ? meses.map(Number) : Array.from({ length: 12 }, (_, i) => i + 1);
        if (anosNum.length > 0 && mesesNum.length > 0) {
          const ranges: string[] = [];
          anosNum.forEach((a) => {
            mesesNum.forEach((m) => {
              const start = `${a}-${String(m).padStart(2, "0")}-01`;
              const end = new Date(a, m, 0).toISOString().slice(0, 10);
              ranges.push(`and(data.gte.${start},data.lte.${end})`);
            });
          });
          q = q.or(ranges.join(","));
        }
      }

      if (clientesSel.length > 0) q = q.in("cliente_id", clientesSel);

      if (buscaTrim.length >= 2) {
        const orParts: string[] = [`numero.ilike.%${buscaTrim}%`];
        if (nfIdsPorProduto && nfIdsPorProduto.length > 0) {
          orParts.push(`id.in.(${nfIdsPorProduto.join(",")})`);
        }
        q = q.or(orParts.join(","));
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

  const filtradas = useMemo(() => {
    const respSet = responsavel ? clientesPorResponsavel[responsavel] : null;
    return (nfs ?? []).filter((n) => {
      const v = Number(n.valor);
      if (operacoes.length > 0) {
        const tipo = v > 0 ? "venda" : "bonificacao";
        if (!operacoes.includes(tipo)) return false;
      }
      if (respSet && !respSet.has(n.cliente_id)) return false;
      return true;
    });
  }, [nfs, operacoes, responsavel, clientesPorResponsavel]);

  const total = useMemo(() => filtradas.reduce((a, n) => a + Number(n.valor), 0), [filtradas]);
  const totalVendas = useMemo(() => filtradas.filter((n) => Number(n.valor) > 0).length, [filtradas]);
  const totalBonif = useMemo(() => filtradas.filter((n) => Number(n.valor) <= 0).length, [filtradas]);

  function toggle(id: string) {
    setExpanded((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  function limparFiltros() {
    setBusca(""); setClientesSel([]); setOperacoes([]); setResponsavel("");
  }


  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <h1 className="font-display text-3xl font-bold">Notas Fiscais Faturadas</h1>
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
          <select value={periodoMode} onChange={(e) => setPeriodoMode(e.target.value as PeriodoMode)} className="bi-input-sm w-36">
            <option value="mes">Por mês</option>
            <option value="ano">Por ano</option>
            <option value="tudo">Todo período</option>
          </select>

          {periodoMode === "mes" && (
            <MultiSelect
              width={200}
              placeholder="Meses"
              options={MESES_BR.map((m, i) => ({ value: String(i + 1), label: m }))}
              selected={meses}
              onChange={setMeses}
            />
          )}
          {(periodoMode === "mes" || periodoMode === "ano") && (
            <MultiSelect
              width={160}
              placeholder="Anos"
              options={anosOpcoes.map((a) => ({ value: String(a), label: String(a) }))}
              selected={anos}
              onChange={setAnos}
            />
          )}

          <MultiSelect
            width={260}
            placeholder="Todos os clientes"
            options={(clientes ?? []).map((c) => ({ value: c.id, label: c.nome }))}
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

          <select value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className="bi-input-sm w-44">
            <option value="">Representantes</option>
            <option value="Alexandre">Alexandre</option>
            <option value="Eduardo">Eduardo</option>
            <option value="Paulo">Paulo</option>
          </select>

          {(busca || clientesSel.length > 0 || operacoes.length > 0 || responsavel) && (
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
          <div className="bi-stat-label">Total faturado</div>
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
        <table className="bi-table">
          <thead>
            <tr>
              <th style={{ width: 38 }}></th>
              <th>Data</th><th>Número</th><th>Cliente</th>
              <th className="text-center">Operação</th><th className="text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="text-center text-muted-foreground py-8">Carregando…</td></tr>}
            {!isLoading && filtradas.map((n) => {
              const open = expanded.has(n.id);
              const isVenda = Number(n.valor) > 0;
              return (
                <>
                  <tr key={n.id} onClick={() => toggle(n.id)} className="cursor-pointer">
                    <td>{open ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}</td>
                    <td>{formatDateBR(n.data)}</td>
                    <td className="font-medium text-primary">{n.numero}</td>
                    <td>{n.clientes?.nome ?? "—"}</td>
                    <td className="text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                        isVenda ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
                      }`}>{isVenda ? "Venda" : "Bonificação"}</span>
                    </td>
                    <td className="text-right tabular-nums">{formatBRL(n.valor)}</td>
                  </tr>
                  {open && <ItensRow key={n.id + "-items"} nfId={n.id} highlight={buscaTrim} />}
                </>
              );
            })}
            {!isLoading && filtradas.length === 0 && <tr><td colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma NF encontrada com os filtros aplicados.</td></tr>}
          </tbody>
          <tfoot>
            <tr><td colSpan={5}>TOTAL</td><td className="text-right text-primary">{formatBRL(total)}</td></tr>
          </tfoot>
        </table>
      </div>

      <SmallStyles />
    </div>
  );
}

function ItensRow({ nfId, highlight }: { nfId: string; highlight?: string }) {
  const { data: itens, isLoading } = useQuery({
    queryKey: ["nf-itens", nfId],
    queryFn: async () => (await supabase.from("itens_nf").select("*").eq("nota_fiscal_id", nfId)).data ?? [],
  });

  const h = (highlight ?? "").trim().toLowerCase();
  const match = (s: string) => h.length >= 2 && s.toLowerCase().includes(h);

  return (
    <tr>
      <td colSpan={6} className="bg-muted/30 p-0">
        <div className="px-6 py-4">
          <div className="bi-stat-label mb-2">Itens da NF</div>
          {isLoading && <div className="text-sm text-muted-foreground py-2">Carregando…</div>}
          {!isLoading && itens && itens.length === 0 && <div className="text-sm text-muted-foreground py-2">Sem itens registrados. Importe a planilha de faturamento.</div>}
          {itens && itens.length > 0 && (
            <table className="bi-table">
              <thead>
                <tr>
                  <th>Código</th><th>Produto</th>
                  <th className="text-right">Qtd</th>
                  <th className="text-right">V. Unit</th>
                  <th className="text-right">Desc.</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((i) => {
                  const hit = match(i.produto ?? "") || match(i.codigo_produto ?? "");
                  return (
                    <tr key={i.id} className={hit ? "bg-primary/10" : undefined}>
                      <td className="text-xs text-muted-foreground">{i.codigo_produto}</td>
                      <td>{i.produto}</td>
                      <td className="text-right tabular-nums">{Number(i.quantidade).toLocaleString("pt-BR")}</td>
                      <td className="text-right tabular-nums">{formatBRL(i.valor_unitario)}</td>
                      <td className="text-right tabular-nums">{formatBRL(i.desconto)}</td>
                      <td className="text-right tabular-nums font-semibold">{formatBRL(i.valor_total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </td>
    </tr>
  );
}
