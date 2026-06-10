import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { aprovarSolicitacaoAcesso } from "@/lib/admin-users.functions";
import { SmallStyles } from "./pedidos";
import { toast } from "sonner";
import { UserCheck, UserX, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/acessos")({ component: AcessosPage });

function AcessosPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const aprovar = useServerFn(aprovarSolicitacaoAcesso);

  const [aprovandoId, setAprovandoId] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [senha, setSenha] = useState("");
  const [papel, setPapel] = useState<"viewer" | "editor">("viewer");

  const { data: reqs, isLoading } = useQuery({
    queryKey: ["access-requests"],
    enabled: isAdmin,
    queryFn: async () =>
      (await supabase.from("access_requests").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const mutAprovar = useMutation({
    mutationFn: () =>
      aprovar({ data: { requestId: aprovandoId!, username: username.trim(), password: senha, role: papel } }),
    onSuccess: () => {
      toast.success("Usuário criado e solicitação aprovada");
      setAprovandoId(null); setUsername(""); setSenha(""); setPapel("viewer");
      void qc.invalidateQueries({ queryKey: ["access-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mutRejeitar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("access_requests").update({ status: "rejeitado" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Solicitação rejeitada");
      void qc.invalidateQueries({ queryKey: ["access-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isAdmin) {
    return (
      <div className="p-8 max-w-[800px] mx-auto">
        <div className="bi-card p-8 text-center">
          <ShieldAlert className="h-8 w-8 text-primary mx-auto mb-3" />
          <h1 className="font-display text-xl font-bold">Acesso restrito</h1>
          <p className="text-sm text-muted-foreground mt-2">Apenas administradores podem gerenciar solicitações de acesso.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1100px] mx-auto">
      <div className="bi-stat-label">Gestão de usuários</div>
      <h1 className="font-display text-3xl font-bold mt-1">Solicitações de Acesso</h1>
      <p className="text-muted-foreground mt-1">
        Nenhum usuário é criado automaticamente. Aprove uma solicitação para criar o acesso com usuário e senha.
      </p>

      <div className="bi-card mt-6 overflow-x-auto">
        <table className="bi-table">
          <thead>
            <tr>
              <th>Nome</th><th>E-mail</th><th>Telefone</th><th>Data e hora</th><th>Status</th><th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="text-center text-muted-foreground py-8">Carregando…</td></tr>}
            {!isLoading && (reqs ?? []).map((r) => (
              <tr key={r.id}>
                <td className="font-medium">{r.nome}</td>
                <td>{r.email}</td>
                <td>{r.telefone ?? "—"}</td>
                <td className="tabular-nums text-sm">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                <td>
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                    r.status === "pendente" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                    r.status === "aprovado" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                    "bg-red-500/20 text-red-400 border border-red-500/30"
                  }`}>
                    {r.status}
                  </span>
                </td>
                <td className="text-right">
                  {r.status === "pendente" && (
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => { setAprovandoId(r.id); setUsername(r.nome); setSenha(""); setPapel("viewer"); }}
                        className="h-8 px-3 rounded bg-primary text-primary-foreground text-xs font-semibold inline-flex items-center gap-1.5">
                        <UserCheck className="h-3.5 w-3.5" /> Aprovar
                      </button>
                      <button
                        onClick={() => mutRejeitar.mutate(r.id)}
                        disabled={mutRejeitar.isPending}
                        className="h-8 px-3 rounded bg-destructive/15 text-destructive text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50">
                        <UserX className="h-3.5 w-3.5" /> Rejeitar
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {!isLoading && (reqs ?? []).length === 0 && (
              <tr><td colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma solicitação de acesso recebida.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {aprovandoId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setAprovandoId(null)}>
          <div className="bi-card p-6 w-full max-w-md bg-background" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-xl font-bold">Aprovar acesso</h2>
            <p className="text-sm text-muted-foreground mt-1">Defina o nome de usuário, a senha e o papel do novo usuário.</p>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="bi-stat-label block mb-1.5">Nome de usuário (login)</span>
                <input value={username} onChange={(e) => setUsername(e.target.value)} className="bi-input-sm w-full" placeholder="Ex.: João Silva" />
              </label>
              <label className="block">
                <span className="bi-stat-label block mb-1.5">Senha</span>
                <input type="text" value={senha} onChange={(e) => setSenha(e.target.value)} className="bi-input-sm w-full" placeholder="Mínimo 6 caracteres" />
              </label>
              <label className="block">
                <span className="bi-stat-label block mb-1.5">Papel</span>
                <select value={papel} onChange={(e) => setPapel(e.target.value as "viewer" | "editor")} className="bi-input-sm w-full">
                  <option value="viewer">Viewer (apenas visualização)</option>
                  <option value="editor">Editor (pode importar e editar)</option>
                </select>
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setAprovandoId(null)} className="h-9 px-4 rounded-md text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
              <button
                onClick={() => mutAprovar.mutate()}
                disabled={mutAprovar.isPending || username.trim().length < 2 || senha.length < 6}
                className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
                {mutAprovar.isPending ? "Criando…" : "Criar usuário"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
