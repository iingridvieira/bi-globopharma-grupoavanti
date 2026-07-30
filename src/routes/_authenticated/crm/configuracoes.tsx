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
import { RepresentadaLogo, slugify } from "@/lib/crm/representadas";
import { Upload, Trash2, Plus, Pencil, DownloadCloud, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/crm/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações | CRM · BI Avanti Pharma" },
      {
        name: "description",
        content: "Indústrias/representadas, logos e integração com o BI Globo Pharma.",
      },
    ],
  }),
  component: ConfiguracoesPage,
});

type Rep = { id: string; nome: string; slug: string; ordem: number; logo_url: string | null };

function ConfiguracoesPage() {
  const { isAdmin } = useAuth();
  const repsQuery = useQuery({
    queryKey: ["crm-representadas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_representadas")
        .select("id, nome, slug, ordem, logo_url")
        .order("ordem");
      if (error) throw error;
      return data as Rep[];
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Indústrias/representadas, logos e integração com o BI Globo Pharma.
        </p>
      </div>

      {!isAdmin && (
        <Card className="p-4 bg-card border-border">
          <p className="text-sm text-muted-foreground">
            Algumas ações desta página (criar/editar/remover representadas, enviar logos e importar
            o histórico do BI) são exclusivas de administradores.
          </p>
        </Card>
      )}

      <IntegracaoBiSection isAdmin={isAdmin} />

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Indústrias / Representadas</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Cadastre, edite ou remova as representadas que aparecem no CRM.
            </p>
          </div>
          {isAdmin && (
            <RepresentadaFormDialog
              mode="criar"
              ordemSugerida={(repsQuery.data?.length ?? 0) + 1}
            />
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {repsQuery.data?.map((r) => (
            <LogoCard key={r.id} rep={r} canEdit={isAdmin} />
          ))}
        </div>
      </section>
    </div>
  );
}

function IntegracaoBiSection({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();

  const importar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("crm_backfill_pedidos_globo");
      if (error) throw error;
      return data as number;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["crm-representadas"] });
      qc.invalidateQueries({ queryKey: ["crm-clientes-com-reps"] });
      qc.invalidateQueries({ queryKey: ["crm-clientes-lista"] });
      qc.invalidateQueries({ queryKey: ["crm-cliente-representadas-all"] });
      qc.invalidateQueries({ queryKey: ["crm-cr-by-rep"] });
      qc.invalidateQueries({ queryKey: ["crm-sm-by-rep"] });
      qc.invalidateQueries({ queryKey: ["crm-status-mensal"] });
      qc.invalidateQueries({ queryKey: ["crm-ultimas-compras"] });
      qc.invalidateQueries({ queryKey: ["crm-consolidado-clientes"] });
      toast.success(
        `Histórico importado: ${count} pedido${count === 1 ? "" : "s"} processado${count === 1 ? "" : "s"}.`,
      );
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="p-5 bg-card border-border">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Integração com o BI Globo Pharma</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Todo novo Pedido Enviado cadastrado no BI Globo Pharma já atualiza o CRM automaticamente
            (representada Globo). Use o botão abaixo para trazer, de uma vez, todo o histórico de
            pedidos que já existia antes dessa integração — pode rodar quantas vezes quiser, sem
            duplicar nada.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => importar.mutate()} disabled={importar.isPending} variant="outline">
            {importar.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <DownloadCloud className="h-4 w-4 mr-2" />
            )}
            Importar histórico do BI
          </Button>
        )}
      </div>
    </Card>
  );
}

function RepresentadaFormDialog({
  mode,
  rep,
  ordemSugerida,
}: {
  mode: "criar" | "editar";
  rep?: Rep;
  ordemSugerida?: number;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState(rep?.nome ?? "");
  const [ordem, setOrdem] = useState(String(rep?.ordem ?? ordemSugerida ?? 1));

  useEffect(() => {
    if (open) {
      setNome(rep?.nome ?? "");
      setOrdem(String(rep?.ordem ?? ordemSugerida ?? 1));
    }
  }, [open, rep, ordemSugerida]);

  const salvar = useMutation({
    mutationFn: async () => {
      const nomeTrim = nome.trim();
      if (!nomeTrim) throw new Error("Informe o nome");
      const ordemNum = parseInt(ordem, 10) || 0;
      if (mode === "criar") {
        const { error } = await supabase.from("crm_representadas").insert({
          nome: nomeTrim,
          slug: slugify(nomeTrim),
          ordem: ordemNum,
        });
        if (error) throw error;
      } else if (rep) {
        const { error } = await supabase
          .from("crm_representadas")
          .update({ nome: nomeTrim, ordem: ordemNum })
          .eq("id", rep.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-representadas"] });
      setOpen(false);
      toast.success(mode === "criar" ? "Representada criada" : "Representada atualizada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "criar" ? (
          <Button>
            <Plus className="h-4 w-4 mr-2" /> Nova representada
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar">
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "criar" ? "Nova indústria/representada" : "Editar representada"}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            salvar.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="rep-nome">Nome</Label>
            <Input
              id="rep-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rep-ordem">Ordem de exibição</Label>
            <Input
              id="rep-ordem"
              type="number"
              value={ordem}
              onChange={(e) => setOrdem(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={salvar.isPending}>
              {mode === "criar" ? "Criar" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LogoCard({ rep, canEdit }: { rep: Rep; canEdit: boolean }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${rep.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("crm-representada-logos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      if (rep.logo_url) {
        await supabase.storage.from("crm-representada-logos").remove([rep.logo_url]);
      }
      const { error: dbErr } = await supabase
        .from("crm_representadas")
        .update({ logo_url: path })
        .eq("id", rep.id);
      if (dbErr) throw dbErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-representadas"] });
      qc.invalidateQueries({ queryKey: ["crm-logo-signed"] });
      toast.success("Logo atualizada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeLogo = useMutation({
    mutationFn: async () => {
      if (rep.logo_url) {
        await supabase.storage.from("crm-representada-logos").remove([rep.logo_url]);
      }
      const { error } = await supabase
        .from("crm_representadas")
        .update({ logo_url: null })
        .eq("id", rep.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-representadas"] });
      qc.invalidateQueries({ queryKey: ["crm-logo-signed"] });
      toast.success("Logo removida");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removerRepresentada = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("crm_representadas").delete().eq("id", rep.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-representadas"] });
      qc.invalidateQueries({ queryKey: ["crm-clientes-com-reps"] });
      toast.success("Representada removida");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="p-5 bg-card border-border">
      <div className="flex items-center gap-4">
        <RepresentadaLogo path={rep.logo_url} nome={rep.nome} size={64} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{rep.nome}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {rep.logo_url ? "Logo enviada" : "Sem logo"}
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-1 shrink-0">
            <RepresentadaFormDialog mode="editar" rep={rep} />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              title="Remover representada"
              onClick={() => {
                if (
                  confirm(
                    `Remover "${rep.nome}"? Todos os clientes vinculados só a ela, o histórico de compras e status também serão apagados.`,
                  )
                )
                  removerRepresentada.mutate();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      {canEdit && (
        <div className="mt-4 flex gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload.mutate(f);
              e.target.value = "";
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={upload.isPending}
          >
            <Upload className="h-4 w-4 mr-1.5" /> {rep.logo_url ? "Trocar" : "Enviar"} logo
          </Button>
          {rep.logo_url && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => removeLogo.mutate()}
            >
              <Trash2 className="h-4 w-4 mr-1.5" /> Remover logo
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
