import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDateBR, MESES_BR_SHORT } from "@/lib/format";
import { ArrowLeft, Upload, Download, Trash2, Link as LinkIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const MAPAS_UPLOAD_EMAIL = "avantipharma.comercial@gmail.com";

export const Route = createFileRoute("/_authenticated/por-clientes/$clienteId")({ component: ClienteDetalhe });

function ClienteDetalhe() {
  const { clienteId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [ano, setAno] = useState(new Date().getFullYear());
  const fileInput = useRef<HTMLInputElement>(null);

  const canUploadMapas = (user?.email ?? "").toLowerCase() === MAPAS_UPLOAD_EMAIL;

  const { data: cliente } = useQuery({
    queryKey: ["cliente", clienteId],
    queryFn: async () => (await supabase.from("clientes").select("nome").eq("id", clienteId).single()).data,
  });

  const { data: sellIn } = useQuery({
    queryKey: ["sell-in-cliente", clienteId, ano],
    queryFn: async () =>
      (await supabase.from("sell_in").select("mes,valor").eq("cliente_id", clienteId).eq("ano", ano)).data ?? [],
  });

  const { data: sellOut } = useQuery({
    queryKey: ["sell-out-cliente", clienteId, ano],
    queryFn: async () =>
      (await supabase.from("sell_out").select("mes,valor").eq("cliente_id", clienteId).eq("ano", ano)).data ?? [],
  });

  const { data: pendencias } = useQuery({
    queryKey: ["pendencias-cliente", clienteId, ano],
    queryFn: async () =>
      (await supabase.from("pendencias").select("mes,valor").eq("cliente_id", clienteId).eq("ano", ano)).data ?? [],
  });

  const sellInAgg = useMemo(() => buildAgg(sellIn ?? []), [sellIn]);
  const sellOutAgg = useMemo(() => buildAgg(sellOut ?? []), [sellOut]);
  const pendAgg = useMemo(() => buildAgg(pendencias ?? []), [pendencias]);

  const sellInAgg = useMemo(() => buildAgg(sellIn ?? []), [sellIn]);
  const sellOutAgg = useMemo(() => buildAgg(sellOut ?? []), [sellOut]);

  const { data: arquivos } = useQuery({
    queryKey: ["mapas", clienteId],
    queryFn: async () =>
      (await supabase.from("mapas_vendas_arquivos").select("*").eq("cliente_id", clienteId).order("created_at", { ascending: false })).data ?? [],
  });

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

  async function shareUrl(path: string): Promise<string> {
    const { data, error } = await supabase.storage.from("mapas-vendas").createSignedUrl(path, 3600);
    if (error || !data) throw error ?? new Error("Falha ao gerar link");
    return data.signedUrl;
  }
  async function openFile(path: string) {
    try { window.open(await shareUrl(path), "_blank", "noreferrer"); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function copyLink(path: string) {
    try { await navigator.clipboard.writeText(await shareUrl(path)); toast.success("Link copiado (válido por 1h)"); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="p-8 max-w-[1500px] mx-auto">
      <Link to="/por-clientes" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <header className="mb-6 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="bi-stat-label">Cliente</div>
          <h1 className="font-display text-3xl font-bold mt-1">{cliente?.nome}</h1>
        </div>
        <select value={ano} onChange={(e) => setAno(Number(e.target.value))} className="h-10 px-3 bg-input border border-border rounded-md">
          {[ano - 1, ano, ano + 1].map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </header>

      <MonthlyTable title={`Sell In · ${ano}`} agg={sellInAgg} colorVar="var(--color-chart-1)" />
      <MonthlyTable title={`Sell Out · ${ano}`} agg={sellOutAgg} colorVar="var(--color-chart-2)" />

      {/* Mapas de vendas */}
      <section className="bi-card overflow-hidden">
        <header className="px-6 py-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Mapas de Vendas</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {canUploadMapas
                ? "Você pode enviar arquivos. Todos os usuários autenticados podem baixar."
                : "Somente o usuário autorizado pode enviar. Você pode baixar os arquivos disponíveis."}
            </p>
          </div>
          {canUploadMapas && (
            <div className="flex items-center gap-2">
              <input ref={fileInput} type="file" multiple className="hidden"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => e.target.files && upload.mutate(e.target.files)} />
              <button onClick={() => fileInput.current?.click()}
                className="h-9 px-3 rounded-md bg-primary text-primary-foreground font-semibold text-xs flex items-center gap-2">
                <Upload className="h-4 w-4" /> Enviar Excel
              </button>
            </div>
          )}
        </header>
        <table className="bi-table">
          <thead>
            <tr><th>Arquivo</th><th>Tamanho</th><th>Data</th><th className="text-right">Ações</th></tr>
          </thead>
          <tbody>
            {(arquivos ?? []).map((a) => (
              <tr key={a.id}>
                <td className="font-medium">
                  <button onClick={() => openFile(a.storage_path)} className="hover:text-primary text-left">{a.nome_arquivo}</button>
                </td>
                <td className="text-muted-foreground">{a.tamanho_bytes ? (Number(a.tamanho_bytes) / 1024).toFixed(0) + " KB" : "—"}</td>
                <td>{formatDateBR(a.created_at)}</td>
                <td className="text-right">
                  <div className="inline-flex items-center gap-1">
                    <button onClick={() => openFile(a.storage_path)}
                      className="h-8 w-8 rounded hover:bg-secondary inline-flex items-center justify-center" title="Baixar">
                      <Download className="h-4 w-4" />
                    </button>
                    <button onClick={() => copyLink(a.storage_path)}
                      className="h-8 w-8 rounded hover:bg-secondary inline-flex items-center justify-center" title="Copiar link">
                      <LinkIcon className="h-4 w-4" />
                    </button>
                    {canUploadMapas && (
                      <button onClick={() => del.mutate({ id: a.id, storage_path: a.storage_path })}
                        className="h-8 w-8 rounded hover:bg-destructive/20 text-destructive inline-flex items-center justify-center" title="Excluir">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {arquivos?.length === 0 && <tr><td colSpan={4} className="text-center text-muted-foreground py-8">Nenhum arquivo enviado.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}

type Agg = { meses: number[]; total: number; media: number; chart: { mes: string; valor: number }[] };

function buildAgg(rows: { mes: number; valor: number | string }[]): Agg {
  const meses = Array(12).fill(0);
  rows.forEach((r) => { meses[r.mes - 1] = Number(r.valor); });
  const total = meses.reduce((a, b) => a + b, 0);
  const ativos = meses.filter((v) => v > 0).length;
  const media = ativos ? total / ativos : 0;
  const chart = meses.map((v, i) => ({ mes: MESES_BR_SHORT[i], valor: v }));
  return { meses, total, media, chart };
}

function MonthlyTable({ title, agg, colorVar }: { title: string; agg: Agg; colorVar: string }) {
  return (
    <section className="bi-card mb-6 overflow-hidden">
      <header className="px-6 py-4 border-b border-border flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        <div className="h-14 w-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={agg.chart} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="mes" hide />
              <YAxis hide />
              <Tooltip
                contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 11 }}
                formatter={(v: number) => formatBRL(v)} />
              <Line type="monotone" dataKey="valor" stroke={colorVar} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </header>
      <div className="overflow-x-auto">
        <table className="bi-table">
          <thead>
            <tr>
              {MESES_BR_SHORT.map((m) => <th key={m} className="text-right">{m}</th>)}
              <th className="text-right">Total</th>
              <th className="text-right">Média</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              {agg.meses.map((v, i) => <td key={i} className="text-right tabular-nums text-xs">{v ? formatBRL(v) : "—"}</td>)}
              <td className="text-right tabular-nums font-semibold text-primary">{formatBRL(agg.total)}</td>
              <td className="text-right tabular-nums font-semibold">{formatBRL(agg.media)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
