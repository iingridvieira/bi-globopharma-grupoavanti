import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDateBR, MESES_BR_SHORT } from "@/lib/format";
import { ArrowLeft, Upload, Download, Trash2, Link as LinkIcon, FileDown, Save } from "lucide-react";
import { exportToExcel } from "@/lib/excel";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { MultiSelect } from "@/components/MultiSelect";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

const MAPAS_UPLOAD_EMAIL = "avantipharma.comercial@gmail.com";
const ALL = "ALL" as const;

export const Route = createFileRoute("/_authenticated/por-clientes/$clienteId")({ component: ClienteDetalhe });

function ClienteDetalhe() {
  const { clienteId } = Route.useParams();
  const { user, restrictedClientes } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const [anoSel, setAnoSel] = useState<number | typeof ALL>(currentYear);
  const fileInput = useRef<HTMLInputElement>(null);
  const ccInput = useRef<HTMLInputElement>(null);

  const canUploadMapas = (user?.email ?? "").toLowerCase() === MAPAS_UPLOAD_EMAIL;

  const { data: cliente } = useQuery({
    queryKey: ["cliente", clienteId],
    queryFn: async () => (await supabase.from("clientes").select("nome,observacao").eq("id", clienteId).single()).data,
  });

  useEffect(() => {
    if (!cliente?.nome || !restrictedClientes) return;
    const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    const allowed = new Set(restrictedClientes.filter((n) => norm(n) !== "MEDLOG").map(norm));
    if (!allowed.has(norm(cliente.nome))) void navigate({ to: "/por-clientes" });
  }, [cliente?.nome, restrictedClientes, navigate]);


  // Carrega TODOS os anos (necessário p/ visão compilada e p/ montar lista de anos)
  const { data: sellInAll } = useQuery({
    queryKey: ["sell-in-cliente-all", clienteId],
    queryFn: async () =>
      (await supabase.from("sell_in").select("ano,mes,valor").eq("cliente_id", clienteId)).data ?? [],
  });

  const { data: sellOutAll } = useQuery({
    queryKey: ["sell-out-cliente-all", clienteId],
    queryFn: async () =>
      (await supabase.from("sell_out").select("ano,mes,valor").eq("cliente_id", clienteId)).data ?? [],
  });

  const { data: pendProdutos } = useQuery({
    queryKey: ["pendencias-produtos-cliente", clienteId],
    queryFn: async () =>
      (await supabase
        .from("pendencias_produtos")
        .select("data_lancamento,ean,codigo_produto,produto,preco_unitario,quantidade,valor")
        .eq("cliente_id", clienteId)
        .order("valor", { ascending: false })).data ?? [],
  });

  const anosDisponiveis = useMemo(() => {
    const set = new Set<number>();
    (sellInAll ?? []).forEach((r) => set.add(Number(r.ano)));
    (sellOutAll ?? []).forEach((r) => set.add(Number(r.ano)));
    set.add(currentYear);
    return Array.from(set).sort((a, b) => a - b);
  }, [sellInAll, sellOutAll, currentYear]);

  const [pendFiltro, setPendFiltro] = useState<string[]>([]);

  const pendOpcoes = useMemo(() => {
    const set = new Map<string, string>();
    (pendProdutos ?? []).forEach((p) => {
      const nome = (p.produto ?? "").trim() || "—";
      set.set(nome, nome);
    });
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b, "pt-BR")).map((v) => ({ value: v, label: v }));
  }, [pendProdutos]);

  const pendFiltradas = useMemo(() => {
    const list = (pendProdutos ?? []).slice().sort((a, b) => (a.produto ?? "").localeCompare(b.produto ?? "", "pt-BR"));
    if (pendFiltro.length === 0) return list;
    const set = new Set(pendFiltro);
    return list.filter((p) => set.has((p.produto ?? "").trim() || "—"));
  }, [pendProdutos, pendFiltro]);

  const pendTotais = useMemo(() => {
    return {
      vol: pendFiltradas.reduce((a, b) => a + Number(b.quantidade), 0),
      valor: pendFiltradas.reduce((a, b) => a + Number(b.valor), 0),
    };
  }, [pendFiltradas]);

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

  // Conta Corrente
  const { data: arquivosCC } = useQuery({
    queryKey: ["conta-corrente", clienteId],
    queryFn: async () =>
      (await supabase.from("conta_corrente_arquivos").select("*").eq("cliente_id", clienteId).order("created_at", { ascending: false })).data ?? [],
  });

  const uploadCC = useMutation({
    mutationFn: async (files: FileList) => {
      for (const f of Array.from(files)) {
        const path = `${clienteId}/${Date.now()}-${f.name}`;
        const { error: upErr } = await supabase.storage.from("conta-corrente").upload(path, f);
        if (upErr) throw upErr;
        const { data: userData } = await supabase.auth.getUser();
        const { error } = await supabase.from("conta_corrente_arquivos").insert({
          cliente_id: clienteId, nome_arquivo: f.name, storage_path: path,
          mime_type: f.type, tamanho_bytes: f.size, uploaded_by: userData.user?.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Arquivos enviados"); void qc.invalidateQueries({ queryKey: ["conta-corrente", clienteId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const delCC = useMutation({
    mutationFn: async (a: { id: string; storage_path: string }) => {
      await supabase.storage.from("conta-corrente").remove([a.storage_path]);
      const { error } = await supabase.from("conta_corrente_arquivos").delete().eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removido"); void qc.invalidateQueries({ queryKey: ["conta-corrente", clienteId] }); },
  });

  // Observação
  const [obsText, setObsText] = useState<string>("");
  const [obsLoaded, setObsLoaded] = useState(false);
  useEffect(() => {
    if (!obsLoaded && cliente) {
      setObsText(cliente.observacao ?? "");
      setObsLoaded(true);
    }
  }, [cliente, obsLoaded]);
  const saveObs = useMutation({
    mutationFn: async (texto: string) => {
      const { error } = await supabase.from("clientes").update({ observacao: texto }).eq("id", clienteId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Observação salva"); void qc.invalidateQueries({ queryKey: ["cliente", clienteId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  async function shareUrl(bucket: string, path: string): Promise<string> {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    if (error || !data) throw error ?? new Error("Falha ao gerar link");
    return data.signedUrl;
  }
  async function openFile(bucket: string, path: string) {
    try { window.open(await shareUrl(bucket, path), "_blank", "noreferrer"); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function copyLink(bucket: string, path: string) {
    try { await navigator.clipboard.writeText(await shareUrl(bucket, path)); toast.success("Link copiado (válido por 1h)"); }
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
        <select
          value={String(anoSel)}
          onChange={(e) => setAnoSel(e.target.value === ALL ? ALL : Number(e.target.value))}
          className="h-10 px-3 bg-input border border-border rounded-md"
        >
          <option value={ALL}>Todos os anos</option>
          {anosDisponiveis.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </header>

      {anoSel === ALL ? (
        <>
          <MultiYearSection title="Sell In" rows={sellInAll ?? []} anos={anosDisponiveis} colorVar="var(--color-chart-1)" />
          <MultiYearSection title="Sell Out" rows={sellOutAll ?? []} anos={anosDisponiveis} colorVar="var(--color-chart-2)" />
        </>
      ) : (
        <>
          <MonthlyTable
            title={`Sell In · ${anoSel}`}
            agg={buildAgg((sellInAll ?? []).filter((r) => Number(r.ano) === anoSel))}
            colorVar="var(--color-chart-1)"
          />
          <MonthlyTable
            title={`Sell Out · ${anoSel}`}
            agg={buildAgg((sellOutAll ?? []).filter((r) => Number(r.ano) === anoSel))}
            colorVar="var(--color-chart-2)"
          />
        </>
      )}

      <PositivacaoSection clienteId={clienteId} ano={anoSel === ALL ? currentYear : anoSel} />


      <section className="bi-card mb-6 overflow-hidden">
        <header className="px-6 py-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Pendências em aberto</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Produtos pendentes deste cliente · ordem alfabética</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap text-right">
            <MultiSelect
              width={260}
              placeholder="Filtrar produtos"
              searchPlaceholder="Buscar produto..."
              options={pendOpcoes}
              selected={pendFiltro}
              onChange={setPendFiltro}
            />
            <div>
              <div className="bi-stat-label">Total VOL</div>
              <div className="font-display text-lg font-bold tabular-nums">{pendTotais.vol.toLocaleString("pt-BR")}</div>
            </div>
            <div>
              <div className="bi-stat-label">Total R$</div>
              <div className="font-display text-lg font-bold tabular-nums text-primary">{formatBRL(pendTotais.valor)}</div>
            </div>
            <button
              onClick={() => {
                const rows = pendFiltradas.map((p) => ({
                  "Data de Lançamento": p.data_lancamento ? formatDateBR(p.data_lancamento) : "",
                  "EAN": p.ean ?? "",
                  "Produto": p.produto ?? "",
                  "Preço (R$/und)": Number(p.preco_unitario ?? 0),
                  "Pend em aberto (VOL)": Number(p.quantidade ?? 0),
                  "Pend em aberto (R$)": Number(p.valor ?? 0),
                }));
                if (rows.length === 0) { toast.error("Sem pendências para exportar."); return; }
                exportToExcel(rows, `pendencias-${cliente?.nome ?? "cliente"}.xlsx`, "Pendências");
              }}
              className="h-9 px-3 rounded-md bg-secondary hover:bg-secondary/80 text-secondary-foreground font-semibold text-xs flex items-center gap-2"
            >
              <FileDown className="h-4 w-4" /> Exportar Excel
            </button>
          </div>
        </header>
        <div className="overflow-x-auto">
          <table className="bi-table">
            <thead>
              <tr>
                <th>Data de Lançamento</th>
                <th>EAN</th>
                <th>Produto</th>
                <th className="text-right">Preço (R$/und)</th>
                <th className="text-right">Pend em aberto (VOL)</th>
                <th className="text-right">Pend em aberto (R$)</th>
              </tr>
            </thead>
            <tbody>
              {pendFiltradas.map((p, i) => (
                <tr key={i}>
                  <td className="text-xs tabular-nums">{p.data_lancamento ? formatDateBR(p.data_lancamento) : "—"}</td>
                  <td className="text-xs text-muted-foreground tabular-nums">{p.ean || "—"}</td>
                  <td className="font-medium">{p.produto || "—"}</td>
                  <td className="text-right tabular-nums">{p.preco_unitario ? formatBRL(Number(p.preco_unitario)) : "—"}</td>
                  <td className="text-right tabular-nums">{Number(p.quantidade).toLocaleString("pt-BR")}</td>
                  <td className="text-right tabular-nums font-semibold">{formatBRL(Number(p.valor))}</td>
                </tr>
              ))}
              {pendFiltradas.length === 0 && (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma pendência registrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>


      {/* Mapas de vendas */}
      {/* Mapas de Vendas + Conta Corrente lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                  <button onClick={() => openFile("mapas-vendas", a.storage_path)} className="hover:text-primary text-left">{a.nome_arquivo}</button>
                </td>
                <td className="text-muted-foreground">{a.tamanho_bytes ? (Number(a.tamanho_bytes) / 1024).toFixed(0) + " KB" : "—"}</td>
                <td>{formatDateBR(a.created_at)}</td>
                <td className="text-right">
                  <div className="inline-flex items-center gap-1">
                    <button onClick={() => openFile("mapas-vendas", a.storage_path)}
                      className="h-8 w-8 rounded hover:bg-secondary inline-flex items-center justify-center" title="Baixar">
                      <Download className="h-4 w-4" />
                    </button>
                    <button onClick={() => copyLink("mapas-vendas", a.storage_path)}
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

      {/* Conta Corrente */}
      <section className="bi-card overflow-hidden">

        <header className="px-6 py-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Conta Corrente</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {canUploadMapas
                ? "Você pode enviar arquivos. Todos os usuários autenticados podem baixar."
                : "Somente o usuário autorizado pode enviar. Você pode baixar os arquivos disponíveis."}
            </p>
          </div>
          {canUploadMapas && (
            <div className="flex items-center gap-2">
              <input ref={ccInput} type="file" multiple className="hidden"
                onChange={(e) => e.target.files && uploadCC.mutate(e.target.files)} />
              <button onClick={() => ccInput.current?.click()}
                className="h-9 px-3 rounded-md bg-primary text-primary-foreground font-semibold text-xs flex items-center gap-2">
                <Upload className="h-4 w-4" /> Enviar arquivo
              </button>
            </div>
          )}
        </header>
        <table className="bi-table">
          <thead>
            <tr><th>Arquivo</th><th>Tamanho</th><th>Data</th><th className="text-right">Ações</th></tr>
          </thead>
          <tbody>
            {(arquivosCC ?? []).map((a) => (
              <tr key={a.id}>
                <td className="font-medium">
                  <button onClick={() => openFile("conta-corrente", a.storage_path)} className="hover:text-primary text-left">{a.nome_arquivo}</button>
                </td>
                <td className="text-muted-foreground">{a.tamanho_bytes ? (Number(a.tamanho_bytes) / 1024).toFixed(0) + " KB" : "—"}</td>
                <td>{formatDateBR(a.created_at)}</td>
                <td className="text-right">
                  <div className="inline-flex items-center gap-1">
                    <button onClick={() => openFile("conta-corrente", a.storage_path)}
                      className="h-8 w-8 rounded hover:bg-secondary inline-flex items-center justify-center" title="Baixar">
                      <Download className="h-4 w-4" />
                    </button>
                    <button onClick={() => copyLink("conta-corrente", a.storage_path)}
                      className="h-8 w-8 rounded hover:bg-secondary inline-flex items-center justify-center" title="Copiar link">
                      <LinkIcon className="h-4 w-4" />
                    </button>
                    {canUploadMapas && (
                      <button onClick={() => delCC.mutate({ id: a.id, storage_path: a.storage_path })}
                        className="h-8 w-8 rounded hover:bg-destructive/20 text-destructive inline-flex items-center justify-center" title="Excluir">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {arquivosCC?.length === 0 && <tr><td colSpan={4} className="text-center text-muted-foreground py-8">Nenhum arquivo enviado.</td></tr>}
          </tbody>
        </table>
      </section>
      </div>


      {/* Observação */}
      <section className="bi-card overflow-hidden mt-6">
        <header className="px-6 py-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Observação</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Anotações sobre este cliente.</p>
          </div>
          <button
            onClick={() => saveObs.mutate(obsText)}
            disabled={saveObs.isPending}
            className="h-9 px-3 rounded-md bg-primary text-primary-foreground font-semibold text-xs flex items-center gap-2 disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> {saveObs.isPending ? "Salvando..." : "Salvar"}
          </button>
        </header>
        <div className="p-6">
          <textarea
            value={obsText}
            onChange={(e) => setObsText(e.target.value)}
            rows={6}
            placeholder="Escreva uma observação sobre este cliente..."
            className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
          />
        </div>
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
      <header className="px-6 py-4 border-b border-border">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
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
      <div className="px-6 py-4 border-t border-border" style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={agg.chart} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
            <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} width={60}
              tickFormatter={(v: number) => formatBRL(v)} />
            <Tooltip
              contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 12 }}
              formatter={(v: number) => formatBRL(v)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="valor" name={title} stroke={colorVar} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

type YearRow = { ano: number; meses: number[]; total: number; media: number; crescimento: number | null };

function buildYearMatrix(
  rows: { ano: number; mes: number; valor: number | string }[],
  anos: number[],
): YearRow[] {
  const byYear = new Map<number, number[]>();
  anos.forEach((a) => byYear.set(a, Array(12).fill(0)));
  rows.forEach((r) => {
    const arr = byYear.get(Number(r.ano));
    if (arr) arr[Number(r.mes) - 1] += Number(r.valor);
  });
  const ordered = anos.slice().sort((a, b) => a - b);
  const result: YearRow[] = [];
  ordered.forEach((ano, idx) => {
    const meses = byYear.get(ano)!;
    const total = meses.reduce((a, b) => a + b, 0);
    const ativos = meses.filter((v) => v > 0).length;
    const media = ativos ? total / ativos : 0;
    const prev = idx > 0 ? result[idx - 1].total : null;
    const crescimento = prev && prev > 0 ? ((total - prev) / prev) * 100 : null;
    result.push({ ano, meses, total, media, crescimento });
  });
  return result;
}

function pctClass(v: number | null): string {
  if (v == null) return "text-muted-foreground";
  if (v >= 0) return "text-emerald-500";
  return "text-red-500";
}
function fmtPct(v: number | null): string {
  if (v == null) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2).replace(".", ",")}%`;
}

function MultiYearSection({
  title, rows, anos, colorVar,
}: {
  title: string;
  rows: { ano: number; mes: number; valor: number | string }[];
  anos: number[];
  colorVar: string;
}) {
  const matrix = useMemo(() => buildYearMatrix(rows, anos), [rows, anos]);

  // Dados do gráfico: linha por ano, eixo X = meses
  const chartData = useMemo(() => {
    return MESES_BR_SHORT.map((m, i) => {
      const obj: Record<string, number | string> = { mes: m };
      matrix.forEach((row) => { obj[String(row.ano)] = row.meses[i]; });
      return obj;
    });
  }, [matrix]);

  const maxPorMes = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      let max = 0;
      matrix.forEach((r) => { if (r.meses[i] > max) max = r.meses[i]; });
      return max;
    });
  }, [matrix]);

  return (
    <section className="bi-card mb-6 overflow-hidden">
      <header className="px-6 py-4 border-b border-border">
        <h2 className="font-display text-lg font-semibold">{title} · Todos os anos</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Compilado por ano com crescimento percentual · maior valor de cada mês destacado em verde</p>
      </header>
      <div className="overflow-x-auto">
        <table className="bi-table">
          <thead>
            <tr>
              <th className="text-left">Ano</th>
              {MESES_BR_SHORT.map((m) => <th key={m} className="text-right">{m}</th>)}
              <th className="text-right">Total</th>
              <th className="text-right">Média</th>
              <th className="text-right">Crescimento</th>
            </tr>
          </thead>
          <tbody>
            {matrix.map((row) => (
              <tr key={row.ano}>
                <td className="font-semibold">{row.ano}</td>
                {row.meses.map((v, i) => {
                  const isMax = v > 0 && v === maxPorMes[i];
                  return (
                    <td
                      key={i}
                      className={`text-right tabular-nums text-xs ${isMax ? "bg-emerald-500/15 text-emerald-500 font-semibold rounded" : ""}`}
                    >
                      {v ? formatBRL(v) : "—"}
                    </td>
                  );
                })}
                <td className="text-right tabular-nums font-semibold text-primary">{formatBRL(row.total)}</td>
                <td className="text-right tabular-nums font-semibold">{formatBRL(row.media)}</td>
                <td className={`text-right tabular-nums font-semibold ${pctClass(row.crescimento)}`}>
                  {fmtPct(row.crescimento)}
                </td>
              </tr>
            ))}
            {matrix.length === 0 && (
              <tr><td colSpan={16} className="text-center text-muted-foreground py-8">Sem dados.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Comparativo entre anos */}
      {matrix.length >= 2 && (
        <div className="px-6 py-4 border-t border-border">
          <div className="bi-stat-label mb-3">Comparativo entre anos</div>
          <div className="flex flex-wrap gap-3">
            {matrix.slice(1).map((row, i) => {
              const prev = matrix[i];
              const yyA = String(prev.ano).slice(-2);
              const yyB = String(row.ano).slice(-2);
              return (
                <div key={row.ano} className="rounded-md border border-border bg-card px-4 py-3 min-w-[160px]">
                  <div className="text-xs text-muted-foreground">{yyA} x {yyB}</div>
                  <div className={`font-display text-xl font-bold tabular-nums ${pctClass(row.crescimento)}`}>
                    {fmtPct(row.crescimento)}
                  </div>
                  <div className="text-[11px] text-muted-foreground tabular-nums mt-1">
                    {formatBRL(prev.total)} → {formatBRL(row.total)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Gráfico multi-ano */}
      <div className="px-6 py-4 border-t border-border" style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
            <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} width={70}
              tickFormatter={(v: number) => formatBRL(v)} />
            <Tooltip
              contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 12 }}
              formatter={(v: number) => formatBRL(v)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {matrix.map((row, i) => (
              <Line
                key={row.ano}
                type="monotone"
                dataKey={String(row.ano)}
                stroke={i === matrix.length - 1 ? colorVar : `hsl(${(i * 67) % 360} 60% 55%)`}
                strokeWidth={i === matrix.length - 1 ? 2.5 : 1.8}
                dot={{ r: 2 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function PositivacaoSection({ clienteId, ano }: { clienteId: string; ano: number }) {
  const qc = useQueryClient();
  const { data: rows } = useQuery({
    queryKey: ["positivacao", clienteId, ano],
    queryFn: async () =>
      (await supabase
        .from("positivacao")
        .select("mes,positivacao_total,positivacao_globo")
        .eq("cliente_id", clienteId)
        .eq("ano", ano)).data ?? [],
  });

  const byMes = useMemo(() => {
    const total = Array(12).fill(0);
    const globo = Array(12).fill(0);
    (rows ?? []).forEach((r) => {
      total[Number(r.mes) - 1] = Number(r.positivacao_total ?? 0);
      globo[Number(r.mes) - 1] = Number(r.positivacao_globo ?? 0);
    });
    return { total, globo };
  }, [rows]);

  const [totalEdit, setTotalEdit] = useState<string[]>(Array(12).fill(""));
  const [globoEdit, setGloboEdit] = useState<string[]>(Array(12).fill(""));
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setTotalEdit(byMes.total.map((v) => (v ? String(v) : "")));
    setGloboEdit(byMes.globo.map((v) => (v ? String(v) : "")));
    setLoaded(true);
  }, [byMes]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = Array.from({ length: 12 }, (_, i) => ({
        cliente_id: clienteId,
        ano,
        mes: i + 1,
        positivacao_total: Number(totalEdit[i] || 0),
        positivacao_globo: Number(globoEdit[i] || 0),
      }));
      const { error } = await supabase
        .from("positivacao")
        .upsert(payload, { onConflict: "cliente_id,ano,mes" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Positivação salva");
      void qc.invalidateQueries({ queryKey: ["positivacao", clienteId, ano] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const chartData = MESES_BR_SHORT.map((m, i) => ({
    mes: m,
    "Positivação Total": Number(totalEdit[i] || 0),
    "Positivação Globo": Number(globoEdit[i] || 0),
  }));

  if (!loaded) return null;

  return (
    <section className="bi-card mb-6 overflow-hidden">
      <header className="px-6 py-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Positivação · {ano}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Atualize manualmente os valores mensais.</p>
        </div>
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="h-9 px-3 rounded-md bg-primary text-primary-foreground font-semibold text-xs flex items-center gap-2 disabled:opacity-60"
        >
          <Save className="h-4 w-4" /> {save.isPending ? "Salvando..." : "Salvar"}
        </button>
      </header>
      <div className="overflow-x-auto">
        <table className="bi-table">
          <thead>
            <tr>
              <th className="text-left">Indicador</th>
              {MESES_BR_SHORT.map((m) => <th key={m} className="text-right">{m}</th>)}
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="font-semibold">Positivação Total</td>
              {totalEdit.map((v, i) => (
                <td key={i} className="text-right">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={v}
                    onChange={(e) => {
                      const next = totalEdit.slice();
                      next[i] = e.target.value;
                      setTotalEdit(next);
                    }}
                    className="w-20 bg-input border border-border rounded px-2 py-1 text-xs text-right tabular-nums"
                  />
                </td>
              ))}
              <td className="text-right tabular-nums font-semibold text-primary">
                {totalEdit.reduce((a, b) => a + Number(b || 0), 0).toLocaleString("pt-BR")}
              </td>
            </tr>
            <tr>
              <td className="font-semibold">Positivação Globo</td>
              {globoEdit.map((v, i) => (
                <td key={i} className="text-right">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={v}
                    onChange={(e) => {
                      const next = globoEdit.slice();
                      next[i] = e.target.value;
                      setGloboEdit(next);
                    }}
                    className="w-20 bg-input border border-border rounded px-2 py-1 text-xs text-right tabular-nums"
                  />
                </td>
              ))}
              <td className="text-right tabular-nums font-semibold text-primary">
                {globoEdit.reduce((a, b) => a + Number(b || 0), 0).toLocaleString("pt-BR")}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="px-6 py-4 border-t border-border" style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
            <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} width={60}
              tickFormatter={(v: number) => v.toLocaleString("pt-BR")} />
            <Tooltip
              contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 12 }}
              formatter={(v: number) => v.toLocaleString("pt-BR")} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="Positivação Total" stroke="var(--color-chart-1)" strokeWidth={2.5} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="Positivação Globo" stroke="var(--color-chart-2)" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

