import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDateBR, MESES_BR_SHORT } from "@/lib/format";
import { useState } from "react";
import { exportToExcel } from "@/lib/excel";
import { Download, Plus, Trash2, Save } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/sell-in")({ component: SellInPage });

function SellInPage() {
  const [ano, setAno] = useState(new Date().getFullYear());
  const { canEdit } = useAuth();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["sell-in-consolidado", ano],
    queryFn: async () => {
      const [clientes, sellIn] = await Promise.all([
        supabase.from("clientes").select("id,nome").order("nome"),
        supabase.from("sell_in").select("cliente_id,mes,valor").eq("ano", ano),
      ]);
      const matrix = new Map<string, { nome: string; meses: number[]; total: number; media: number; repr: number }>();
      (clientes.data ?? []).forEach((c) => matrix.set(c.id, { nome: c.nome, meses: Array(12).fill(0), total: 0, media: 0, repr: 0 }));
      (sellIn.data ?? []).forEach((s) => {
        const r = matrix.get(s.cliente_id); if (!r) return;
        r.meses[s.mes - 1] = Number(s.valor); r.total += Number(s.valor);
      });
      const mesAtual = new Date().getMonth() + 1; // 1-12
      const rows = Array.from(matrix.values()).map((r) => ({
        ...r,
        media: mesAtual > 0 ? r.total / mesAtual : 0,
        repr: 0, // calculado depois
      }));
      const totaisMes = Array(12).fill(0);
      rows.forEach((r) => r.meses.forEach((v, i) => (totaisMes[i] += v)));
      const totalGeral = totaisMes.reduce((a, b) => a + b, 0);
      rows.forEach((r) => (r.repr = totalGeral > 0 ? (r.total / totalGeral) * 100 : 0));
      return { rows, totaisMes, totalGeral, mesAtual };
    },
  });

  const { data: descricoes } = useQuery({
    queryKey: ["descricoes-sell-in"],
    queryFn: async () => (await supabase.from("descricoes_sell_in").select("*").order("updated_at", { ascending: false })).data ?? [],
  });

  const { data: clientes } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => (await supabase.from("clientes").select("id,nome").order("nome")).data ?? [],
  });

  const [novoTitulo, setNovoTitulo] = useState("");
  const [novoTexto, setNovoTexto] = useState("");
  const [novoCliente, setNovoCliente] = useState("");

  const addDesc = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("descricoes_sell_in").insert({
        titulo: novoTitulo || null,
        texto: novoTexto,
        cliente_id: novoCliente || null,
        created_by: u.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Observação adicionada"); setNovoTitulo(""); setNovoTexto(""); setNovoCliente(""); void qc.invalidateQueries({ queryKey: ["descricoes-sell-in"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const delDesc = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("descricoes_sell_in").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["descricoes-sell-in"] }),
  });

  const updDesc = useMutation({
    mutationFn: async (d: { id: string; texto: string; titulo: string | null }) => {
      const { error } = await supabase.from("descricoes_sell_in").update({ texto: d.texto, titulo: d.titulo }).eq("id", d.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Observação atualizada"); void qc.invalidateQueries({ queryKey: ["descricoes-sell-in"] }); },
  });

  function handleExport() {
    if (!data) return;
    const rows = data.rows.map((r) => {
      const obj: Record<string, unknown> = { Cliente: r.nome };
      MESES_BR_SHORT.forEach((m, i) => (obj[m] = r.meses[i]));
      obj.Total = r.total;
      return obj;
    });
    exportToExcel(rows, `sell-in-${ano}.xlsx`, "Sell In");
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <header className="flex items-end justify-between mb-6">
        <div>
          <div className="bi-stat-label">Consolidado anual</div>
          <h1 className="font-display text-3xl font-bold mt-1">Sell In · {ano}</h1>
        </div>
        <div className="flex items-center gap-3">
          <select value={ano} onChange={(e) => setAno(Number(e.target.value))} className="h-10 px-3 bg-input border border-border rounded-md">
            {[ano - 1, ano, ano + 1].map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <button onClick={handleExport} className="h-10 px-4 rounded-md bg-primary text-primary-foreground font-semibold text-sm flex items-center gap-2">
            <Download className="h-4 w-4" /> Excel
          </button>
        </div>
      </header>

      <div className="bi-card overflow-x-auto">
        <table className="bi-table">
          <thead>
            <tr>
              <th>Cliente</th>
              {MESES_BR_SHORT.map((m) => <th key={m} className="text-right">{m}</th>)}
              <th className="text-right">Total</th>
              <th className="text-right">Média</th>
              <th className="text-right">Representatividade</th>
            </tr>
          </thead>
          <tbody>
            {data?.rows.map((r) => (
              <tr key={r.nome}>
                <td className="font-medium">{r.nome}</td>
                {r.meses.map((v, i) => <td key={i} className="text-right tabular-nums text-xs">{v ? formatBRL(v) : "—"}</td>)}
                <td className="text-right tabular-nums font-semibold text-primary">{formatBRL(r.total)}</td>
                <td className="text-right tabular-nums text-xs text-muted-foreground">{formatBRL(r.media)}</td>
                <td className="text-right">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                    r.repr >= 15 ? "bg-emerald-500/20 text-emerald-400" :
                    r.repr >= 5 ? "bg-yellow-500/20 text-yellow-400" :
                    "bg-red-500/20 text-red-400"
                  }`}>
                    {r.repr.toFixed(1).replace(".", ",")}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>TOTAL</td>
              {data?.totaisMes.map((v, i) => <td key={i} className="text-right text-xs">{formatBRL(v)}</td>)}
              <td className="text-right text-primary">{formatBRL(data?.totalGeral ?? 0)}</td>
              <td className="text-right text-xs text-muted-foreground">
                {data?.totalGeral && data?.mesAtual ? formatBRL(data.totalGeral / data.mesAtual) : formatBRL(0)}
              </td>
              <td className="text-right text-xs font-semibold">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <section className="mt-10">
        <div className="flex items-end justify-between mb-4">
          <div>
            <div className="bi-stat-label">Observações & Descrições</div>
            <h2 className="font-display text-xl font-bold mt-1">Notas do Sell In</h2>
          </div>
        </div>

        {canEdit && (
          <div className="bi-card p-5 mb-5 grid grid-cols-1 md:grid-cols-3 gap-3">
            <input value={novoTitulo} onChange={(e) => setNovoTitulo(e.target.value)} placeholder="Título (opcional)" className="bi-desc-input md:col-span-2" />
            <select value={novoCliente} onChange={(e) => setNovoCliente(e.target.value)} className="bi-desc-input">
              <option value="">Sem cliente vinculado</option>
              {(clientes ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <textarea value={novoTexto} onChange={(e) => setNovoTexto(e.target.value)} placeholder="Cole aqui descrição, observação ou comentário…"
              rows={4} className="bi-desc-input md:col-span-3 font-sans" />
            <div className="md:col-span-3 flex justify-end">
              <button disabled={!novoTexto || addDesc.isPending} onClick={() => addDesc.mutate()}
                className="h-10 px-5 rounded-md bg-primary text-primary-foreground text-xs font-semibold uppercase flex items-center gap-2 disabled:opacity-50">
                <Plus className="h-4 w-4" /> Adicionar
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(descricoes ?? []).map((d) => {
            const clienteNome = clientes?.find((c) => c.id === d.cliente_id)?.nome ?? null;
            return <DescCard key={d.id} d={{ ...d, clienteNome }} canEdit={canEdit}
              onDelete={() => delDesc.mutate(d.id)}
              onSave={(t, ti) => updDesc.mutate({ id: d.id, texto: t, titulo: ti })} />;
          })}
          {descricoes?.length === 0 && <div className="text-sm text-muted-foreground bi-card p-6 col-span-full">Nenhuma observação ainda.</div>}
        </div>
      </section>

      <style>{`
        .bi-desc-input { background: var(--color-input); border: 1px solid var(--color-border); border-radius: 6px; padding: 10px 12px; font-size: 14px; color: var(--color-foreground); outline: none; width: 100%; }
        .bi-desc-input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-ring); }
      `}</style>
    </div>
  );
}

type DescItem = { id: string; titulo: string | null; texto: string; updated_at: string; clienteNome: string | null };

function DescCard({ d, canEdit, onDelete, onSave }: { d: DescItem; canEdit: boolean; onDelete: () => void; onSave: (texto: string, titulo: string | null) => void }) {
  const [edit, setEdit] = useState(false);
  const [texto, setTexto] = useState(d.texto);
  const [titulo, setTitulo] = useState(d.titulo ?? "");

  return (
    <div className="bi-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {edit
            ? <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título" className="bi-desc-input mb-2" />
            : <div className="font-display font-bold">{d.titulo || "Observação"}</div>
          }
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {d.clienteNome ? `${d.clienteNome} · ` : ""}{formatDateBR(d.updated_at)}
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-1">
            {edit
              ? <button onClick={() => { onSave(texto, titulo || null); setEdit(false); }} className="h-8 w-8 rounded hover:bg-secondary inline-flex items-center justify-center"><Save className="h-4 w-4 text-primary" /></button>
              : <button onClick={() => setEdit(true)} className="text-xs text-primary font-semibold px-2">Editar</button>
            }
            <button onClick={onDelete} className="h-8 w-8 rounded hover:bg-destructive/20 text-destructive inline-flex items-center justify-center"><Trash2 className="h-4 w-4" /></button>
          </div>
        )}
      </div>
      <div className="mt-3">
        {edit
          ? <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={5} className="bi-desc-input" />
          : <p className="text-sm whitespace-pre-wrap text-foreground/90">{d.texto}</p>
        }
      </div>
    </div>
  );
}
