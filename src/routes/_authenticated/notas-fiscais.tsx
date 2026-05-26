import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDateBR } from "@/lib/format";
import { useState, useMemo } from "react";
import { PeriodoSelect, SmallStyles } from "./pedidos";
import { ChevronDown, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/notas-fiscais")({ component: NFsPage });

function NFsPage() {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [clienteFiltro, setClienteFiltro] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: clientes } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => (await supabase.from("clientes").select("id,nome").order("nome")).data ?? [],
  });

  const { data: nfs } = useQuery({
    queryKey: ["nfs", ano, mes, clienteFiltro],
    queryFn: async () => {
      const start = `${ano}-${String(mes).padStart(2, "0")}-01`;
      const end = new Date(ano, mes, 0).toISOString().slice(0, 10);
      let q = supabase.from("notas_fiscais")
        .select("id,data,numero,valor,desconto,cliente_id,clientes(nome)")
        .gte("data", start).lte("data", end).order("data", { ascending: false });
      if (clienteFiltro) q = q.eq("cliente_id", clienteFiltro);
      const { data } = await q;
      return data ?? [];
    },
  });

  const total = useMemo(() => (nfs ?? []).reduce((a, n) => a + Number(n.valor), 0), [nfs]);

  function toggle(id: string) {
    setExpanded((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <h1 className="font-display text-3xl font-bold">Notas Fiscais Faturadas</h1>
      <p className="text-muted-foreground mt-1">Clique em uma NF para expandir os itens.</p>

      <div className="flex flex-wrap items-center gap-3 mt-6">
        <PeriodoSelect mes={mes} ano={ano} onMes={setMes} onAno={setAno} />
        <select value={clienteFiltro} onChange={(e) => setClienteFiltro(e.target.value)} className="bi-input-sm w-56">
          <option value="">Todos os clientes</option>
          {(clientes ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </div>

      <div className="bi-card mt-6 overflow-hidden">
        <table className="bi-table">
          <thead>
            <tr>
              <th style={{ width: 38 }}></th>
              <th>Data</th><th>Número</th><th>Cliente</th>
              <th className="text-right">Desconto</th><th className="text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {(nfs ?? []).map((n) => {
              const open = expanded.has(n.id);
              return (
                <>
                  <tr key={n.id} onClick={() => toggle(n.id)} className="cursor-pointer">
                    <td>{open ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}</td>
                    <td>{formatDateBR(n.data)}</td>
                    <td className="font-medium text-primary">{n.numero}</td>
                    <td>{n.clientes?.nome ?? "—"}</td>
                    <td className="text-right tabular-nums">{formatBRL(n.desconto)}</td>
                    <td className="text-right tabular-nums">{formatBRL(n.valor)}</td>
                  </tr>
                  {open && <ItensRow key={n.id + "-items"} nfId={n.id} />}
                </>
              );
            })}
            {nfs?.length === 0 && <tr><td colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma NF no período.</td></tr>}
          </tbody>
          <tfoot>
            <tr><td colSpan={5}>TOTAL DO MÊS</td><td className="text-right text-primary">{formatBRL(total)}</td></tr>
          </tfoot>
        </table>
      </div>

      <SmallStyles />
    </div>
  );
}

function ItensRow({ nfId }: { nfId: string }) {
  const { data: itens, isLoading } = useQuery({
    queryKey: ["nf-itens", nfId],
    queryFn: async () => (await supabase.from("itens_nf").select("*").eq("nota_fiscal_id", nfId)).data ?? [],
  });

  return (
    <tr>
      <td colSpan={6} className="bg-muted/30 p-0">
        <div className="px-6 py-4">
          <div className="bi-stat-label mb-2">Itens da NF</div>
          {isLoading && <div className="text-sm text-muted-foreground py-2">Carregando…</div>}
          {!isLoading && itens && itens.length === 0 && <div className="text-sm text-muted-foreground py-2">Sem itens registrados. Importe a planilha de faturamento.</div>}
          {itens && itens.length > 0 && (
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
                {itens.map((i) => (
                  <tr key={i.id}>
                    <td className="text-xs text-muted-foreground">{i.codigo_produto}</td>
                    <td>{i.produto}</td>
                    <td className="text-right tabular-nums">{Number(i.quantidade).toLocaleString("pt-BR")}</td>
                    <td className="text-right tabular-nums">{formatBRL(i.valor_unitario)}</td>
                    <td className="text-right tabular-nums">{formatBRL(i.desconto)}</td>
                    <td className="text-right tabular-nums font-semibold">{formatBRL(i.valor_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </td>
    </tr>
  );
}
