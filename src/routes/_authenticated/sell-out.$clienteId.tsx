import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDateBR, MESES_BR_SHORT } from "@/lib/format";
import { ArrowLeft, Upload, Download, Trash2, Link as LinkIcon, Search } from "lucide-react";
import { useState, useRef, useMemo } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/sell-out/$clienteId")({ component: ClienteSellOut });

function ClienteSellOut() {
  const { clienteId } = Route.useParams();
  const { canEdit } = useAuth();
  const qc = useQueryClient();
  const [ano, setAno] = useState(new Date().getFullYear());
  const [busca, setBusca] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const { data: cliente } = useQuery({
    queryKey: ["cliente", clienteId],
    queryFn: async () => (await supabase.from("clientes").select("nome").eq("id", clienteId).single()).data,
  });

  // Sell Out = pedidos enviados do ano para esse cliente
  const { data: pedidos } = useQuery({
    queryKey: ["pedidos-cliente", clienteId, ano],
    queryFn: async () => {
      const start = `${ano}-01-01`; const end = `${ano}-12-31`;
      return (await supabase.from("pedidos_enviados")
        .select("id,data,valor")
        .eq("cliente_id", clienteId)
        .gte("data", start).lte("data", end)
        .order("data", { ascending: false })).data ?? [];
    },
  });

  const agg = useMemo(() => {
    const meses = Array(12).fill(0);
    const counts = Array(12).fill(0);
    (pedidos ?? []).forEach((p) => {
      const m = new Date(p.data).getUTCMonth();
      meses[m] += Number(p.valor); counts[m] += 1;
    });
    const total = meses.reduce((a, b) => a + b, 0);
    const totalQtd = counts.reduce((a, b) => a + b, 0);
    let acc = 0;
    const chart = meses.map((v, i) => { acc += v; return { mes: MESES_BR_SHORT[i], valor: v, acumulado: acc, pedidos: counts[i] }; });
    return { meses, counts, total, totalQtd, chart };
  }, [pedidos]);

  const { data: arquivos } = useQuery({
    queryKey: ["mapas", clienteId],
    queryFn: async () => (await supabase.from("mapas_vendas_arquivos").select("*").eq("cliente_id", clienteId).order("created_at", { ascending: false })).data ?? [],
  });

  const arquivosFiltrados = useMemo(() => {
    return (arquivos ?? []).filter((a) => {
      if (busca && !a.nome_arquivo.toLowerCase().includes(busca.toLowerCase())) return false;
      if (tipoFiltro && !(a.mime_type ?? "").includes(tipoFiltro)) return false;
      return true;
    });
  }, [arquivos, busca, tipoFiltro]);

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

  function tipoArquivo(mime: string | null, nome: string): string {
    if (!mime) return nome.split(".").pop()?.toUpperCase() ?? "—";
    if (mime.includes("pdf")) return "PDF";
    if (mime.includes("sheet") || mime.includes("excel") || nome.endsWith(".xlsx") || nome.endsWith(".xls")) return "Excel";
    if (mime.startsWith("image/")) return "Imagem";
    if (mime.includes("csv") || nome.endsWith(".csv")) return "CSV";
    return mime;
  }

  return (
    <div className="p-8 max-w-[1500px] mx-auto">
      <Link to="/sell-out" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <header className="mb-6 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="bi-stat-label">Distribuidor</div>
          <h1 className="font-display text-3xl font-bold mt-1">{cliente?.nome}</h1>
        </div>
        <select value={ano} onChange={(e) => setAno(Number(e.target.value))} className="h-10 px-3 bg-input border border-border rounded-md">
          {[ano - 1, ano, ano + 1].map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </header>

      {/* Cards mensais */}
      <section className="bi-card p-6 mb-6">
        <div className="flex items-end justify-between mb-4">
          <h2 className="font-display text-lg font-semibold">Sell Out {ano}</h2>
          <div className="text-right">
            <div className="bi-stat-label">Total acumulado</div>
            <div className="bi-stat-value text-2xl text-primary">{formatBRL(agg.total)}</div>
            <div className="text-xs text-muted-foreground">{agg.totalQtd} pedidos</div>
          </div>
        </div>
        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
          {agg.meses.map((v, i) => (
            <div key={i} className="bi-card p-3 text-center">
              <div className="bi-stat-label">{MESES_BR_SHORT[i]}</div>
              <div className="bi-stat-value text-sm mt-1">{v ? formatBRL(v) : "—"}</div>
              {agg.counts[i] > 0 && <div className="text-[10px] text-muted-foreground mt-0.5">{agg.counts[i]} ped.</div>}
            </div>
          ))}
        </div>
      </section>

      {/* Gráfico de linha */}
      <section className="bi-card p-6 mb-6">
        <h2 className="font-display text-lg font-semibold mb-1">Evolução mensal</h2>
        <p className="text-xs text-muted-foreground mb-4">Faturamento mensal e acumulado</p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={agg.chart} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis dataKey="mes" stroke="var(--color-muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={11}
                tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
              <Tooltip
                contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 12 }}
                formatter={(v: number) => formatBRL(v)} />
              <Line type="monotone" dataKey="valor" name="Mês" stroke="var(--color-chart-1)" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="acumulado" name="Acumulado" stroke="var(--color-chart-2)" strokeWidth={2} strokeDasharray="4 3" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Tabela detalhada */}
      <section className="bi-card mb-6 overflow-hidden">
        <header className="px-6 py-4 border-b border-border">
          <h2 className="font-display text-lg font-semibold">Pedidos · {ano}</h2>
        </header>
        <table className="bi-table">
          <thead>
            <tr><th>Data</th><th>Mês/Ano</th><th className="text-right">Valor</th></tr>
          </thead>
          <tbody>
            {(pedidos ?? []).map((p) => (
              <tr key={p.id}>
                <td>{formatDateBR(p.data)}</td>
                <td className="text-xs text-muted-foreground">{String(new Date(p.data).getUTCMonth() + 1).padStart(2, "0")}/{new Date(p.data).getUTCFullYear()}</td>
                <td className="text-right tabular-nums">{formatBRL(p.valor)}</td>
              </tr>
            ))}
            {pedidos?.length === 0 && <tr><td colSpan={3} className="text-center text-muted-foreground py-6">Sem pedidos para este cliente em {ano}.</td></tr>}
          </tbody>
          <tfoot>
            <tr><td colSpan={2}>TOTAL · {agg.totalQtd} pedidos</td><td className="text-right text-primary">{formatBRL(agg.total)}</td></tr>
          </tfoot>
        </table>
      </section>

      {/* Mapas de vendas */}
      <section className="bi-card overflow-hidden">
        <header className="px-6 py-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Mapas de Vendas</h2>
            <p className="text-xs text-muted-foreground mt-0.5">PDFs, Excel, imagens, CSV · vinculados ao cliente</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar arquivo"
                className="h-9 pl-8 pr-3 bg-input border border-border rounded-md text-sm w-48" />
            </div>
            <select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)} className="h-9 px-2 bg-input border border-border rounded-md text-sm">
              <option value="">Todos</option>
              <option value="pdf">PDF</option>
              <option value="sheet">Excel</option>
              <option value="image">Imagens</option>
              <option value="csv">CSV</option>
            </select>
            {canEdit && (
              <>
                <input ref={fileInput} type="file" multiple className="hidden"
                  accept=".pdf,.xlsx,.xls,.csv,image/*"
                  onChange={(e) => e.target.files && upload.mutate(e.target.files)} />
                <button onClick={() => fileInput.current?.click()}
                  className="h-9 px-3 rounded-md bg-primary text-primary-foreground font-semibold text-xs flex items-center gap-2">
                  <Upload className="h-4 w-4" /> Enviar
                </button>
              </>
            )}
          </div>
        </header>
        <table className="bi-table">
          <thead>
            <tr><th>Arquivo</th><th>Tipo</th><th>Tamanho</th><th>Data</th><th className="text-right">Ações</th></tr>
          </thead>
          <tbody>
            {arquivosFiltrados.map((a) => (
              <tr key={a.id}>
                <td className="font-medium">
                  <a href={shareUrl(a.storage_path)} target="_blank" rel="noreferrer" className="hover:text-primary">{a.nome_arquivo}</a>
                </td>
                <td className="text-xs text-muted-foreground">{tipoArquivo(a.mime_type, a.nome_arquivo)}</td>
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
            {arquivosFiltrados.length === 0 && <tr><td colSpan={5} className="text-center text-muted-foreground py-8">Nenhum arquivo encontrado.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
