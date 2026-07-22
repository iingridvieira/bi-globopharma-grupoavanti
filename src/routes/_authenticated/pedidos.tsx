import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDateBR, parseBRNumber, MESES_BR } from "@/lib/format";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { exportToExcel } from "@/lib/excel";
import { Download, Send, Pencil, Trash2, Check, X, ChevronRight, ChevronDown, Plus, Package } from "lucide-react";
import { MultiSelect } from "@/components/MultiSelect";
import { ColumnFilterHeader, ClearFiltersButton, useColumnFilters } from "@/components/ColumnFilterHeader";
import { ClienteLink } from "@/components/ClienteLink";

export const Route = createFileRoute("/_authenticated/pedidos")({ component: PedidosPage });

const normNome = (s: string) => (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();

const RESPONSAVEIS: Record<string, string[]> = {
  Alexandre: ["ANDORINHA", "BANDEIRANTES", "DISMAP", "IMPACTA MED", "MAXIFARMA", "NÚCLEO FARMA", "DISMED", "MED VALLE", "GEMELI"],
  Eduardo: ["CAMPEÃ", "CG MEDICAMENTOS", "DF COMERCIAL", "FARMA CONDE", "MEDLOG"],
};
function normNomeNF(s: string): string {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

type PedidoItem = {
  id: string;
  pedido_id: string;
  ean: string | null;
  descricao: string;
  preco_passado: number | string;
  quantidade: number | string;
};

function PedidosPage() {
  const { canEdit, restrictedClientes } = useAuth();
  const allowedNameSet = restrictedClientes ? new Set(restrictedClientes.map(normNome)) : null;
  const qc = useQueryClient();
  const now = new Date();
  const [meses, setMeses] = useState<string[]>([String(now.getMonth() + 1)]);
  const [anos, setAnos] = useState<string[]>([String(now.getFullYear())]);
  const [clientesSel, setClientesSel] = useState<string[]>([]);
  const [responsavel, setResponsavel] = useState<string>("");

  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [clienteId, setClienteId] = useState("");
  const [valor, setValor] = useState("");
  const [ordemCompra, setOrdemCompra] = useState("");
  const [prazo, setPrazo] = useState("");

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: clientes } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => (await supabase.from("clientes").select("id,nome").order("nome")).data ?? [],
  });

  const clientesPorResponsavel = useMemo(() => {
    const map: Record<string, Set<string>> = { Alexandre: new Set(), Eduardo: new Set(), Paulo: new Set() };
    const alexNorm = RESPONSAVEIS.Alexandre.map(normNomeNF);
    const eduNorm = RESPONSAVEIS.Eduardo.map(normNomeNF);
    (clientes ?? []).forEach((c) => {
      const n = normNomeNF(c.nome);
      if (alexNorm.includes(n)) map.Alexandre.add(c.id);
      else if (eduNorm.includes(n)) map.Eduardo.add(c.id);
      else map.Paulo.add(c.id);
    });
    return map;
  }, [clientes]);

  const { data: pedidos } = useQuery({
    queryKey: ["pedidos", anos, meses, clientesSel],
    queryFn: async () => {
      let q = supabase.from("pedidos_enviados")
        .select("id,data,valor,status,cliente_id,ordem_compra,prazo,clientes(nome)")
        .order("data", { ascending: false });

      const anosNum = anos.map(Number);
      const mesesNum = meses.map(Number);
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
      } else {
        return [];
      }
      if (clientesSel.length > 0) q = q.in("cliente_id", clientesSel);
      const { data } = await q;
      return data ?? [];
    },
  });

  // Contagem de itens por pedido (para exibir badge)
  const pedidoIds = useMemo(() => (pedidos ?? []).map((p) => p.id), [pedidos]);
  const { data: itensCount } = useQuery({
    queryKey: ["pedido-itens-count", pedidoIds.slice().sort().join("|")],
    enabled: pedidoIds.length > 0,
    queryFn: async () => {
      const map: Record<string, number> = {};
      const BATCH = 200;
      for (let i = 0; i < pedidoIds.length; i += BATCH) {
        const { data } = await supabase
          .from("pedido_itens")
          .select("pedido_id")
          .in("pedido_id", pedidoIds.slice(i, i + BATCH));
        (data ?? []).forEach((r) => { map[r.pedido_id] = (map[r.pedido_id] ?? 0) + 1; });
      }
      return map;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("pedidos_enviados").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["pedidos"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updatePedido = useMutation({
    mutationFn: async ({ id, data, cliente_id, valor, ordem_compra, prazo }: { id: string; data: string; cliente_id: string; valor: number; ordem_compra: string | null; prazo: string | null }) => {
      const { error } = await supabase.from("pedidos_enviados").update({ data, cliente_id, valor, ordem_compra, prazo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Pedido atualizado"); setEditId(null); void qc.invalidateQueries({ queryKey: ["pedidos"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const removePedido = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pedidos_enviados").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Pedido removido"); void qc.invalidateQueries({ queryKey: ["pedidos"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState("");
  const [editClienteId, setEditClienteId] = useState("");
  const [editValor, setEditValor] = useState("");
  const [editOrdemCompra, setEditOrdemCompra] = useState("");
  const [editPrazo, setEditPrazo] = useState("");

  function startEdit(p: { id: string; data: string; cliente_id: string; valor: number | string; ordem_compra: string | null; prazo: string | null }) {
    setEditId(p.id);
    setEditData(p.data);
    setEditClienteId(p.cliente_id);
    setEditValor(String(p.valor).replace(".", ","));
    setEditOrdemCompra(p.ordem_compra ?? "");
    setEditPrazo(p.prazo ?? "");
  }

  const clientesVisiveis = allowedNameSet
    ? (clientes ?? []).filter((c) => allowedNameSet.has(normNome(c.nome)))
    : (clientes ?? []);
  const baseFiltrados = allowedNameSet
    ? (pedidos ?? []).filter((p) => p.clientes?.nome && allowedNameSet.has(normNome(p.clientes.nome)))
    : (pedidos ?? []);
  const porResponsavel = responsavel
    ? baseFiltrados.filter((p) => clientesPorResponsavel[responsavel]?.has(p.cliente_id))
    : baseFiltrados;
  const filtrados = porResponsavel;

  type PedRow = typeof filtrados[number];
  const pedGetters = useMemo(() => ({
    data: (p: PedRow) => formatDateBR(p.data),
    cliente: (p: PedRow) => p.clientes?.nome ?? "",
    valor: (p: PedRow) => String(p.valor),
    ordem: (p: PedRow) => p.ordem_compra ?? "",
    prazo: (p: PedRow) => p.prazo ?? "",
    status: (p: PedRow) => (p.status === "aprovado" ? "APROVADO" : "AGUARDANDO"),
  }), []);
  const pedTypes = useMemo(() => ({ data: "date" as const, cliente: "text" as const, valor: "number" as const, ordem: "text" as const, prazo: "text" as const, status: "text" as const }), []);
  const { view: pedView, distinct: pedDistinct, filters: pedFilters, sorts: pedSorts, setFilter: setPedFilter, setSort: setPedSort, reset: resetPed } =
    useColumnFilters(filtrados, pedGetters, pedTypes);

  const total = pedView.reduce((a, p) => a + Number(p.valor), 0);

  const create = useMutation({
    mutationFn: async () => {
      const v = parseBRNumber(valor);
      const { data: inserted, error } = await supabase.from("pedidos_enviados").insert({
        data,
        cliente_id: clienteId,
        valor: v,
        ordem_compra: ordemCompra.trim() || null,
        prazo: prazo.trim() || null,
      }).select("id").single();
      if (error) throw error;
      return inserted?.id as string | undefined;
    },
    onSuccess: (newId) => {
      toast.success("Pedido registrado — adicione os itens abaixo");
      setValor(""); setOrdemCompra(""); setPrazo("");
      if (newId) setExpanded((prev) => { const n = new Set(prev); n.add(newId); return n; });
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggleExpanded(id: string) {
    setExpanded((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  function handleExport() {
    const rows = filtrados.map((p) => ({
      Data: formatDateBR(p.data),
      Cliente: p.clientes?.nome ?? "",
      Valor: Number(p.valor),
      "Ordem de compra": p.ordem_compra ?? "",
      Prazo: p.prazo ?? "",
      Status: p.status === "aprovado" ? "APROVADO" : "AGUARDANDO",
    }));
    exportToExcel(rows, `pedidos-${anos.join("_")}-${meses.join("_")}.xlsx`, "Pedidos");
  }

  const nColunas = canEdit ? 8 : 7;

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <h1 className="font-display text-3xl font-bold">Pedidos Enviados</h1>
      <p className="text-muted-foreground mt-1">Histórico mensal de pedidos enviados aos clientes.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div className="bi-card-accent p-5">
          <div className="flex items-start justify-between">
            <div className="text-primary-foreground/80 bi-stat-label">Total de pedidos enviados</div>
            <Send className="h-5 w-5 text-primary-foreground/80" strokeWidth={2} />
          </div>
          <div className="bi-stat-value mt-3 text-3xl">{formatBRL(total)}</div>
          <div className="text-xs mt-1 text-primary-foreground/75">{filtrados.length} pedido{filtrados.length === 1 ? "" : "s"} no período</div>
        </div>
      </div>

      {canEdit && (
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
          className="bi-card p-5 grid grid-cols-1 md:grid-cols-6 gap-3 mt-6">
          <div className="md:col-span-6 bi-stat-label">Adicionar Pedido</div>
          <Field label="Data">
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} required className="bi-input-sm" />
          </Field>
          <Field label="Cliente">
            <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} required className="bi-input-sm">
              <option value="">Selecione...</option>
              {(clientes ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Field>
          <Field label="Valor (R$)">
            <input value={valor} onChange={(e) => setValor(e.target.value)} required placeholder="0,00" className="bi-input-sm" />
          </Field>
          <Field label="Ordem de compra">
            <input value={ordemCompra} onChange={(e) => setOrdemCompra(e.target.value)} placeholder="Nº OC" className="bi-input-sm" />
          </Field>
          <Field label="Prazo">
            <input value={prazo} onChange={(e) => setPrazo(e.target.value)} placeholder="Ex.: 7 dias, imediato" className="bi-input-sm" />
          </Field>
          <div className="flex items-end">
            <button disabled={create.isPending} className="h-10 px-5 rounded-md bg-primary text-primary-foreground font-semibold uppercase text-xs tracking-wider hover:opacity-90 disabled:opacity-50 w-full">
              Adicionar
            </button>
          </div>
          <div className="md:col-span-6 text-xs text-muted-foreground">
            Depois de criar o pedido, clique na seta ao lado para adicionar os itens (EAN, descrição, preço passado e quantidade).
          </div>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-3 mt-5">
        <MultiSelect width={220} placeholder="Meses" options={MESES_BR.map((m, i) => ({ value: String(i + 1), label: m }))} selected={meses} onChange={setMeses} />
        <MultiSelect width={160} placeholder="Anos" options={[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((a) => ({ value: String(a), label: String(a) }))} selected={anos} onChange={setAnos} />
        <MultiSelect width={260} placeholder="Todos os clientes" options={clientesVisiveis.map((c) => ({ value: c.id, label: c.nome }))} selected={clientesSel} onChange={setClientesSel} />
        <select value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className="bi-input-sm w-44">
          <option value="">Representantes</option>
          <option value="Alexandre">Alexandre</option>
          <option value="Eduardo">Eduardo</option>
          <option value="Paulo">Paulo</option>
        </select>
        <button onClick={handleExport} className="h-10 px-4 rounded-md bg-secondary text-secondary-foreground text-sm font-semibold flex items-center gap-2">
          <Download className="h-4 w-4" /> Exportar
        </button>
      </div>

      <div className="bi-card mt-6 overflow-hidden">
        <div className="flex justify-end px-3 py-1.5">
          <ClearFiltersButton filters={pedFilters} sorts={pedSorts} onReset={resetPed} />
        </div>
        <div className="overflow-x-auto">
          <table className="bi-table">
            <thead>
              <tr>
                <th className="w-8" />
                <th><ColumnFilterHeader label="Data" type="date" values={pedDistinct.data ?? []} selected={pedFilters.data ?? []} onChange={(v) => setPedFilter("data", v)} sort={pedSorts.data ?? null} onSortChange={(s) => setPedSort("data", s)} /></th>
                <th><ColumnFilterHeader label="Cliente" values={pedDistinct.cliente ?? []} selected={pedFilters.cliente ?? []} onChange={(v) => setPedFilter("cliente", v)} sort={pedSorts.cliente ?? null} onSortChange={(s) => setPedSort("cliente", s)} /></th>
                <th className="text-right"><ColumnFilterHeader label="Valor" align="right" type="number" values={pedDistinct.valor ?? []} selected={pedFilters.valor ?? []} onChange={(v) => setPedFilter("valor", v)} sort={pedSorts.valor ?? null} onSortChange={(s) => setPedSort("valor", s)} /></th>
                <th><ColumnFilterHeader label="Ordem de compra" values={pedDistinct.ordem ?? []} selected={pedFilters.ordem ?? []} onChange={(v) => setPedFilter("ordem", v)} sort={pedSorts.ordem ?? null} onSortChange={(s) => setPedSort("ordem", s)} /></th>
                <th><ColumnFilterHeader label="Prazo" type="date" values={pedDistinct.prazo ?? []} selected={pedFilters.prazo ?? []} onChange={(v) => setPedFilter("prazo", v)} sort={pedSorts.prazo ?? null} onSortChange={(s) => setPedSort("prazo", s)} /></th>
                <th className="text-center"><ColumnFilterHeader label="Status" align="center" values={pedDistinct.status ?? []} selected={pedFilters.status ?? []} onChange={(v) => setPedFilter("status", v)} sort={pedSorts.status ?? null} onSortChange={(s) => setPedSort("status", s)} /></th>
                {canEdit && <th className="text-center">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {pedView.map((p) => {
                const aprovado = p.status === "aprovado";
                const isEditing = editId === p.id;
                const isOpen = expanded.has(p.id);
                const count = itensCount?.[p.id] ?? 0;
                if (isEditing) {
                  return (
                    <tr key={p.id}>
                      <td />
                      <td><input type="date" value={editData} onChange={(e) => setEditData(e.target.value)} className="bi-input-sm" /></td>
                      <td>
                        <select value={editClienteId} onChange={(e) => setEditClienteId(e.target.value)} className="bi-input-sm">
                          {clientesVisiveis.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                      </td>
                      <td className="text-right"><input value={editValor} onChange={(e) => setEditValor(e.target.value)} className="bi-input-sm text-right" /></td>
                      <td><input value={editOrdemCompra} onChange={(e) => setEditOrdemCompra(e.target.value)} className="bi-input-sm" placeholder="Nº OC" /></td>
                      <td><input value={editPrazo} onChange={(e) => setEditPrazo(e.target.value)} className="bi-input-sm" placeholder="Ex.: 7 dias" /></td>
                      <td className="text-center text-xs text-muted-foreground">{aprovado ? "APROVADO" : "AGUARDANDO"}</td>
                      <td className="text-center">
                        <div className="inline-flex gap-1">
                          <button type="button" title="Salvar" disabled={updatePedido.isPending} onClick={() => updatePedido.mutate({ id: p.id, data: editData, cliente_id: editClienteId, valor: parseBRNumber(editValor), ordem_compra: editOrdemCompra.trim() || null, prazo: editPrazo || null })} className="h-8 w-8 inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50">
                            <Check className="h-4 w-4" />
                          </button>
                          <button type="button" title="Cancelar" onClick={() => setEditId(null)} className="h-8 w-8 inline-flex items-center justify-center rounded-md bg-secondary text-secondary-foreground hover:opacity-90">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }
                return (
                  <>
                    <tr key={p.id}>
                      <td className="text-center">
                        <button type="button" onClick={() => toggleExpanded(p.id)} className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-accent" title={isOpen ? "Ocultar itens" : "Ver itens"}>
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      </td>
                      <td>{formatDateBR(p.data)}</td>
                      <td>
                        <ClienteLink id={p.cliente_id} nome={p.clientes?.nome} />
                        {count > 0 && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/10 border border-primary/30 rounded-full px-1.5 py-0.5" title={`${count} item(s) cadastrado(s)`}>
                            <Package className="h-2.5 w-2.5" />{count}
                          </span>
                        )}
                      </td>
                      <td className="text-right tabular-nums">{formatBRL(p.valor)}</td>
                      <td>{p.ordem_compra ?? "—"}</td>
                      <td>{p.prazo ?? "—"}</td>
                      <td className="text-center">
                        <button
                          type="button"
                          disabled={!canEdit || updateStatus.isPending}
                          onClick={() => updateStatus.mutate({ id: p.id, status: aprovado ? "aguardando" : "aprovado" })}
                          title={canEdit ? "Clique para alternar status" : "Sem permissão para editar"}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-opacity ${canEdit ? "cursor-pointer hover:opacity-80" : "cursor-default"} ${aprovado ? "bg-green-500/15 text-green-500 border border-green-500/30" : "bg-yellow-500/15 text-yellow-500 border border-yellow-500/30"}`}
                        >
                          <span className={`h-2 w-2 rounded-full ${aprovado ? "bg-green-500" : "bg-yellow-500"}`} />
                          {aprovado ? "APROVADO" : "AGUARDANDO"}
                        </button>
                      </td>
                      {canEdit && (
                        <td className="text-center">
                          <div className="inline-flex gap-1">
                            <button type="button" title="Editar" onClick={() => startEdit(p)} className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-border hover:bg-accent">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              title="Remover"
                              disabled={removePedido.isPending}
                              onClick={() => {
                                if (confirm(`Remover pedido de ${p.clientes?.nome ?? ""} (${formatBRL(p.valor)})?`)) {
                                  removePedido.mutate(p.id);
                                }
                              }}
                              className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                    {isOpen && (
                      <tr key={p.id + "-itens"}>
                        <td colSpan={nColunas} className="bg-muted/20 border-t border-b border-border p-0">
                          <ItensPedidoBlock pedidoId={p.id} canEdit={canEdit} />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
              {filtrados.length === 0 && <tr><td colSpan={nColunas} className="text-center text-muted-foreground py-8">Nenhum pedido neste período.</td></tr>}
            </tbody>
            <tfoot>
              <tr><td /><td colSpan={2}>TOTAL ({filtrados.length})</td><td className="text-right text-primary">{formatBRL(total)}</td><td /><td /><td />{canEdit && <td />}</tr>
            </tfoot>
          </table>
        </div>
      </div>

      <SmallStyles />
    </div>
  );
}

function ItensPedidoBlock({ pedidoId, canEdit }: { pedidoId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const [ean, setEan] = useState("");
  const [descricao, setDescricao] = useState("");
  const [precoPassado, setPrecoPassado] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [lookingUp, setLookingUp] = useState(false);

  const { data: itens, isLoading } = useQuery({
    queryKey: ["pedido-itens", pedidoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedido_itens")
        .select("id,pedido_id,ean,descricao,preco_passado,quantidade")
        .eq("pedido_id", pedidoId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PedidoItem[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!descricao.trim()) throw new Error("Informe a descrição do produto");
      const { error } = await supabase.from("pedido_itens").insert({
        pedido_id: pedidoId,
        ean: ean.trim() || null,
        descricao: descricao.trim(),
        preco_passado: parseBRNumber(precoPassado || "0"),
        quantidade: parseBRNumber(quantidade || "0"),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item adicionado");
      setEan(""); setDescricao(""); setPrecoPassado(""); setQuantidade("");
      void qc.invalidateQueries({ queryKey: ["pedido-itens", pedidoId] });
      void qc.invalidateQueries({ queryKey: ["pedido-itens-count"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pedido_itens").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["pedido-itens", pedidoId] });
      void qc.invalidateQueries({ queryKey: ["pedido-itens-count"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function lookupEan(code: string) {
    const clean = code.trim();
    if (!clean) return;
    setLookingUp(true);
    try {
      // 1) itens_nf por EAN exato
      let hit = await supabase.from("itens_nf").select("produto").eq("ean", clean).limit(1).maybeSingle();
      if (!hit.data) {
        // 2) itens_nf por codigo_produto
        hit = await supabase.from("itens_nf").select("produto").eq("codigo_produto", clean).limit(1).maybeSingle();
      }
      if (!hit.data) {
        // 3) descricoes_sell_in (fallback textual)
        const alt = await supabase.from("descricoes_sell_in").select("titulo,texto").ilike("texto", `%${clean}%`).limit(1).maybeSingle();
        if (alt.data) {
          const t = (alt.data.titulo ?? alt.data.texto ?? "").toString().trim();
          if (t) setDescricao(t);
        }
      } else if (hit.data.produto) {
        setDescricao(hit.data.produto);
      } else {
        toast.info("EAN não encontrado. Informe a descrição manualmente.");
      }
    } finally {
      setLookingUp(false);
    }
  }

  const totalItens = (itens ?? []).reduce((a, it) => a + Number(it.preco_passado) * Number(it.quantidade), 0);

  return (
    <div className="p-4 space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Itens do pedido</div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando itens...</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
              <th className="py-2 pr-3">EAN</th>
              <th className="py-2 pr-3">Descrição</th>
              <th className="py-2 pr-3 text-right">Preço passado</th>
              <th className="py-2 pr-3 text-right">Quantidade</th>
              <th className="py-2 pr-3 text-right">Subtotal</th>
              {canEdit && <th />}
            </tr>
          </thead>
          <tbody>
            {(itens ?? []).map((it) => (
              <tr key={it.id} className="border-b border-border/60">
                <td className="py-2 pr-3 font-mono text-xs">{it.ean ?? "—"}</td>
                <td className="py-2 pr-3">{it.descricao}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{formatBRL(it.preco_passado)}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{Number(it.quantidade).toLocaleString("pt-BR")}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{formatBRL(Number(it.preco_passado) * Number(it.quantidade))}</td>
                {canEdit && (
                  <td className="py-2 pr-3 text-right">
                    <button type="button" title="Remover item" onClick={() => { if (confirm("Remover este item?")) remove.mutate(it.id); }} className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {(itens ?? []).length === 0 && (
              <tr><td colSpan={canEdit ? 6 : 5} className="py-3 text-center text-muted-foreground text-xs">Nenhum item cadastrado.</td></tr>
            )}
          </tbody>
          {(itens ?? []).length > 0 && (
            <tfoot>
              <tr className="font-semibold">
                <td colSpan={4} className="py-2 pr-3 text-right text-xs uppercase text-muted-foreground">Total dos itens</td>
                <td className="py-2 pr-3 text-right tabular-nums text-primary">{formatBRL(totalItens)}</td>
                {canEdit && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      )}

      {canEdit && (
        <form
          onSubmit={(e) => { e.preventDefault(); add.mutate(); }}
          className="grid grid-cols-1 md:grid-cols-12 gap-2 mt-2 pt-3 border-t border-border"
        >
          <div className="md:col-span-3">
            <Field label="Cód. de barras (EAN)">
              <input
                value={ean}
                onChange={(e) => setEan(e.target.value)}
                onBlur={(e) => lookupEan(e.target.value)}
                onPaste={(e) => {
                  const v = e.clipboardData.getData("text");
                  if (v) setTimeout(() => lookupEan(v), 0);
                }}
                placeholder="Cole o EAN"
                className="bi-input-sm font-mono"
              />
            </Field>
          </div>
          <div className="md:col-span-5">
            <Field label={"Descrição" + (lookingUp ? " (buscando...)" : "")}>
              <input value={descricao} onChange={(e) => setDescricao(e.target.value)} required placeholder="Nome do produto" className="bi-input-sm" />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Preço passado">
              <input value={precoPassado} onChange={(e) => setPrecoPassado(e.target.value)} placeholder="0,00" className="bi-input-sm text-right" />
            </Field>
          </div>
          <div className="md:col-span-1">
            <Field label="Qtd.">
              <input value={quantidade} onChange={(e) => setQuantidade(e.target.value)} placeholder="0" className="bi-input-sm text-right" />
            </Field>
          </div>
          <div className="md:col-span-1 flex items-end">
            <button disabled={add.isPending} className="h-10 w-full inline-flex items-center justify-center gap-1 rounded-md bg-primary text-primary-foreground font-semibold text-xs uppercase tracking-wider hover:opacity-90 disabled:opacity-50">
              <Plus className="h-4 w-4" />
              Add
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="bi-stat-label block mb-1.5">{label}</span>{children}</label>;
}
export function PeriodoSelect({ mes, ano, onMes, onAno }: { mes: number; ano: number; onMes: (n: number) => void; onAno: (n: number) => void }) {
  const anoAtual = new Date().getFullYear();
  return (
    <>
      <select value={mes} onChange={(e) => onMes(Number(e.target.value))} className="bi-input-sm w-44">
        {MESES_BR.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
      </select>
      <select value={ano} onChange={(e) => onAno(Number(e.target.value))} className="bi-input-sm w-28">
        {[anoAtual - 1, anoAtual, anoAtual + 1].map((a) => <option key={a} value={a}>{a}</option>)}
      </select>
    </>
  );
}
export function SmallStyles() {
  return (
    <style>{`
      .bi-input-sm { height: 40px; padding: 0 12px; background: var(--color-input); border: 1px solid var(--color-border); border-radius: 6px; color: var(--color-foreground); font-size: 14px; outline: none; }
      .bi-input-sm:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-ring); }
    `}</style>
  );
}
