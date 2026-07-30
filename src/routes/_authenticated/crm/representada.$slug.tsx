import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Plus,
  Search,
  MoreHorizontal,
  Trash2,
  AlertCircle,
  FileText,
  CalendarDays,
  Pencil,
} from "lucide-react";
import {
  STATUS_META,
  STATUS_ORDER,
  formatDate,
  MOTIVOS,
  type ClienteStatus,
} from "@/lib/crm/status";
import { toast } from "sonner";
import { useMes, formatMesLabel, isCurrentMes } from "@/lib/crm/mes";
import { RepresentadaLogo } from "@/lib/crm/representadas";
import { registrarCompra, useUltimasCompras } from "@/lib/crm/compras";
import { ordenar, SortDropdown, type SortKey } from "@/lib/crm/sort";

export const Route = createFileRoute("/_authenticated/crm/representada/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} | CRM · BI Avanti Pharma` },
      { name: "description", content: `Clientes da representada ${params.slug}.` },
    ],
  }),
  component: RepresentadaPage,
});

type Row = {
  cr_id: string;
  cliente_id: string;
  nome: string;
  status: ClienteStatus;
  motivo_nao_compra: string | null;
  observacoes: string | null;
  ultima_compra: string | null;
  sm_id: string | null;
};

function RepresentadaPage() {
  const { slug } = Route.useParams();
  const { mes } = useMes();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"todos" | ClienteStatus>("todos");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("nome-asc");
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState<Row | null>(null);

  const repQuery = useQuery({
    queryKey: ["crm-representada", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_representadas")
        .select("id, nome, slug, logo_url")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data;
    },
  });

  const crQuery = useQuery({
    queryKey: ["crm-cr-by-rep", repQuery.data?.id],
    enabled: !!repQuery.data,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_cliente_representadas")
        .select("id, cliente_id, crm_clientes!inner(nome)")
        .eq("representada_id", repQuery.data!.id)
        .order("nome", { referencedTable: "crm_clientes" });
      if (error) throw error;
      return data as Array<{ id: string; cliente_id: string; crm_clientes: { nome: string } }>;
    },
  });

  const crIds = useMemo(() => (crQuery.data ?? []).map((c) => c.id), [crQuery.data]);

  const smQuery = useQuery({
    queryKey: ["crm-sm-by-rep", repQuery.data?.id, mes],
    enabled: !!crQuery.data,
    queryFn: async () => {
      const ids = (crQuery.data ?? []).map((c) => c.id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("crm_status_mensal")
        .select("*")
        .in("cliente_representada_id", ids)
        .eq("mes_ref", mes);
      if (error) throw error;
      return data;
    },
  });

  const ultimasComprasQuery = useUltimasCompras(crIds);

  const smByCr = new Map<string, any>();
  (smQuery.data ?? []).forEach((s: any) => smByCr.set(s.cliente_representada_id, s));

  const rows: Row[] = (crQuery.data ?? []).map((cr) => {
    const sm = smByCr.get(cr.id);
    return {
      cr_id: cr.id,
      cliente_id: cr.cliente_id,
      nome: cr.crm_clientes.nome,
      status: (sm?.status as ClienteStatus) ?? "nao_comprou",
      motivo_nao_compra: sm?.motivo_nao_compra ?? null,
      observacoes: sm?.observacoes ?? null,
      ultima_compra: ultimasComprasQuery.data?.get(cr.id) ?? null,
      sm_id: sm?.id ?? null,
    };
  });

  async function upsertStatus(cr_id: string, patch: Record<string, any>) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error("Sessão inválida");
    const { error } = await supabase
      .from("crm_status_mensal")
      .upsert(
        { user_id: userData.user.id, cliente_representada_id: cr_id, mes_ref: mes, ...patch },
        { onConflict: "cliente_representada_id,mes_ref" },
      );
    if (error) throw error;
  }

  const updateStatus = useMutation({
    mutationFn: async ({ cr_id, status }: { cr_id: string; status: ClienteStatus }) => {
      await upsertStatus(cr_id, { status });
      if (status === "comprou") {
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          await registrarCompra(userData.user.id, cr_id, new Date().toISOString().slice(0, 10));
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-sm-by-rep"] });
      qc.invalidateQueries({ queryKey: ["crm-status-mensal"] });
      qc.invalidateQueries({ queryKey: ["crm-ultimas-compras"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const unlinkCr = useMutation({
    mutationFn: async (cr_id: string) => {
      const { error } = await supabase.from("crm_cliente_representadas").delete().eq("id", cr_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-cr-by-rep"] });
      qc.invalidateQueries({ queryKey: ["crm-cliente-representadas-all"] });
      toast.success("Vínculo removido");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const base = rows
      .filter((r) => (filter === "todos" ? true : r.status === filter))
      .filter((r) => r.nome.toLowerCase().includes(search.toLowerCase()));
    return ordenar(
      base,
      sort,
      (r) => r.nome,
      (r) => r.ultima_compra,
    );
  }, [rows, filter, search, sort]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/crm"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar ao painel
        </Link>
        <div className="flex items-start justify-between mt-3 gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            {repQuery.data && (
              <RepresentadaLogo path={repQuery.data.logo_url} nome={repQuery.data.nome} size={56} />
            )}
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {repQuery.data?.nome ?? "..."}
              </h1>
              <p className="text-sm text-muted-foreground mt-1 capitalize">
                {rows.length} {rows.length === 1 ? "cliente" : "clientes"} · {formatMesLabel(mes)}
                {!isCurrentMes(mes) && " (histórico)"}
              </p>
            </div>
          </div>
          <AddClienteDialog
            open={addOpen}
            setOpen={setAddOpen}
            representadaId={repQuery.data?.id}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <SortDropdown value={sort} onChange={setSort} comCompra />
        <div className="flex gap-2 overflow-x-auto">
          <FilterChip active={filter === "todos"} onClick={() => setFilter("todos")}>
            Todos
          </FilterChip>
          {STATUS_ORDER.map((s) => (
            <FilterChip key={s} active={filter === s} onClick={() => setFilter(s)} status={s}>
              {STATUS_META[s].label}
            </FilterChip>
          ))}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center bg-card border-border">
          <p className="text-muted-foreground">
            {rows.length === 0
              ? "Nenhum cliente vinculado a esta representada. Adicione o primeiro."
              : "Nenhum cliente encontrado com esses filtros."}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const meta = STATUS_META[r.status];
            return (
              <Card
                key={r.cr_id}
                className="p-4 bg-card border-border hover:border-border/70 hover:shadow-sm transition-all"
              >
                <div className="flex flex-wrap items-start gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-[200px]">
                    <span className={`h-2.5 w-2.5 rounded-full ${meta.dot} shrink-0 mt-1.5`} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{r.nome}</p>
                      <div className="text-xs text-muted-foreground flex items-center gap-3 mt-1 flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          Última compra: {formatDate(r.ultima_compra)}
                        </span>
                      </div>
                      {(r.motivo_nao_compra || r.observacoes) && (
                        <div className="mt-2 space-y-1">
                          {r.motivo_nao_compra && (
                            <p className="text-xs inline-flex items-start gap-1.5">
                              <AlertCircle className="h-3 w-3 mt-0.5 text-crm-status-nao-comprou shrink-0" />
                              <span>
                                <span className="text-muted-foreground">Motivo:</span>{" "}
                                {r.motivo_nao_compra}
                              </span>
                            </p>
                          )}
                          {r.observacoes && (
                            <p className="text-xs inline-flex items-start gap-1.5">
                              <FileText className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
                              <span>
                                <span className="text-muted-foreground">Obs:</span> {r.observacoes}
                              </span>
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-auto">
                    <Select
                      value={r.status}
                      onValueChange={(v) =>
                        updateStatus.mutate({ cr_id: r.cr_id, status: v as ClienteStatus })
                      }
                    >
                      <SelectTrigger
                        className={`h-8 w-[170px] ${meta.bg} ${meta.text} border-transparent`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_ORDER.map((s) => (
                          <SelectItem key={s} value={s}>
                            <span className="flex items-center gap-2">
                              <span className={`h-2 w-2 rounded-full ${STATUS_META[s].dot}`} />
                              {STATUS_META[s].label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setEditOpen(r)}
                      title="Motivo, observações e compras"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditOpen(r)}>
                          <Pencil className="h-4 w-4 mr-2" /> Editar dados do mês
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            if (confirm(`Remover ${r.nome} desta representada?`))
                              unlinkCr.mutate(r.cr_id);
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Desvincular
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <EditRowDialog row={editOpen} onClose={() => setEditOpen(null)} upsert={upsertStatus} />
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
  status,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  status?: ClienteStatus;
}) {
  const dot = status ? STATUS_META[status].dot : "";
  return (
    <button
      onClick={onClick}
      className={`px-3 h-9 rounded-md text-sm whitespace-nowrap border flex items-center gap-2 transition-colors ${
        active
          ? "bg-accent text-accent-foreground border-border"
          : "bg-transparent text-muted-foreground border-border hover:text-foreground"
      }`}
    >
      {status && <span className={`h-2 w-2 rounded-full ${dot}`} />}
      {children}
    </button>
  );
}

function AddClienteDialog({
  open,
  setOpen,
  representadaId,
}: {
  open: boolean;
  setOpen: (o: boolean) => void;
  representadaId?: string;
}) {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [modo, setModo] = useState<"buscar" | "novo">("buscar");
  const [novoNome, setNovoNome] = useState("");
  const [ultimaCompra, setUltimaCompra] = useState("");
  const { mes } = useMes();

  const clientesQuery = useQuery({
    queryKey: ["crm-clientes-lista"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_clientes").select("id, nome").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const vinculadosQuery = useQuery({
    queryKey: ["crm-cr-by-rep-ids", representadaId],
    enabled: open && !!representadaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_cliente_representadas")
        .select("cliente_id")
        .eq("representada_id", representadaId!);
      if (error) throw error;
      return new Set(data.map((r) => r.cliente_id));
    },
  });

  const disponiveis = (clientesQuery.data ?? []).filter(
    (c) => !vinculadosQuery.data?.has(c.id) && c.nome.toLowerCase().includes(busca.toLowerCase()),
  );

  async function linkCliente(clienteId: string, uc: string | null) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user || !representadaId) throw new Error("Sessão inválida");
    const { data: cr, error } = await supabase
      .from("crm_cliente_representadas")
      .insert({
        user_id: userData.user.id,
        cliente_id: clienteId,
        representada_id: representadaId,
      })
      .select("id")
      .single();
    if (error) throw error;
    if (uc) {
      await registrarCompra(userData.user.id, cr.id, uc);
      await supabase.from("crm_status_mensal").upsert(
        {
          user_id: userData.user.id,
          cliente_representada_id: cr.id,
          mes_ref: mes,
          status: "comprou" as ClienteStatus,
        },
        { onConflict: "cliente_representada_id,mes_ref" },
      );
    }
  }

  const vincular = useMutation({
    mutationFn: async (clienteId: string) => {
      await linkCliente(clienteId, ultimaCompra || null);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-cr-by-rep"] });
      qc.invalidateQueries({ queryKey: ["crm-cr-by-rep-ids"] });
      qc.invalidateQueries({ queryKey: ["crm-sm-by-rep"] });
      qc.invalidateQueries({ queryKey: ["crm-ultimas-compras"] });
      qc.invalidateQueries({ queryKey: ["crm-cliente-representadas-all"] });
      setBusca("");
      setUltimaCompra("");
      setOpen(false);
      toast.success("Cliente vinculado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const criarEVincular = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Sessão inválida");
      const { data: novo, error } = await supabase
        .from("crm_clientes")
        .insert({ user_id: userData.user.id, nome: novoNome.trim() })
        .select("id")
        .single();
      if (error) throw error;
      await linkCliente(novo.id, ultimaCompra || null);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-cr-by-rep"] });
      qc.invalidateQueries({ queryKey: ["crm-clientes-lista"] });
      qc.invalidateQueries({ queryKey: ["crm-sm-by-rep"] });
      qc.invalidateQueries({ queryKey: ["crm-ultimas-compras"] });
      qc.invalidateQueries({ queryKey: ["crm-cliente-representadas-all"] });
      setNovoNome("");
      setUltimaCompra("");
      setOpen(false);
      toast.success("Cliente criado e vinculado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" /> Adicionar cliente
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar cliente à representada</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 border-b border-border">
          <button
            className={`px-3 py-2 text-sm border-b-2 -mb-px ${modo === "buscar" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}
            onClick={() => setModo("buscar")}
          >
            Cliente existente
          </button>
          <button
            className={`px-3 py-2 text-sm border-b-2 -mb-px ${modo === "novo" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}
            onClick={() => setModo("novo")}
          >
            Novo cliente
          </button>
        </div>

        {modo === "buscar" ? (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente cadastrado..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>
            <div className="max-h-64 overflow-y-auto border border-border rounded-md">
              {disponiveis.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 text-center">
                  {clientesQuery.isLoading
                    ? "Carregando..."
                    : 'Nenhum cliente disponível. Use a aba "Novo cliente".'}
                </p>
              ) : (
                disponiveis.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => vincular.mutate(c.id)}
                    disabled={vincular.isPending}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent border-b border-border last:border-b-0 flex items-center justify-between"
                  >
                    <span>{c.nome}</span>
                    <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                ))
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="uc-b">Última compra (opcional)</Label>
              <Input
                id="uc-b"
                type="date"
                value={ultimaCompra}
                onChange={(e) => setUltimaCompra(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!novoNome.trim()) return;
              criarEVincular.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome do cliente</Label>
              <Input
                id="nome"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="uc">Última compra (opcional)</Label>
              <Input
                id="uc"
                type="date"
                value={ultimaCompra}
                onChange={(e) => setUltimaCompra(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={criarEVincular.isPending}>
                Criar e vincular
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditRowDialog({
  row,
  onClose,
  upsert,
}: {
  row: Row | null;
  onClose: () => void;
  upsert: (cr_id: string, patch: Record<string, any>) => Promise<void>;
}) {
  const qc = useQueryClient();
  const { mes } = useMes();
  const [motivo, setMotivo] = useState("");
  const [obs, setObs] = useState("");
  const [novaCompra, setNovaCompra] = useState("");

  useEffect(() => {
    setMotivo(row?.motivo_nao_compra ?? "");
    setObs(row?.observacoes ?? "");
    setNovaCompra("");
  }, [row?.cr_id]);

  const save = useMutation({
    mutationFn: async () => {
      if (!row) return;
      await upsert(row.cr_id, {
        motivo_nao_compra: motivo || null,
        observacoes: obs || null,
      });
      if (novaCompra) {
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) await registrarCompra(userData.user.id, row.cr_id, novaCompra);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-sm-by-rep"] });
      qc.invalidateQueries({ queryKey: ["crm-ultimas-compras"] });
      toast.success("Salvo");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{row?.nome}</DialogTitle>
          <p className="text-xs text-muted-foreground capitalize">{formatMesLabel(mes)}</p>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md border border-border bg-accent/40 px-3 py-2 text-sm flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            Última compra registrada:{" "}
            <span className="font-medium">{formatDate(row?.ultima_compra ?? null)}</span>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nc-e">Registrar uma compra nesta data (opcional)</Label>
            <Input
              id="nc-e"
              type="date"
              value={novaCompra}
              onChange={(e) => setNovaCompra(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Use isso para lançar uma compra atrasada ou de outra data.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Motivo da não compra</Label>
            <Select
              value={motivo || "__none"}
              onValueChange={(v) => setMotivo(v === "__none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Nenhum</SelectItem>
                {MOTIVOS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea
              rows={4}
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Anotações visíveis na lista..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
