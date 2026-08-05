import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { formatBRL, formatDateBR, MESES_BR } from "@/lib/format";
import { MultiSelect } from "@/components/MultiSelect";
import {
  ColumnFilterHeader,
  ClearFiltersButton,
  useColumnFilters,
} from "@/components/ColumnFilterHeader";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Settings2, Search, Plus, Trash2, RefreshCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/imec/investimento")({
  head: () => ({
    meta: [
      { title: "Investimento · BI IMEC" },
      {
        name: "description",
        content: "Acompanhamento do investimento gerado por NF faturada (IMEC/NUTIVIT).",
      },
    ],
  }),
  component: ImecInvestimentoPage,
});

const EMPRESAS = ["IMEC", "NUTIVIT"];

const STATUS_OPTIONS = [
  { value: "pendente", label: "Pendente" },
  { value: "cobrado", label: "Cobrado" },
  { value: "pago", label: "Pago" },
] as const;

type Status = (typeof STATUS_OPTIONS)[number]["value"];

type NF = {
  id: string;
  data: string;
  numero: string;
  empresa: string;
  valor: number | string;
  cliente_id: string;
  imec_clientes: { nome: string } | null;
  imec_investimento_nf: {
    id: string;
    status: string;
    data_cobranca: string | null;
    data_pagamento: string | null;
    observacao: string | null;
  } | null;
};

type ItemNF = {
  nota_fiscal_id: string;
  ean: string | null;
  quantidade: number | string;
};

