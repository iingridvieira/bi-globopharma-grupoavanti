import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDateBR, MESES_BR_SHORT } from "@/lib/format";
import { ArrowLeft, Upload, Download, Trash2, Link as LinkIcon } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/sell-out/$clienteId")({ component: ClienteSellOut });

function ClienteSellOut() {
  const { clienteId } = Route.useParams();
  const { canEdit } = useAuth();
  const qc = useQueryClient();
  const [ano] = useState(new Date().getFullYear());
  const fileInput = useRef<HTMLInputElement>(null);

  const { data: cliente } = useQuery({
    queryKey: ["cliente", clienteId],
    queryFn: async () => (await supabase.from("clientes").select("nome").eq("id", clienteId).single()).data,
  });

  const { data: sellOut } = useQuery({
    queryKey: ["sellout", clienteId, ano],
    queryFn: async () => (await supabase.from("sell_out").select("mes,valor").eq("cliente_id", clienteId).eq("ano", ano)).data ?? [],
  });

  const { data: arquivos } = useQuery({
    queryKey: ["mapas", clienteId],
    queryFn: async () => (await supabase.from("mapas_vendas_arquivos").select("*").eq("cliente_id", clienteId).order("created_at", { ascending: false })).data ?? [],
  });

  const meses = Array(12).fill(0);
  (sellOut ?? []).forEach((s) => (meses[s.mes - 1] = Number(s.valor)));
  const total = meses.reduce((a, b) => a + b, 0);

  const upload = useMutation({
    mutationFn: async (files: FileList) => {
      for (const f of Array.from(files)) {
        const path = `${clienteId}/${Date.now()}-${f.name}`;
        const { error: upErr } = await supabase.storage.from("mapas-vendas").upload(path, f);
        if (upErr) throw upErr;
        const { data: userData } = await supabase.auth.getUser();
        const { error } = await supabase.from("mapas_vendas_arquivos").insert({
          cliente_id: clienteId, nome_arquivo: f.name, storage_path: path,
          mime_type: f.type, tamanho_bytes: f.size, uploaded_by: userData.user?.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Arquivos enviados"); void qc.invalidateQueries({ queryKey: ["mapas", clienteId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (a: { id: string; storage_path: string }) => {
      await supabase.storage.from("mapas-vendas").remove([a.storage_path]);
      const { error } = await supabase.from("mapas_vendas_arquivos").delete().eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removido"); void qc.invalidateQueries({ queryKey: ["mapas", clienteId] }); },
  });

  function shareUrl(path: string) {
    const { data } = supabase.storage.from("mapas-vendas").getPublicUrl(path);
    return data.publicUrl;
  }
  function copy(text: string) {
    void navigator.clipboard.writeText(text);
    toast.success("Link copiado");
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <Link to="/sell-out" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <header className="mb-6">
        <div className="bi-stat-label">Distribuidor</div>
        <h1 className="font-display text-3xl font-bold mt-1">{cliente?.nome}</h1>
      </header>

      <section className="bi-card p-6 mb-8">
        <h2 className="font-display text-lg font-semibold mb-4">Sell Out {ano}</h2>
        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
          {meses.map((v, i) => (
            <div key={i} className="bi-card p-3 text-center">
              <div className="bi-stat-label">{MESES_BR_SHORT[i]}</div>
              <div className="bi-stat-value text-sm mt-1">{v ? formatBRL(v) : "—"}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <div className="text-right">
            <div className="bi-stat-label">Total Acumulado</div>
            <div className="bi-stat-value text-2xl text-primary mt-1">{formatBRL(total)}</div>
          </div>
        </div>
      </section>

      <section className="bi-card overflow-hidden">
        <header className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold">Mapas de Vendas</h2>
            <p className="text-xs text-muted-foreground mt-0.5">PDFs, Excel, imagens · link compartilhável</p>
          </div>
          {canEdit && (
            <>
              <input ref={fileInput} type="file" multiple className="hidden"
                onChange={(e) => e.target.files && upload.mutate(e.target.files)} />
              <button onClick={() => fileInput.current?.click()}
                className="h-10 px-4 rounded-md bg-primary text-primary-foreground font-semibold text-sm flex items-center gap-2">
                <Upload className="h-4 w-4" /> Enviar Arquivos
              </button>
            </>
          )}
        </header>
        <table className="bi-table">
          <thead>
            <tr><th>Arquivo</th><th>Tamanho</th><th>Data</th><th className="text-right">Ações</th></tr>
          </thead>
          <tbody>
            {(arquivos ?? []).map((a) => (
              <tr key={a.id}>
                <td className="font-medium">{a.nome_arquivo}</td>
                <td className="text-muted-foreground">{a.tamanho_bytes ? (Number(a.tamanho_bytes) / 1024).toFixed(0) + " KB" : "—"}</td>
                <td>{formatDateBR(a.created_at)}</td>
                <td className="text-right">
                  <div className="inline-flex items-center gap-1">
                    <a href={shareUrl(a.storage_path)} target="_blank" rel="noreferrer" download
                      className="h-8 w-8 rounded hover:bg-secondary inline-flex items-center justify-center" title="Baixar">
                      <Download className="h-4 w-4" />
                    </a>
                    <button onClick={() => copy(shareUrl(a.storage_path))}
                      className="h-8 w-8 rounded hover:bg-secondary inline-flex items-center justify-center" title="Copiar link">
                      <LinkIcon className="h-4 w-4" />
                    </button>
                    {canEdit && (
                      <button onClick={() => del.mutate({ id: a.id, storage_path: a.storage_path })}
                        className="h-8 w-8 rounded hover:bg-destructive/20 text-destructive inline-flex items-center justify-center" title="Excluir">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {arquivos?.length === 0 && <tr><td colSpan={4} className="text-center text-muted-foreground py-8">Nenhum arquivo ainda.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
