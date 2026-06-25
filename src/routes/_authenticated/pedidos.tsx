import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDateBR, parseBRNumber, MESES_BR } from "@/lib/format";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { exportToExcel } from "@/lib/excel";
import { Download, Send, Pencil, Trash2, Check, X } from "lucide-react";
import { MultiSelect } from "@/components/MultiSelect";

export const Route = createFileRoute("/_authenticated/pedidos")({ component: PedidosPage });

const normNome = (s: string) => (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();

function PedidosPage() {
  const { canEdit, restrictedClientes, user } = useAuth();
  const allowedNameSet = restrictedClientes ? new Set(restrictedClientes.map(normNome)) : null;
  const qc = useQueryClient();
  const now = new Date();
  const [meses, setMeses] = useState<string[]>([String(now.getMonth() + 1)]);
  const [anos, setAnos] = useState<string[]>([String(now.getFullYear())]);
  const [clientesSel, setClientesSel] = useState<string[]>([]);
  const [representantesSel, setRepresentantesSel] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"data_desc" | "data_asc" | "cliente_asc" | "cliente_desc" | "valor_asc" | "valor_desc">("data_desc");
  

  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [clienteId, setClienteId] = useState("");
  const [valor, setValor] = useState("");

  const { data: clientes } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => (await supabase.from("clientes").select("id,nome").order("nome")).data ?? [],
  });

  const { data: representantes } = useQuery({
    queryKey: ["representantes"],
    queryFn: async () => (await supabase.from("profiles").select("id,nome").order("nome")).data ?? [],
  });

  const { data: pedidos } = useQuery({
    queryKey: ["pedidos", anos, meses, clientesSel, representantesSel],
    queryFn: async () => {
      let q = supabase.from("pedidos_enviados")
        .select("id,data,valor,status,cliente_id,created_by,clientes(nome),profiles(nome)")
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
      if (representantesSel.length > 0) q = q.in("created_by", representantesSel);
      const { data } = await q;
      return data ?? [];
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
    mutationFn: async ({ id, data, cliente_id, valor }: { id: string; data: string; cliente_id: string; valor: number }) => {
      const { error } = await supabase.from("pedidos_enviados").update({ data, cliente_id, valor }).eq("id", id);
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

  function startEdit(p: { id: string; data: string; cliente_id: string; valor: number | string }) {
    setEditId(p.id);
    setEditData(p.data);
    setEditClienteId(p.cliente_id);
    setEditValor(String(p.valor).replace(".", ","));
  }


  const clientesVisiveis = allowedNameSet
    ? (clientes ?? []).filter((c) => allowedNameSet.has(normNome(c.nome)))
    : (clientes ?? []);
  const baseFiltrados = allowedNameSet
    ? (pedidos ?? []).filter((p) => p.clientes?.nome && allowedNameSet.has(normNome(p.clientes.nome)))
    : (pedidos ?? []);
  const filtrados = [...baseFiltrados].sort((a, b) => {
    switch (sortBy) {
      case "data_asc": return String(a.data).localeCompare(String(b.data));
      case "data_desc": return String(b.data).localeCompare(String(a.data));
      case "cliente_asc": return (a.clientes?.nome ?? "").localeCompare(b.clientes?.nome ?? "", "pt-BR");
      case "cliente_desc": return (b.clientes?.nome ?? "").localeCompare(a.clientes?.nome ?? "", "pt-BR");
      case "valor_asc": return Number(a.valor) - Number(b.valor);
      case "valor_desc": return Number(b.valor) - Number(a.valor);
    }
  });
  const total = filtrados.reduce((a, p) => a + Number(p.valor), 0);

  const create = useMutation({
    mutationFn: async () => {
      const v = parseBRNumber(valor);
      const { error } = await supabase.from("pedidos_enviados").insert({ data, cliente_id: clienteId, valor: v, created_by: user?.id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Pedido registrado"); setValor(""); void qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleExport() {
    const rows = filtrados.map((p) => ({
      Data: formatDateBR(p.data),
      Cliente: p.clientes?.nome ?? "",
      Representante: p.created_by ? (representantes ?? []).find((r) => r.id === p.created_by)?.nome ?? "—" : "—",
      Valor: Number(p.valor),
      Status: p.status === "aprovado" ? "APROVADO" : "AGUARDANDO",
    }));
    exportToExcel(rows, `pedidos-${anos.join("_")}-${meses.join("_")}.xlsx`, "Pedidos");
  }


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
          className="bi-card p-5 grid grid-cols-1 md:grid-cols-4 gap-3 mt-6">
          <div className="md:col-span-4 bi-stat-label">Adicionar Pedido</div>
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
          <div className="flex items-end">
            <button disabled={create.isPending} className="h-10 px-5 rounded-md bg-primary text-primary-foreground font-semibold uppercase text-xs tracking-wider hover:opacity-90 disabled:opacity-50 w-full">
              Adicionar
            </button>
          </div>
          <div className="md:col-span-4 text-xs text-muted-foreground">
            Para importação em lote (Excel ou colar manualmente), use a página <strong>Importar Excel</strong>.
          </div>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-3 mt-5">
        <MultiSelect
          width={220}
          placeholder="Meses"
          options={MESES_BR.map((m, i) => ({ value: String(i + 1), label: m }))}
          selected={meses}
          onChange={setMeses}
        />
        <MultiSelect
          width={160}
          placeholder="Anos"
          options={[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((a) => ({ value: String(a), label: String(a) }))}
          selected={anos}
          onChange={setAnos}
        />
        <MultiSelect
          width={260}
          placeholder="Todos os clientes"
          options={clientesVisiveis.map((c) => ({ value: c.id, label: c.nome }))}
          selected={clientesSel}
          onChange={setClientesSel}
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="bi-input-sm"
          style={{ width: 240 }}
          title="Ordenar"
        >
          <option value="data_desc">Data: mais recente → antiga</option>
          <option value="data_asc">Data: antiga → mais recente</option>
          <option value="cliente_asc">Cliente: A → Z</option>
          <option value="cliente_desc">Cliente: Z → A</option>
          <option value="valor_asc">Valor: menor → maior</option>
          <option value="valor_desc">Valor: maior → menor</option>
        </select>

        <button onClick={handleExport} className="h-10 px-4 rounded-md bg-secondary text-secondary-foreground text-sm font-semibold flex items-center gap-2">
          <Download className="h-4 w-4" /> Exportar
        </button>
      </div>




      <div className="bi-card mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="bi-table">
            <thead>
              <tr>
                <th>Data</th><th>Cliente</th><th className="text-right">Valor</th><th className="text-center">Status</th>
                {canEdit && <th className="text-center">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => {
                const aprovado = p.status === "aprovado";
                const isEditing = editId === p.id;
                if (isEditing) {
                  return (
                    <tr key={p.id}>
                      <td><input type="date" value={editData} onChange={(e) => setEditData(e.target.value)} className="bi-input-sm" /></td>
                      <td>
                        <select value={editClienteId} onChange={(e) => setEditClienteId(e.target.value)} className="bi-input-sm">
                          {clientesVisiveis.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                      </td>
                      <td className="text-right"><input value={editValor} onChange={(e) => setEditValor(e.target.value)} className="bi-input-sm text-right" /></td>
                      <td className="text-center text-xs text-muted-foreground">{aprovado ? "APROVADO" : "AGUARDANDO"}</td>
                      <td className="text-center">
                        <div className="inline-flex gap-1">
                          <button type="button" title="Salvar" disabled={updatePedido.isPending} onClick={() => updatePedido.mutate({ id: p.id, data: editData, cliente_id: editClienteId, valor: parseBRNumber(editValor) })} className="h-8 w-8 inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50">
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
                  <tr key={p.id}>
                    <td>{formatDateBR(p.data)}</td>
                    <td>{p.clientes?.nome ?? "—"}</td>
                    <td className="text-right tabular-nums">{formatBRL(p.valor)}</td>
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
                );
              })}
              {filtrados.length === 0 && <tr><td colSpan={canEdit ? 5 : 4} className="text-center text-muted-foreground py-8">Nenhum pedido neste período.</td></tr>}
            </tbody>
            <tfoot>
              <tr><td colSpan={2}>TOTAL ({filtrados.length})</td><td className="text-right text-primary">{formatBRL(total)}</td><td />{canEdit && <td />}</tr>
            </tfoot>

          </table>
        </div>
      </div>

      <SmallStyles />
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
