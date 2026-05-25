import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDateBR } from "@/lib/format";
import { useState } from "react";
import { Field, PeriodoSelect, SmallStyles } from "./pedidos";
import { X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/notas-fiscais")({ component: NFsPage });

function NFsPage() {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [selected, setSelected] = useState<string | null>(null);

  const { data: nfs } = useQuery({
    queryKey: ["nfs", ano, mes],
    queryFn: async () => {
      const start = `${ano}-${String(mes).padStart(2, "0")}-01`;
      const end = new Date(ano, mes, 0).toISOString().slice(0, 10);
      const { data } = await supabase.from("notas_fiscais")
        .select("id,data,numero,valor,desconto,clientes(nome)")
        .gte("data", start).lte("data", end).order("data", { ascending: false });
      return data ?? [];
    },
  });

  const total = (nfs ?? []).reduce((a, n) => a + Number(n.valor), 0);

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <h1 className="font-display text-3xl font-bold">Notas Fiscais Faturadas</h1>
      <p className="text-muted-foreground mt-1">Clique em uma NF para ver os itens detalhados.</p>

      <div className="flex items-center gap-3 mt-6">
        <PeriodoSelect mes={mes} ano={ano} onMes={setMes} onAno={setAno} />
      </div>

      <div className="bi-card mt-6 overflow-hidden">
        <table className="bi-table">
          <thead>
            <tr>
              <th>Data</th><th>Número</th><th>Cliente</th>
              <th className="text-right">Desconto</th><th className="text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {(nfs ?? []).map((n) => (
              <tr key={n.id} onClick={() => setSelected(n.id)} className="cursor-pointer">
                <td>{formatDateBR(n.data)}</td>
                <td className="font-medium text-primary">{n.numero}</td>
                <td>{n.clientes?.nome ?? "—"}</td>
                <td className="text-right tabular-nums">{formatBRL(n.desconto)}</td>
                <td className="text-right tabular-nums">{formatBRL(n.valor)}</td>
              </tr>
            ))}
            {nfs?.length === 0 && <tr><td colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma NF no período.</td></tr>}
          </tbody>
          <tfoot>
            <tr><td colSpan={4}>TOTAL DO MÊS</td><td className="text-right text-primary">{formatBRL(total)}</td></tr>
          </tfoot>
        </table>
      </div>

      {selected && <NFItemsDrawer id={selected} onClose={() => setSelected(null)} />}
      <SmallStyles />
    </div>
  );
}

function NFItemsDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data } = useQuery({
    queryKey: ["nf-itens", id],
    queryFn: async () => {
      const [nf, itens] = await Promise.all([
        supabase.from("notas_fiscais").select("numero,data,valor,desconto,clientes(nome)").eq("id", id).single(),
        supabase.from("itens_nf").select("*").eq("nota_fiscal_id", id),
      ]);
      return { nf: nf.data, itens: itens.data ?? [] };
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-black/60" />
      <aside onClick={(e) => e.stopPropagation()} className="w-full max-w-[700px] bg-card border-l border-border overflow-y-auto">
        <header className="px-6 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-card">
          <div>
            <div className="bi-stat-label">Nota Fiscal</div>
            <h2 className="font-display text-xl font-bold mt-1">NF {data?.nf?.numero}</h2>
            <p className="text-xs text-muted-foreground">{data?.nf?.clientes?.nome} · {formatDateBR(data?.nf?.data)}</p>
          </div>
          <button onClick={onClose} className="h-9 w-9 rounded-md hover:bg-secondary flex items-center justify-center"><X className="h-4 w-4" /></button>
        </header>
        <div className="p-6">
          <h3 className="bi-stat-label mb-3">Itens da NF</h3>
          <table className="bi-table">
            <thead>
              <tr>
                <th>Código</th><th>Produto</th>
                <th className="text-right">Qtd</th>
                <th className="text-right">V. Unit</th>
                <th className="text-right">Desc.</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {data?.itens.map((i) => (
                <tr key={i.id}>
                  <td className="text-xs text-muted-foreground">{i.codigo_produto}</td>
                  <td>{i.produto}</td>
                  <td className="text-right tabular-nums">{Number(i.quantidade).toLocaleString("pt-BR")}</td>
                  <td className="text-right tabular-nums">{formatBRL(i.valor_unitario)}</td>
                  <td className="text-right tabular-nums">{formatBRL(i.desconto)}</td>
                  <td className="text-right tabular-nums font-semibold">{formatBRL(i.valor_total)}</td>
                </tr>
              ))}
              {data && data.itens.length === 0 && (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-6">Sem itens registrados. Importe a NF via Excel.</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>TOTAL DA NF</td>
                <td className="text-right">{formatBRL(data?.nf?.desconto)}</td>
                <td className="text-right text-primary">{formatBRL(data?.nf?.valor)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </aside>
    </div>
  );
}
