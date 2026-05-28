import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDateBR, parseBRNumber, parseBRDate, MESES_BR } from "@/lib/format";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { buildClienteIndex, clienteIdFromRazao } from "@/lib/cliente-mapping";
import { readExcelFile, pickCol, rowToBRDate, rowToBRNumber, exportToExcel } from "@/lib/excel";
import { Clipboard, Upload, Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pedidos")({ component: PedidosPage });

function PedidosPage() {
  const { canEdit } = useAuth();
  const qc = useQueryClient();
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [clienteFiltro, setClienteFiltro] = useState("");
  const [valorMin, setValorMin] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [clienteId, setClienteId] = useState("");
  const [valor, setValor] = useState("");

  const { data: clientes } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => (await supabase.from("clientes").select("id,nome").order("nome")).data ?? [],
  });

  const { data: pedidos } = useQuery({
    queryKey: ["pedidos", ano, mes, clienteFiltro],
    queryFn: async () => {
      const start = `${ano}-${String(mes).padStart(2, "0")}-01`;
      const end = new Date(ano, mes, 0).toISOString().slice(0, 10);
      let q = supabase.from("pedidos_enviados")
        .select("id,data,valor,cliente_id,clientes(nome)")
        .gte("data", start).lte("data", end).order("data", { ascending: false });
      if (clienteFiltro) q = q.eq("cliente_id", clienteFiltro);
      const { data } = await q;
      return data ?? [];
    },
  });

  const filtrados = useMemo(() => {
    const min = parseBRNumber(valorMin);
    return (pedidos ?? []).filter((p) => (min ? Number(p.valor) >= min : true));
  }, [pedidos, valorMin]);
  const total = filtrados.reduce((a, p) => a + Number(p.valor), 0);

  const create = useMutation({
    mutationFn: async () => {
      const v = parseBRNumber(valor);
      const { error } = await supabase.from("pedidos_enviados").insert({ data, cliente_id: clienteId, valor: v });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Pedido registrado"); setValor(""); void qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkInsert = useMutation({
    mutationFn: async (rows: { data: string; cliente_id: string; valor: number }[]) => {
      const { error, count } = await supabase.from("pedidos_enviados").upsert(rows as never, { onConflict: "data,cliente_id,valor", ignoreDuplicates: true, count: "exact" });
      if (error) throw error;
      return count ?? rows.length;
    },
    onSuccess: (n) => { toast.success(`${n} pedidos processados (duplicados ignorados)`); setPasteText(""); setPasteOpen(false); void qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });

  function parsePastedText(): { data: string; cliente_id: string; valor: number }[] {
    const idx = buildClienteIndex(clientes ?? []);
    const lines = pasteText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const rows: { data: string; cliente_id: string; valor: number }[] = [];
    for (const line of lines) {
      const parts = line.split(/[\t|;]|\s{2,}/).map((p) => p.trim()).filter(Boolean);
      if (parts.length < 3) continue;
      const dataISO = parseBRDate(parts[0]);
      const cid = clienteIdFromRazao(parts[1], idx);
      const v = parseBRNumber(parts.slice(2).join(" "));
      if (dataISO && cid && v > 0) rows.push({ data: dataISO, cliente_id: cid, valor: v });
    }
    return rows;
  }

  async function processExcel(file: File) {
    try {
      const { sheets } = await readExcelFile(file);
      const sheet = Object.values(sheets)[0];
      const idx = buildClienteIndex(clientes ?? []);
      const rows = sheet.map((r) => ({
        data: rowToBRDate(pickCol(r, "Data", "DATA")),
        cliente_id: clienteIdFromRazao(String(pickCol(r, "Cliente", "CLIENTE") ?? ""), idx),
        valor: rowToBRNumber(pickCol(r, "Valor", "VALOR")),
      })).filter((r): r is { data: string; cliente_id: string; valor: number } => !!r.data && !!r.cliente_id && r.valor > 0);
      if (rows.length === 0) { toast.error("Nenhuma linha válida na planilha"); return; }
      bulkInsert.mutate(rows);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  function handleExport() {
    const rows = filtrados.map((p) => ({
      Data: formatDateBR(p.data),
      Cliente: p.clientes?.nome ?? "",
      Valor: Number(p.valor),
    }));
    exportToExcel(rows, `pedidos-${ano}-${String(mes).padStart(2, "0")}.xlsx`, "Pedidos");
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <h1 className="font-display text-3xl font-bold">Pedidos Enviados</h1>
      <p className="text-muted-foreground mt-1">Histórico mensal de pedidos enviados aos clientes.</p>

      <div className="flex flex-wrap items-center gap-3 mt-6">
        <PeriodoSelect mes={mes} ano={ano} onMes={setMes} onAno={setAno} />
        <select value={clienteFiltro} onChange={(e) => setClienteFiltro(e.target.value)} className="bi-input-sm w-56">
          <option value="">Todos os clientes</option>
          {(clientes ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <input placeholder="Valor mínimo" value={valorMin} onChange={(e) => setValorMin(e.target.value)} className="bi-input-sm w-36" />
        <button onClick={handleExport} className="h-10 px-4 rounded-md bg-secondary text-secondary-foreground text-sm font-semibold flex items-center gap-2">
          <Download className="h-4 w-4" /> Exportar
        </button>
      </div>

      {canEdit && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-5">
          <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
            className="bi-card p-5 grid grid-cols-2 gap-3 lg:col-span-1">
            <div className="col-span-2 bi-stat-label">Adicionar Pedido</div>
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
          </form>

          <div className="bi-card p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <div className="bi-stat-label">Importar em lote</div>
              <button onClick={() => setPasteOpen((v) => !v)} className="text-xs text-primary font-semibold flex items-center gap-1">
                <Clipboard className="h-3 w-3" /> {pasteOpen ? "Fechar" : "Colar manualmente"}
              </button>
            </div>
            <label className="border-2 border-dashed border-border rounded-md p-6 flex items-center justify-center gap-3 cursor-pointer hover:border-primary transition-colors">
              <Upload className="h-5 w-5 text-primary" />
              <span className="text-sm">Selecionar .xlsx (DATA · CLIENTE · VALOR)</span>
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && processExcel(e.target.files[0])} />
            </label>
            {pasteOpen && (
              <div className="mt-3">
                <textarea
                  value={pasteText} onChange={(e) => setPasteText(e.target.value)}
                  rows={6} placeholder={"12/01/2026\tANDORINHA\tR$ 18.787,62\n12/01/2026\tJK MEDICAMENTOS\tR$ 336.794,64"}
                  className="w-full bg-input border border-border rounded-md p-3 text-sm font-mono"
                />
                <div className="flex justify-end mt-2">
                  <button onClick={() => { const r = parsePastedText(); if (r.length === 0) toast.error("Nenhuma linha válida"); else bulkInsert.mutate(r); }}
                    className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-xs font-semibold uppercase">
                    Importar {pasteText ? `(${pasteText.split(/\r?\n/).filter(Boolean).length} linhas)` : ""}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bi-card mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="bi-table">
            <thead>
              <tr>
                <th>Data</th><th>Cliente</th><th className="text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => (
                <tr key={p.id}>
                  <td>{formatDateBR(p.data)}</td>
                  <td>{p.clientes?.nome ?? "—"}</td>
                  <td className="text-right tabular-nums">{formatBRL(p.valor)}</td>
                </tr>
              ))}
              {filtrados.length === 0 && <tr><td colSpan={3} className="text-center text-muted-foreground py-8">Nenhum pedido neste período.</td></tr>}
            </tbody>
            <tfoot>
              <tr><td colSpan={2}>TOTAL ({filtrados.length})</td><td className="text-right text-primary">{formatBRL(total)}</td></tr>
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
