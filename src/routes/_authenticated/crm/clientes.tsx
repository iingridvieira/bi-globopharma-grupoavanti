import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Search, Trash2, Users2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ordenar, SortDropdown, type SortKey } from "@/lib/crm/sort";

export const Route = createFileRoute("/_authenticated/crm/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes | CRM · BI Avanti Pharma" },
      {
        name: "description",
        content: "Cadastro único de clientes. Vincule cada cliente a uma ou mais representadas.",
      },
    ],
  }),
  component: ClientesPage,
});

function ClientesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("nome-asc");
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");

  const clientesQuery = useQuery({
    queryKey: ["crm-clientes-com-reps"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_clientes")
        .select("id, nome, crm_cliente_representadas(id, crm_representadas(nome, slug))")
        .order("nome");
      if (error) throw error;
      return data as Array<{
        id: string;
        nome: string;
        crm_cliente_representadas: Array<{
          id: string;
          crm_representadas: { nome: string; slug: string };
        }>;
      }>;
    },
  });

  const criar = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Sessão inválida");
      const { error } = await supabase
        .from("crm_clientes")
        .insert({ user_id: userData.user.id, nome: nome.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-clientes-com-reps"] });
      qc.invalidateQueries({ queryKey: ["crm-clientes-lista"] });
      setNome("");
      setOpen(false);
      toast.success("Cliente criado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_clientes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-clientes-com-reps"] });
      qc.invalidateQueries({ queryKey: ["crm-clientes-lista"] });
      qc.invalidateQueries({ queryKey: ["crm-cliente-representadas-all"] });
      qc.invalidateQueries({ queryKey: ["crm-cr-by-rep"] });
      toast.success("Cliente removido");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const base = (clientesQuery.data ?? []).filter((c) =>
      c.nome.toLowerCase().includes(search.toLowerCase()),
    );
    return ordenar(base, sort, (c) => c.nome);
  }, [clientesQuery.data, search, sort]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastro único. Cada cliente pode ser vinculado a várias representadas.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" /> Novo cliente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo cliente</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!nome.trim()) return;
                criar.mutate();
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label htmlFor="nome-c">Nome</Label>
                <Input
                  id="nome-c"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={criar.isPending}>
                  Criar cliente
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <SortDropdown value={sort} onChange={setSort} />
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center bg-card border-border">
          <Users2 className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">
            {clientesQuery.isLoading
              ? "Carregando..."
              : (clientesQuery.data?.length ?? 0) === 0
                ? "Nenhum cliente cadastrado ainda."
                : "Nenhum cliente encontrado."}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <Card
              key={c.id}
              className="p-4 bg-card border-border flex items-center justify-between gap-3 flex-wrap"
            >
              <div className="flex-1 min-w-[200px]">
                <p className="font-medium">{c.nome}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {c.crm_cliente_representadas.length === 0 ? (
                    <span className="text-xs text-muted-foreground">
                      Nenhuma representada vinculada
                    </span>
                  ) : (
                    c.crm_cliente_representadas.map((cr) => (
                      <span
                        key={cr.id}
                        className="inline-flex items-center px-2 py-0.5 text-xs rounded-md bg-accent text-accent-foreground border border-border"
                      >
                        {cr.crm_representadas.nome}
                      </span>
                    ))
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => {
                  if (confirm(`Remover ${c.nome}? Todos os vínculos e histórico serão apagados.`))
                    remover.mutate(c.id);
                }}
              >
                <Trash2 className="h-4 w-4 mr-1.5" /> Remover
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
