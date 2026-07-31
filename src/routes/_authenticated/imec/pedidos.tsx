import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDateBR, parseBRDate, parseBRNumber, MESES_BR } from "@/lib/format";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { exportToExcel } from "@/lib/excel";
import { normalizeKey } from "@/lib/cliente-mapping";
import { Download, Send, Pencil, Trash2, Check, X, Plus, Clipboard } from "lucide-react";
import { MultiSelect } from "@/components/MultiSelect";
import {
  ColumnFilterHeader,
  ClearFiltersButton,
  useColumnFilters,
} from "@/components/ColumnFilterHeader";
import { Field } from "@/routes/_authenticated/pedidos";

export const Route = createFileRoute("/_authenticated/imec/pedidos")({
  component: ImecPedidosPage,
});

type Empresa = "IMEC" | "NUTIVIT";
const EMPRESAS: Empresa[] = ["IMEC", "NUTIVIT"];

function isEmpresa(v: string): v is Empresa {
  return EMPRESAS.includes(v as Empresa);
}

/** Badge discreto indicando a origem do pedido — IMEC em azul escuro, NUTIVIT em azul claro. */
function EmpresaBadge({ empresa }: { empresa: string }) {
  const isImec = empresa === "IMEC";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
        isImec
          ? "bg-blue-700/10 text-blue-700 border-blue-700/30 dark:bg-blue-400/15 dark:text-blue-300 dark:border-blue-400/30"
          : "bg-sky-400/15 text-sky-600 border-sky-400/40 dark:bg-sky-300/15 dark:text-sky-300 dark:border-sky-300/30"
      }`}
    >
      {empresa}
    </span>
  );
}

function EmpresaSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="bi-input-sm w-full">
      {EMPRESAS.map((e) => (
        <option key={e} value={e}>
          {e}
        </option>
      ))}
    </select>
  );
}

function ImecPedidosPage() {
  const { canEdit } = useAuth();
  const qc = useQueryClient();
  const now = new Date();
  const [meses, setMeses] = useState<string[]>([String(now.getMonth() + 1)]);
  const [anos, setAnos] = useState<string[]>([String(now.getFullYear())]);
  const [clientesSel, setClientesSel] = useState<string[]>([]);
  const [novoOpen, setNovoOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasting, setPasting] = useState(false);

  const { data: clientes } = useQuery({
    queryKey: ["imec-clientes"],
    queryFn: async () =>
      (await supabase.from("imec_clientes").select("id,nome").order("nome")).data ?? [],
  });

  // Colar retroativos: cola linhas "DATA  EMPRESA  CLIENTE  VALOR" (igual ao BI
  // Globo, mas com a empresa de origem). Cliente ainda não cadastrado é criado
  // automaticamente.
  async function processPasted() {
    if (!pasteText.trim()) {
      toast.error("Cole os dados primeiro");
      return;
    }
    setPasting(true);
    try {
      const lines = pasteText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      type Parsed = { data: string; empresa: Empresa; nomeCliente: string; valor: number };
      const parsed: Parsed[] = [];
      const ignoradas: string[] = [];
      for (const line of lines) {
        const parts = line
          .split(/\t|;|\s{2,}/)
          .map((p) => p.trim())
          .filter(Boolean);
        if (parts.length < 4) {
          ignoradas.push(line);
          continue;
        }
        const dataISO = parseBRDate(parts[0]);
        const empresaRaw = parts[1].toUpperCase();
        const nomeCliente = parts[2];
        const valor = parseBRNumber(parts.slice(3).join(" "));
        if (dataISO && isEmpresa(empresaRaw) && nomeCliente && valor > 0) {
          parsed.push({ data: dataISO, empresa: empresaRaw, nomeCliente, valor });
        } else {
          ignoradas.push(line);
        }
      }
      if (parsed.length === 0) {
        toast.error("Nenhuma linha válida (formato: DATA  EMPRESA  CLIENTE  VALOR)");
        return;
      }

      // Busca a lista de clientes sempre atualizada (não confia no cache local),
      // para não tentar recriar um cliente que já existe.
      const { data: clientesAtuais, error: errClientes } = await supabase
        .from("imec_clientes")
        .select("id,nome");
      if (errClientes) throw errClientes;

      const idx = new Map<string, string>();
      (clientesAtuais ?? []).forEach((c) => idx.set(normalizeKey(c.nome), c.id));

      const novosNomes: string[] = [];
      const vistos = new Set<string>();
      for (const p of parsed) {
        const key = normalizeKey(p.nomeCliente);
        if (!idx.has(key) && !vistos.has(key)) {
          vistos.add(key);
          novosNomes.push(p.nomeCliente);
        }
      }
      if (novosNomes.length > 0) {
        // upsert (em vez de insert) para não quebrar caso, por alguma corrida,
        // o nome já exista — nesse caso simplesmente não duplica.
        const { error: errCriar } = await supabase.from("imec_clientes").upsert(
          novosNomes.map((nome) => ({ nome })),
          { onConflict: "nome", ignoreDuplicates: true },
        );
        if (errCriar) throw errCriar;

        // Rebusca (upsert com ignoreDuplicates não retorna as linhas ignoradas)
        // para garantir que todos os nomes, novos ou já existentes, tenham id.
        const { data: apos, error: errApos } = await supabase
          .from("imec_clientes")
          .select("id,nome");
        if (errApos) throw errApos;
        (apos ?? []).forEach((c) => idx.set(normalizeKey(c.nome), c.id));
      }

      const rows = parsed
        .map((p) => ({
          data: p.data,
          empresa: p.empresa,
          cliente_id: idx.get(normalizeKey(p.nomeCliente)),
          valor: p.valor,
        }))
        .filter(
          (r): r is { data: string; empresa: Empresa; cliente_id: string; valor: number } =>
            !!r.cliente_id,
        );

      const { error } = await supabase
        .from("imec_pedidos_enviados")
        .upsert(rows, { onConflict: "data,cliente_id,valor,empresa", ignoreDuplicates: true });
      if (error) throw error;

      toast.success(
        `${rows.length} pedido${rows.length === 1 ? "" : "s"} importado${rows.length === 1 ? "" : "s"}${
          novosNomes.length ? ` · ${novosNomes.length} cliente(s) novo(s) criado(s)` : ""
        }${ignoradas.length ? ` · ${ignoradas.length} linha(s) ignorada(s)` : ""}`,
      );
      setPasteText("");
      setPasteOpen(false);
      await qc.invalidateQueries({ queryKey: ["imec-clientes"] });
      await qc.invalidateQueries({ queryKey: ["imec-pedidos"] });
    } catch (e) {
      toast.error("Erro ao importar: " + (e as Error).message);
    } finally {
      setPasting(false);
    }
  }

  const { data: pedidos } = useQuery({
    queryKey: ["imec-pedidos", anos, meses, clientesSel],
    queryFn: async () => {
      let q = supabase
        .from("imec_pedidos_enviados")
        .select("id,data,valor,empresa,cliente_id,imec_clientes(nome)")
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
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const updatePedido = useMutation({
    mutationFn: async ({
      id,
      data,
      cliente_id,
      valor,
      empresa,
    }: {
      id: string;
      data: string;
      cliente_id: string;
      valor: number;
      empresa: string;
    }) => {
      const { error } = await supabase
        .from("imec_pedidos_enviados")
        .update({ data, cliente_id, valor, empresa })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pedido atualizado");
      setEditId(null);
      void qc.invalidateQueries({ queryKey: ["imec-pedidos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removePedido = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("imec_pedidos_enviados").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pedido removido");
      void qc.invalidateQueries({ queryKey: ["imec-pedidos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState("");
  const [editClienteId, setEditClienteId] = useState("");
  const [editValor, setEditValor] = useState("");
  const [editEmpresa, setEditEmpresa] = useState<string>("IMEC");

  function startEdit(p: {
    id: string;
    data: string;
    cliente_id: string;
    valor: number | string;
    empresa: string;
  }) {
    setEditId(p.id);
    setEditData(p.data);
    setEditClienteId(p.cliente_id);
    setEditValor(String(p.valor).replace(".", ","));
    setEditEmpresa(p.empresa);
  }

  const clientesVisiveis = clientes ?? [];
  const filtrados = pedidos ?? [];

  type PedRow = (typeof filtrados)[number];
  const pedGetters = useMemo(
    () => ({
      data: (p: PedRow) => formatDateBR(p.data),
      empresa: (p: PedRow) => p.empresa,
      cliente: (p: PedRow) => p.imec_clientes?.nome ?? "",
      valor: (p: PedRow) => String(p.valor),
    }),
    [],
  );
  const pedTypes = useMemo(
    () => ({
      data: "date" as const,
      empresa: "text" as const,
      cliente: "text" as const,
      valor: "number" as const,
    }),
    [],
  );
  const {
    view: pedView,
    distinct: pedDistinct,
    filters: pedFilters,
    sorts: pedSorts,
    setFilter: setPedFilter,
    setSort: setPedSort,
    reset: resetPed,
  } = useColumnFilters(filtrados, pedGetters, pedTypes);

  const total = pedView.reduce((a, p) => a + Number(p.valor), 0);

  function handleExport() {
    try {
      if (filtrados.length === 0) {
        toast.error("Não há pedidos para exportar neste período.");
        return;
      }
      const rows = filtrados.map((p) => ({
        Data: formatDateBR(p.data),
        Empresa: p.empresa,
        Cliente: p.imec_clientes?.nome ?? "",
        Valor: Number(p.valor),
      }));
      exportToExcel(rows, `imec-pedidos-${anos.join("_")}-${meses.join("_")}.xlsx`, "Pedidos");
      toast.success("Planilha exportada");
    } catch (e) {
      toast.error("Erro ao exportar: " + (e as Error).message);
    }
  }

  const nColunas = canEdit ? 5 : 4;

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Pedidos Enviados</h1>
          <p className="text-muted-foreground mt-1">
            Histórico mensal de pedidos enviados aos clientes da Imec/Nutivit.
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setNovoOpen(true)}
            className="h-11 px-5 rounded-md bg-primary text-primary-foreground font-semibold uppercase text-xs tracking-wider hover:opacity-90 inline-flex items-center gap-2 shrink-0"
          >
            <Plus className="h-4 w-4" /> Novo pedido
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div className="rounded-md p-5 bg-primary text-primary-foreground shadow-[0_12px_32px_-10px_var(--color-primary)]">
          <div className="flex items-start justify-between">
            <div className="text-primary-foreground/80 bi-stat-label">
              Total de pedidos enviados
            </div>
            <Send className="h-5 w-5 text-primary-foreground/80" strokeWidth={2} />
          </div>
          <div className="bi-stat-value mt-3 text-3xl">{formatBRL(total)}</div>
          <div className="text-xs mt-1 text-primary-foreground/75">
            {filtrados.length} pedido{filtrados.length === 1 ? "" : "s"} no período
          </div>
        </div>
      </div>

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
          options={[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((a) => ({
            value: String(a),
            label: String(a),
          }))}
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
        <button
          onClick={handleExport}
          className="h-10 px-4 rounded-md bg-secondary text-secondary-foreground text-sm font-semibold flex items-center gap-2"
        >
          <Download className="h-4 w-4" /> Exportar
        </button>
      </div>

      {canEdit && (
        <div className="bi-card p-5 mt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="bi-stat-label">Colar manualmente</div>
            <button
              onClick={() => setPasteOpen((v) => !v)}
              className="text-xs text-primary font-semibold flex items-center gap-1"
            >
              <Clipboard className="h-3 w-3" /> {pasteOpen ? "Fechar" : "Abrir"}
            </button>
          </div>
          {pasteOpen && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">
                Cole uma linha por pedido: <b>Data · Empresa (IMEC ou NUTIVIT) · Cliente · Valor</b>
                . Clientes ainda não cadastrados são criados automaticamente.
              </p>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={8}
                placeholder={
                  "10/06/2026\tNUTIVIT\tDISMAP\tR$ 3.057,00\n19/06/2026\tIMEC\tMEDSOL\tR$ 7.396,55"
                }
                className="w-full bg-input border border-border rounded-md p-3 text-sm font-mono"
              />
              <div className="flex justify-end mt-2">
                <button
                  disabled={pasting}
                  onClick={processPasted}
                  className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-xs font-semibold uppercase disabled:opacity-50"
                >
                  Importar{" "}
                  {pasteText ? `(${pasteText.split(/\r?\n/).filter(Boolean).length} linhas)` : ""}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bi-card mt-6 overflow-hidden">
        <div className="flex justify-end px-3 py-1.5">
          <ClearFiltersButton filters={pedFilters} sorts={pedSorts} onReset={resetPed} />
        </div>
        <div className="overflow-x-auto">
          <table className="bi-table">
            <thead>
              <tr>
                <th>
                  <ColumnFilterHeader
                    label="Data"
                    type="date"
                    values={pedDistinct.data ?? []}
                    selected={pedFilters.data ?? []}
                    onChange={(v) => setPedFilter("data", v)}
                    sort={pedSorts.data ?? null}
                    onSortChange={(s) => setPedSort("data", s)}
                  />
                </th>
                <th className="text-center">
                  <ColumnFilterHeader
                    label="Empresa"
                    align="center"
                    values={pedDistinct.empresa ?? []}
                    selected={pedFilters.empresa ?? []}
                    onChange={(v) => setPedFilter("empresa", v)}
                    sort={pedSorts.empresa ?? null}
                    onSortChange={(s) => setPedSort("empresa", s)}
                  />
                </th>
                <th>
                  <ColumnFilterHeader
                    label="Cliente"
                    values={pedDistinct.cliente ?? []}
                    selected={pedFilters.cliente ?? []}
                    onChange={(v) => setPedFilter("cliente", v)}
                    sort={pedSorts.cliente ?? null}
                    onSortChange={(s) => setPedSort("cliente", s)}
                  />
                </th>
                <th className="text-right">
                  <ColumnFilterHeader
                    label="Valor"
                    align="right"
                    type="number"
                    values={pedDistinct.valor ?? []}
                    selected={pedFilters.valor ?? []}
                    onChange={(v) => setPedFilter("valor", v)}
                    sort={pedSorts.valor ?? null}
                    onSortChange={(s) => setPedSort("valor", s)}
                  />
                </th>
                {canEdit && <th className="text-center">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {pedView.map((p) => {
                const isEditing = editId === p.id;
                if (isEditing) {
                  return (
                    <tr key={p.id}>
                      <td>
                        <input
                          type="date"
                          value={editData}
                          onChange={(e) => setEditData(e.target.value)}
                          className="bi-input-sm"
                        />
                      </td>
                      <td>
                        <EmpresaSelect value={editEmpresa} onChange={setEditEmpresa} />
                      </td>
                      <td>
                        <select
                          value={editClienteId}
                          onChange={(e) => setEditClienteId(e.target.value)}
                          className="bi-input-sm"
                        >
                          {clientesVisiveis.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nome}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          value={editValor}
                          onChange={(e) => setEditValor(e.target.value)}
                          className="bi-input-sm text-right"
                          placeholder="0,00"
                        />
                      </td>
                      <td className="text-center">
                        <div className="inline-flex gap-1">
                          <button
                            type="button"
                            title="Salvar"
                            disabled={updatePedido.isPending}
                            onClick={() =>
                              updatePedido.mutate({
                                id: p.id,
                                data: editData,
                                cliente_id: editClienteId,
                                valor: parseBRNumber(editValor),
                                empresa: editEmpresa,
                              })
                            }
                            className="h-8 w-8 inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            title="Cancelar"
                            onClick={() => setEditId(null)}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-md bg-secondary text-secondary-foreground hover:opacity-90"
                          >
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
                    <td className="text-center">
                      <EmpresaBadge empresa={p.empresa} />
                    </td>
                    <td>{p.imec_clientes?.nome ?? "—"}</td>
                    <td className="text-right tabular-nums">{formatBRL(p.valor)}</td>
                    {canEdit && (
                      <td className="text-center">
                        <div className="inline-flex gap-1">
                          <button
                            type="button"
                            title="Editar"
                            onClick={() => startEdit(p)}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-border hover:bg-accent"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            title="Remover"
                            disabled={removePedido.isPending}
                            onClick={() => {
                              if (
                                confirm(
                                  `Remover pedido de ${p.imec_clientes?.nome ?? ""} (${formatBRL(p.valor)})?`,
                                )
                              ) {
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
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={nColunas} className="text-center text-muted-foreground py-8">
                    Nenhum pedido neste período.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>TOTAL ({filtrados.length})</td>
                <td className="text-right text-primary">{formatBRL(total)}</td>
                {canEdit && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {canEdit && novoOpen && (
        <NovoPedidoModal
          clientes={clientesVisiveis}
          onClose={() => setNovoOpen(false)}
          onCreated={() => {
            setNovoOpen(false);
            void qc.invalidateQueries();
          }}
        />
      )}

      <style>{`
        .bi-input-sm { height: 40px; padding: 0 12px; background: var(--color-input); border: 1px solid var(--color-border); border-radius: 6px; color: var(--color-foreground); font-size: 14px; outline: none; }
        .bi-input-sm:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-ring); }
      `}</style>
    </div>
  );
}

function NovoPedidoModal({
  clientes,
  onClose,
  onCreated,
}: {
  clientes: { id: string; nome: string }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const qc = useQueryClient();
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [empresa, setEmpresa] = useState<string>("IMEC");
  const [clienteId, setClienteId] = useState("");
  const [valor, setValor] = useState("");
  const [saving, setSaving] = useState(false);
  const [novoClienteMode, setNovoClienteMode] = useState(false);
  const [novoClienteNome, setNovoClienteNome] = useState("");

  const criarCliente = useMutation({
    mutationFn: async () => {
      const nome = novoClienteNome.trim();
      if (!nome) throw new Error("Informe o nome do cliente");
      // Se já existir um cliente com esse nome, reaproveita em vez de dar erro.
      const { data: existente } = await supabase
        .from("imec_clientes")
        .select("id")
        .ilike("nome", nome)
        .maybeSingle();
      if (existente) return existente.id as string;
      const { data: novo, error } = await supabase
        .from("imec_clientes")
        .insert({ nome })
        .select("id")
        .single();
      if (error) throw error;
      return novo.id as string;
    },
    onSuccess: (id) => {
      void qc.invalidateQueries({ queryKey: ["imec-clientes"] });
      setClienteId(id);
      setNovoClienteNome("");
      setNovoClienteMode(false);
      toast.success("Cliente criado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function salvar() {
    if (!clienteId) {
      toast.error("Selecione o cliente");
      return;
    }
    const valorNum = parseBRNumber(valor);
    if (!valorNum || valorNum <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("imec_pedidos_enviados").insert({
        data,
        empresa,
        cliente_id: clienteId,
        valor: valorNum,
        created_by: userData.user?.id,
      });
      if (error) throw error;
      toast.success("Pedido criado com sucesso");
      onCreated();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-lg w-full max-w-lg my-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-semibold">Novo Pedido Enviado</h2>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data">
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="bi-input-sm w-full"
              />
            </Field>
            <Field label="Empresa">
              <EmpresaSelect value={empresa} onChange={setEmpresa} />
            </Field>
          </div>

          <Field label="Cliente">
            {novoClienteMode ? (
              <div className="flex gap-1.5">
                <input
                  autoFocus
                  value={novoClienteNome}
                  onChange={(e) => setNovoClienteNome(e.target.value)}
                  placeholder="Nome do novo cliente"
                  className="bi-input-sm flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") criarCliente.mutate();
                    if (e.key === "Escape") setNovoClienteMode(false);
                  }}
                />
                <button
                  type="button"
                  title="Salvar cliente"
                  disabled={criarCliente.isPending}
                  onClick={() => criarCliente.mutate()}
                  className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="Cancelar"
                  onClick={() => setNovoClienteMode(false)}
                  className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-md border border-border hover:bg-accent"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex gap-1.5">
                <select
                  value={clienteId}
                  onChange={(e) => setClienteId(e.target.value)}
                  className="bi-input-sm flex-1"
                >
                  <option value="">Selecione...</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  title="Novo cliente"
                  onClick={() => setNovoClienteMode(true)}
                  className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-md border border-border hover:bg-accent"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            )}
          </Field>

          <Field label="Valor total do pedido">
            <input
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
              inputMode="decimal"
              className="bi-input-sm w-full"
            />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-2 p-5 border-t border-border bg-muted/10">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-md border border-border text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={salvar}
            className="h-10 px-5 rounded-md bg-primary text-primary-foreground font-semibold text-sm uppercase tracking-wider hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar pedido"}
          </button>
        </div>
      </div>
    </div>
  );
}