type Preco = {
  id: string;
  ean: string;
  produto: string;
  preco_custo: number | string;
  preco_final: number | string;
  ativo: boolean;
  updated_at: string;
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pendente:
      "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300 dark:border-amber-400/30",
    cobrado:
      "bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-300 dark:border-blue-400/30",
    pago: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300 dark:border-emerald-400/30",
  };
  const label = STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
        map[status] ?? map.pendente
      }`}
    >
      {label}
    </span>
  );
}

/** Investimento gerado por uma lista de itens, usando a tabela de preços ativa.
 * Se houver mais de um preço cadastrado para o mesmo EAN, usa sempre o mais
 * recente (mesma regra do cálculo no banco), para nunca contar em dobro. */
function buildPrecoIndex(precos: Preco[]): Map<string, { custo: number; final: number }> {
  const porEan = new Map<string, Preco>();
  for (const p of precos) {
    if (!p.ativo) continue;
    const key = (p.ean ?? "").trim();
    if (!key) continue;
    const atual = porEan.get(key);
    if (!atual || p.updated_at > atual.updated_at) porEan.set(key, p);
  }
  const idx = new Map<string, { custo: number; final: number }>();
  porEan.forEach((p, ean) =>
    idx.set(ean, { custo: Number(p.preco_custo), final: Number(p.preco_final) }),
  );
  return idx;
}

function calcInvestimento(
  itens: ItemNF[],
  precoIdx: Map<string, { custo: number; final: number }>,
): number {
  let total = 0;
  for (const it of itens) {
    const preco = precoIdx.get((it.ean ?? "").trim());
    if (!preco) continue;
    total += Number(it.quantidade) * (preco.custo - preco.final);
  }
  return total;
}

function ImecInvestimentoPage() {
  const { canEdit } = useAuth();
  const qc = useQueryClient();
  const now = new Date();
  const anoAtual = now.getFullYear();
  const anosOpcoes = [anoAtual - 1, anoAtual, anoAtual + 1];
  const [meses, setMeses] = useState<string[]>([]);
  const [anos, setAnos] = useState<string[]>([]);
  const [clientesSel, setClientesSel] = useState<string[]>([]);
  const [empresasSel, setEmpresasSel] = useState<string[]>([]);
  const [statusSel, setStatusSel] = useState<string[]>([]);
  const [precosOpen, setPrecosOpen] = useState(false);
  const [buscaOpen, setBuscaOpen] = useState(false);

  const { data: clientes } = useQuery({
    queryKey: ["imec-clientes"],
    queryFn: async () =>
      (await supabase.from("imec_clientes").select("id,nome").order("nome")).data ?? [],
  });

  const { data: precos } = useQuery({
    queryKey: ["imec-investimento-precos"],
    queryFn: async () =>
      ((await supabase.from("imec_investimento_precos").select("*").order("produto")).data ??
        []) as Preco[],
  });
  const precoIdx = useMemo(() => buildPrecoIndex(precos ?? []), [precos]);

  const { data: nfs, isLoading } = useQuery({
    queryKey: ["imec-investimento-nf", anos, meses, clientesSel, empresasSel],
    queryFn: async () => {
      let q = supabase
        .from("imec_notas_fiscais")
        .select(
          "id,data,numero,empresa,valor,cliente_id,imec_clientes(nome),imec_investimento_nf!inner(id,status,data_cobranca,data_pagamento,observacao)",
        )
        .order("data", { ascending: false })
        .limit(5000);

      if (anos.length > 0 && meses.length > 0) {
        const ranges: string[] = [];
        anos.forEach((a) =>
          meses.forEach((m) => {
            const start = `${a}-${String(m).padStart(2, "0")}-01`;
            const end = new Date(Number(a), Number(m), 0).toISOString().slice(0, 10);
            ranges.push(`and(data.gte.${start},data.lte.${end})`);
          }),
        );
        q = q.or(ranges.join(","));
      } else if (anos.length > 0) {
        const ranges = anos.map((a) => `and(data.gte.${a}-01-01,data.lte.${a}-12-31)`);
        q = q.or(ranges.join(","));
      }
      if (clientesSel.length > 0) q = q.in("cliente_id", clientesSel);
      if (empresasSel.length > 0) q = q.in("empresa", empresasSel);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as NF[];
    },
  });

  const nfIds = useMemo(() => (nfs ?? []).map((n) => n.id), [nfs]);

  const { data: itens } = useQuery({
    queryKey: ["imec-investimento-itens", nfIds.slice().sort().join("|")],
    enabled: nfIds.length > 0,
    queryFn: async () => {
      const out: ItemNF[] = [];
      const BATCH = 150;
      for (let i = 0; i < nfIds.length; i += BATCH) {
        const { data } = await supabase
          .from("imec_itens_nf")
          .select("nota_fiscal_id,ean,quantidade")
          .in("nota_fiscal_id", nfIds.slice(i, i + BATCH));
        out.push(...((data ?? []) as ItemNF[]));
      }
      return out;
    },
  });

  const itensPorNf = useMemo(() => {
    const m = new Map<string, ItemNF[]>();
    (itens ?? []).forEach((it) => {
      const arr = m.get(it.nota_fiscal_id) ?? [];
      arr.push(it);
      m.set(it.nota_fiscal_id, arr);
    });
    return m;
  }, [itens]);

  type Row = NF & { investimento: number };
  const linhas: Row[] = useMemo(() => {
    return (nfs ?? [])
      .map((n) => ({ ...n, investimento: calcInvestimento(itensPorNf.get(n.id) ?? [], precoIdx) }))
      .filter((n) => n.investimento > 0);
  }, [nfs, itensPorNf, precoIdx]);

  const linhasFiltradasStatus = useMemo(() => {
    if (statusSel.length === 0) return linhas;
    return linhas.filter((n) => statusSel.includes(n.imec_investimento_nf?.status ?? "pendente"));
  }, [linhas, statusSel]);

  const colGetters = useMemo(
    () => ({
      data: (n: Row) => formatDateBR(n.data),
      numero: (n: Row) => n.numero,
      empresa: (n: Row) => n.empresa,
      cliente: (n: Row) => n.imec_clientes?.nome ?? "",
      investimento: (n: Row) => String(n.investimento),
      status: (n: Row) => n.imec_investimento_nf?.status ?? "pendente",
    }),
    [],
  );
  const colTypes = useMemo(
    () => ({
      data: "date" as const,
      numero: "text" as const,
      empresa: "text" as const,
      cliente: "text" as const,
      investimento: "number" as const,
      status: "text" as const,
    }),
    [],
  );
  const { view, distinct, filters, sorts, setFilter, setSort, reset } = useColumnFilters(
    linhasFiltradasStatus,
    colGetters,
    colTypes,
  );

  const totalInvestimento = useMemo(
    () => linhasFiltradasStatus.reduce((a, n) => a + n.investimento, 0),
    [linhasFiltradasStatus],
  );

  const atualizar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("imec_investimento_recheck_recentes");
      if (error) throw error;
      return data as number;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["imec-investimento-nf"] });
      toast.success(
        count > 0
          ? `${count} NF(s) nova(s) entraram na lista.`
          : "Lista já está em dia, nada novo encontrado.",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const atualizarCampo = useMutation({
    mutationFn: async (vars: { id: string; campo: string; valor: string | null }) => {
      const { error } = await supabase
        .from("imec_investimento_nf")
        .update({
          [vars.campo]: vars.valor,
        } as Database["public"]["Tables"]["imec_investimento_nf"]["Update"])
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["imec-investimento-nf"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("imec_investimento_nf").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["imec-investimento-nf"] });
      toast.success("NF removida da lista de investimento (a NF em si não foi apagada).");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold">Investimento</h1>
          <p className="text-muted-foreground mt-1">
            NFs faturadas que geram verba de investimento (IMEC/NUTIVIT), com controle de cobrança e
            pagamento.
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBuscaOpen(true)}
              className="h-9 px-3 rounded-md bg-secondary hover:bg-secondary/80 inline-flex items-center gap-1.5 text-sm font-medium"
            >
              <Plus className="h-4 w-4" /> Incluir NF antiga
            </button>
            <button
              onClick={() => setPrecosOpen(true)}
              className="h-9 px-3 rounded-md bg-secondary hover:bg-secondary/80 inline-flex items-center gap-1.5 text-sm font-medium"
            >
              <Settings2 className="h-4 w-4" /> Tabela de preços
            </button>
            <button
              onClick={() => atualizar.mutate()}
              disabled={atualizar.isPending}
              className="h-9 px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5 text-sm font-medium disabled:opacity-50"
            >
              {atualizar.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              Atualizar lista
            </button>
          </div>
        )}
      </div>

      <div className="bi-card mt-6 p-4 flex flex-wrap items-center gap-3">
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
          width={180}
          placeholder="Todos os status"
          options={STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
          selected={statusSel}
          onChange={setStatusSel}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        <div className="bi-card p-4">
          <div className="bi-stat-label">NFs com investimento</div>
          <div className="text-2xl font-bold tabular-nums mt-1">
            {linhasFiltradasStatus.length.toLocaleString("pt-BR")}
          </div>
        </div>
        <div className="bi-card p-4">
          <div className="bi-stat-label">Investimento total (filtros aplicados)</div>
          <div className="text-2xl font-bold tabular-nums mt-1 text-primary">
            {formatBRL(totalInvestimento)}
          </div>
        </div>
        <div className="bi-card p-4">
          <div className="bi-stat-label">Pendentes</div>
          <div className="text-2xl font-bold tabular-nums mt-1">
            {
              linhasFiltradasStatus.filter(
                (n) => (n.imec_investimento_nf?.status ?? "pendente") === "pendente",
              ).length
            }
          </div>
        </div>
      </div>

      <div className="bi-card mt-4 overflow-x-auto">
        <div className="flex justify-end px-3 py-1.5">
          <ClearFiltersButton filters={filters} sorts={sorts} onReset={reset} />
        </div>
        <table className="bi-table">
          <thead>
            <tr>
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
                  label="Investimento"
                  align="right"
                  type="number"
                  values={distinct.investimento ?? []}
                  selected={filters.investimento ?? []}
                  onChange={(v) => setFilter("investimento", v)}
                  sort={sorts.investimento ?? null}
                  onSortChange={(s) => setSort("investimento", s)}
                />
              </th>
              <th>Status</th>
              <th>Cobrado em</th>
              <th>Pago em</th>
              <th>Observação</th>
              {canEdit && <th style={{ width: 40 }} />}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={9} className="text-center text-muted-foreground py-10">
                  Carregando…
                </td>
              </tr>
            )}
            {!isLoading && view.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center text-muted-foreground py-10">
                  Nenhuma NF com investimento encontrada com os filtros aplicados.
                </td>
              </tr>
            )}
            {!isLoading &&
              view.map((n) => {
                const t = n.imec_investimento_nf;
                if (!t) return null;
                return (
                  <tr key={n.id}>
                    <td className="tabular-nums">{formatDateBR(n.data)}</td>
                    <td className="font-medium">{n.numero}</td>
                    <td className="text-xs">{n.empresa}</td>
                    <td>{n.imec_clientes?.nome ?? "—"}</td>
                    <td className="text-right tabular-nums font-semibold text-primary">
                      {formatBRL(n.investimento)}
                    </td>
                    <td>
                      {canEdit ? (
                        <select
                          value={t.status}
                          onChange={(e) =>
                            atualizarCampo.mutate({
                              id: t.id,
                              campo: "status",
                              valor: e.target.value,
                            })
                          }
                          className="bi-input-sm"
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <StatusBadge status={t.status} />
                      )}
                    </td>
                    <td>
                      {canEdit ? (
                        <input
                          type="date"
                          value={t.data_cobranca ?? ""}
                          onChange={(e) =>
                            atualizarCampo.mutate({
                              id: t.id,
                              campo: "data_cobranca",
                              valor: e.target.value || null,
                            })
                          }
                          className="bi-input-sm"
                        />
                      ) : t.data_cobranca ? (
                        formatDateBR(t.data_cobranca)
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {canEdit ? (
                        <input
                          type="date"
                          value={t.data_pagamento ?? ""}
                          onChange={(e) =>
                            atualizarCampo.mutate({
                              id: t.id,
                              campo: "data_pagamento",
                              valor: e.target.value || null,
                            })
                          }
                          className="bi-input-sm"
                        />
                      ) : t.data_pagamento ? (
                        formatDateBR(t.data_pagamento)
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {canEdit ? (
                        <input
                          defaultValue={t.observacao ?? ""}
                          onBlur={(e) =>
                            atualizarCampo.mutate({
                              id: t.id,
                              campo: "observacao",
                              valor: e.target.value || null,
                            })
                          }
                          placeholder="Observação..."
                          className="bi-input-sm w-full"
                        />
                      ) : (
                        (t.observacao ?? "—")
                      )}
                    </td>
                    {canEdit && (
                      <td className="text-center">
                        <button
                          type="button"
                          title="Tirar da lista de investimento (não apaga a NF)"
                          onClick={() => {
                            if (confirm(`Remover a NF ${n.numero} da lista de investimento?`))
                              remover.mutate(t.id);
                          }}
                          className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-destructive/10 text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>TOTAL</td>
              <td className="text-right text-primary tabular-nums">
                {formatBRL(totalInvestimento)}
              </td>
              <td colSpan={4} />
            </tr>
          </tfoot>
        </table>
      </div>

      {precosOpen && <PrecosDialog onClose={() => setPrecosOpen(false)} />}
      {buscaOpen && <IncluirNfDialog onClose={() => setBuscaOpen(false)} />}
    </div>
  );
}

function PrecosDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: precos } = useQuery({
    queryKey: ["imec-investimento-precos"],
    queryFn: async () =>
      ((await supabase.from("imec_investimento_precos").select("*").order("produto")).data ??
        []) as Preco[],
  });

  const salvar = useMutation({
    mutationFn: async (vars: { id: string; campo: string; valor: string | number | boolean }) => {
      const { error } = await supabase
        .from("imec_investimento_precos")
        .update({
          [vars.campo]: vars.valor,
        } as Database["public"]["Tables"]["imec_investimento_precos"]["Update"])
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["imec-investimento-precos"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const criar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("imec_investimento_precos")
        .insert({ ean: "", produto: "Novo produto", preco_custo: 0, preco_final: 0 });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["imec-investimento-precos"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("imec_investimento_precos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["imec-investimento-precos"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tabela de preços de investimento</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">
          Preço de custo (distribuidor parceiro) e preço final (repassado ao cliente) por produto. A
          diferença entre os dois é o que gera investimento por unidade faturada. Desative um
          produto (em vez de apagar) se ele parar de gerar investimento.
        </p>
        <div className="overflow-x-auto">
          <table className="bi-table">
            <thead>
              <tr>
                <th>EAN</th>
                <th>Produto</th>
                <th className="text-right">Preço custo</th>
                <th className="text-right">Preço final</th>
                <th className="text-center">Ativo</th>
                <th style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {(precos ?? []).map((p) => (
                <tr key={p.id}>
                  <td>
                    <input
                      defaultValue={p.ean}
                      onBlur={(e) =>
                        salvar.mutate({ id: p.id, campo: "ean", valor: e.target.value.trim() })
                      }
                      className="bi-input-sm w-32"
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
                      type="number"
                      step="0.0001"
                      defaultValue={Number(p.preco_custo)}
                      onBlur={(e) =>
                        salvar.mutate({
                          id: p.id,
                          campo: "preco_custo",
                          valor: Number(e.target.value) || 0,
                        })
                      }
                      className="bi-input-sm w-28 text-right"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.0001"
                      defaultValue={Number(p.preco_final)}
                      onBlur={(e) =>
                        salvar.mutate({
                          id: p.id,
                          campo: "preco_final",
                          valor: Number(e.target.value) || 0,
                        })
                      }
                      className="bi-input-sm w-28 text-right"
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
                        if (confirm(`Remover "${p.produto}" da tabela de preços?`))
                          remover.mutate(p.id);
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

function IncluirNfDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");

  const { data: resultados, isFetching } = useQuery({
    queryKey: ["imec-investimento-busca-nf", busca],
    enabled: busca.trim().length >= 2,
    queryFn: async () => {
      const term = `%${busca.trim()}%`;
      const { data, error } = await supabase
        .from("imec_notas_fiscais")
        .select("id,data,numero,empresa,valor,imec_clientes(nome),imec_investimento_nf(id)")
        .or(`numero.ilike.${term}`)
        .order("data", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as unknown as NF[];
    },
  });

  const incluir = useMutation({
    mutationFn: async (nfId: string) => {
      const { error } = await supabase
        .from("imec_investimento_nf")
        .insert({ nota_fiscal_id: nfId, status: "pendente" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["imec-investimento-nf"] });
      qc.invalidateQueries({ queryKey: ["imec-investimento-busca-nf"] });
      toast.success("NF incluída na lista de investimento.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Incluir NF antiga no acompanhamento</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">
          Busque pelo número da NF para trazer de volta uma nota fiscal de fora da janela dos
          últimos 2 meses.
        </p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Número da NF..."
            className="bi-input-sm w-full pl-10"
          />
        </div>
        <div className="max-h-80 overflow-y-auto space-y-1.5">
          {isFetching && (
            <p className="text-sm text-muted-foreground py-4 text-center">Buscando…</p>
          )}
          {!isFetching && busca.trim().length >= 2 && (resultados ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma NF encontrada.</p>
          )}
          {(resultados ?? []).map((n) => {
            const jaIncluida = !!n.imec_investimento_nf;
            return (
              <div
                key={n.id}
                className="flex items-center justify-between gap-3 p-2.5 rounded-md border border-border"
              >
                <div className="min-w-0">
                  <div className="font-medium text-sm">
                    NF {n.numero} · {n.empresa} · {formatDateBR(n.data)}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {n.imec_clientes?.nome ?? "—"} · {formatBRL(n.valor)}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={jaIncluida || incluir.isPending}
                  onClick={() => incluir.mutate(n.id)}
                  className="h-8 px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 text-xs font-semibold shrink-0"
                >
                  {jaIncluida ? "Já incluída" : "Incluir"}
                </button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
