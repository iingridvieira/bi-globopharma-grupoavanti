import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDateBR, parseBRNumber, MESES_BR } from "@/lib/format";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/pedidos")({ component: PedidosPage });

function PedidosPage() {
  const { canEdit } = useAuth();
  const qc = useQueryClient();
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [clienteId, setClienteId] = useState("");
  const [valor, setValor] = useState("");

  const { data: clientes } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => (await supabase.from("clientes").select("id,nome").order("nome")).data ?? [],
  });

  const { data: pedidos } = useQuery({
    queryKey: ["pedidos", ano, mes],
    queryFn: async () => {
      const start = `${ano}-${String(mes).padStart(2, "0")}-01`;
      const end = new Date(ano, mes, 0).toISOString().slice(0, 10);
      const { data } = await supabase
        .from("pedidos_enviados")
        .select("id,data,valor,cliente_id,clientes(nome)")
        .gte("data", start).lte("data", end).order("data", { ascending: false });
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const v = parseBRNumber(valor);
      const { error } = await supabase.from("pedidos_enviados").insert({ data, cliente_id: clienteId, valor: v });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Pedido registrado"); setValor(""); void qc.invalidateQueries({ queryKey: ["pedidos"] }); void qc.invalidateQueries({ queryKey: ["dashboard"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const total = (pedidos ?? []).reduce((a, p) => a + Number(p.valor), 0);

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <h1 className="font-display text-3xl font-bold">Pedidos Enviados</h1>
      <p className="text-muted-foreground mt-1">Histórico mensal de pedidos enviados aos clientes.</p>

      <div className="flex items-center gap-3 mt-6">
        <PeriodoSelect mes={mes} ano={ano} onMes={setMes} onAno={setAno} />
      </div>

      {canEdit && (
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
          className="bi-card p-5 mt-5 grid grid-cols-1 md:grid-cols-4 gap-3">
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
            <button disabled={create.isPending} className="h-10 px-5 rounded-md bg-primary text-primary-foreground font-semibold uppercase text-xs tracking-wider hover:opacity-90 disabled:opacity-50">
              Adicionar
            </button>
          </div>
        </form>
      )}

      <div className="bi-card mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="bi-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Cliente</th>
                <th className="text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {(pedidos ?? []).map((p) => (
                <tr key={p.id}>
                  <td>{formatDateBR(p.data)}</td>
                  <td>{p.clientes?.nome ?? "—"}</td>
                  <td className="text-right tabular-nums">{formatBRL(p.valor)}</td>
                </tr>
              ))}
              {pedidos?.length === 0 && <tr><td colSpan={3} className="text-center text-muted-foreground py-8">Nenhum pedido neste período.</td></tr>}
            </tbody>
            <tfoot>
              <tr><td colSpan={2}>TOTAL DO MÊS</td><td className="text-right text-primary">{formatBRL(total)}</td></tr>
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
      .bi-input-sm { height: 40px; padding: 0 12px; background: var(--color-input); border: 1px solid var(--color-border); border-radius: 6px; color: var(--color-foreground); font-size: 14px; width: 100%; outline: none; }
      .bi-input-sm:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-ring); }
    `}</style>
  );
}
