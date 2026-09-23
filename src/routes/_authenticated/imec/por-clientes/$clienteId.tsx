import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MultiSelect } from "@/components/MultiSelect";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { exportToExcel } from "@/lib/excel";
import { formatBRL, formatDateBR, MESES_BR_SHORT } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/imec/por-clientes/$clienteId")({
  head: () => ({
    meta: [
      { title: "Detalhes do Cliente · BI IMEC" },
      { name: "description", content: "Gráfico de Sell In e pendências do cliente no BI IMEC." },
      { property: "og:title", content: "Detalhes do Cliente · BI IMEC" },
      { property: "og:description", content: "Gráfico de Sell In e pendências do cliente no BI IMEC." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ImecClienteDetalhe,
});

type Pendencia = {
  id: string;
  empresa: string;
  numero_pedido: string | null;
  data_emissao: string | null;
  data_entrega: string | null;
  codigo_produto: string | null;
  produto: string;
  preco_unitario: number;
  quantidade: number;
  valor: number;
};

function ImecClienteDetalhe() {
  const { clienteId } = Route.useParams();
  const [ano, setAno] = useState(new Date().getFullYear());
  const [produtoFiltro, setProdutoFiltro] = useState<string[]>([]);
  const [empresaFiltro, setEmpresaFiltro] = useState<string[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["imec-cliente-detalhe", clienteId],
    queryFn: async () => {
      const [clienteRes, sellInRes, pendRes] = await Promise.all([
        supabase.from("imec_clientes").select("id,nome").eq("id", clienteId).single(),
        supabase.from("imec_sell_in").select("ano,mes,valor,empresa").eq("cliente_id", clienteId),
        supabase.from("imec_pendencias_produtos").select("id,empresa,numero_pedido,data_emissao,data_entrega,codigo_produto,produto,preco_unitario,quantidade,valor").eq("cliente_id", clienteId).limit(10000),
      ]);
      const error = clienteRes.error ?? sellInRes.error ?? pendRes.error;
      if (error) throw error;
      return { cliente: clienteRes.data, sellIn: sellInRes.data ?? [], pendencias: (pendRes.data ?? []) as Pendencia[] };
    },
  });

  const anos = useMemo(() => {
    const values = new Set((data?.sellIn ?? []).map((row) => Number(row.ano)));
    values.add(new Date().getFullYear());
    return Array.from(values).sort((a, b) => b - a);
  }, [data?.sellIn]);

  const chartData = useMemo(() => MESES_BR_SHORT.map((mesNome, index) => ({
    mes: mesNome,
    valor: (data?.sellIn ?? []).filter((row) => Number(row.ano) === ano && Number(row.mes) === index + 1).reduce((total, row) => total + Number(row.valor), 0),
  })), [data?.sellIn, ano]);

  const produtoOpcoes = useMemo(() => Array.from(new Set((data?.pendencias ?? []).map((item) => item.produto))).sort((a, b) => a.localeCompare(b, "pt-BR")).map((value) => ({ value, label: value })), [data?.pendencias]);
  const empresaOpcoes = useMemo(() => Array.from(new Set((data?.pendencias ?? []).map((item) => item.empresa))).sort().map((value) => ({ value, label: value })), [data?.pendencias]);
  const pendencias = useMemo(() => (data?.pendencias ?? []).filter((item) => produtoFiltro.length === 0 || produtoFiltro.includes(item.produto)).filter((item) => empresaFiltro.length === 0 || empresaFiltro.includes(item.empresa)).sort((a, b) => a.produto.localeCompare(b.produto, "pt-BR")), [data?.pendencias, produtoFiltro, empresaFiltro]);
  const totalAno = chartData.reduce((total, item) => total + item.valor, 0);
  const mesesAtivos = chartData.filter((item) => item.valor > 0).length;
  const mediaAno = mesesAtivos ? totalAno / mesesAtivos : 0;
  const totalQuantidade = pendencias.reduce((total, item) => total + Number(item.quantidade), 0);
  const totalValor = pendencias.reduce((total, item) => total + Number(item.valor), 0);

  function exportar() {
    const clienteNome = data?.cliente?.nome ?? "cliente";
    exportToExcel(pendencias.map((item) => ({
      Empresa: item.empresa,
      "Nº Pedido": item.numero_pedido ?? "",
      "Data de Emissão": item.data_emissao ? formatDateBR(item.data_emissao) : "",
      "Previsão de Entrega": item.data_entrega ? formatDateBR(item.data_entrega) : "",
      "Código do Produto": item.codigo_produto ?? "",
      Produto: item.produto,
      "Preço Unitário": Number(item.preco_unitario),
      Operação: Number(item.preco_unitario) > 0 ? "Venda" : "Bonificação",
      Quantidade: Number(item.quantidade),
      Valor: Number(item.valor),
    })), `imec-pendencias-${clienteNome}.xlsx`, "Pendências");
  }

  return (
    <div className="p-5 sm:p-8 max-w-[1500px] mx-auto">
      <Link to="/imec/por-clientes" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
      <header className="mb-6 flex items-end justify-between gap-3 flex-wrap">
        <div><div className="bi-stat-label">Cliente · BI IMEC</div><h1 className="font-display text-3xl font-bold mt-1">{data?.cliente?.nome ?? "Cliente"}</h1></div>
        <select value={ano} onChange={(event) => setAno(Number(event.target.value))} className="h-10 px-3 bg-input border border-border rounded-md" aria-label="Ano do Sell In">{anos.map((value) => <option key={value} value={value}>{value}</option>)}</select>
      </header>

      <section className="bi-card overflow-hidden mb-8">
        <header className="px-6 py-4 border-b border-border">
          <h2 className="font-display text-lg font-semibold">Sell In · {ano}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Evolução mensal consolidada de IMEC e Nutivit.</p>
        </header>
        <div className="overflow-x-auto">
          <table className="bi-table">
            <thead>
              <tr>{MESES_BR_SHORT.map((m) => <th key={m} className="text-right">{m}</th>)}<th className="text-right">Total</th><th className="text-right">Média</th></tr>
            </thead>
            <tbody>
              <tr>
                {chartData.map((item, index) => <td key={index} className="text-right tabular-nums text-xs">{item.valor ? formatBRL(item.valor) : "—"}</td>)}
                <td className="text-right tabular-nums font-semibold text-primary">{formatBRL(totalAno)}</td>
                <td className="text-right tabular-nums font-semibold">{formatBRL(mediaAno)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 border-t border-border" style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 10, right: 20, left: 20, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" /><XAxis dataKey="mes" stroke="var(--color-muted-foreground)" fontSize={12} /><YAxis stroke="var(--color-muted-foreground)" fontSize={12} width={60} tickFormatter={(value) => formatBRL(Number(value))} /><Tooltip formatter={(value) => formatBRL(Number(value))} contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 6 }} /><Line type="monotone" dataKey="valor" name="Sell In" stroke="var(--primary)" strokeWidth={3} dot={{ fill: "var(--primary)", r: 4 }} activeDot={{ r: 6 }} /></LineChart></ResponsiveContainer>
        </div>
      </section>

      <section className="bi-card overflow-hidden">
        <header className="px-6 py-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
          <div><h2 className="font-display text-lg font-semibold">Pendências em aberto</h2><p className="text-xs text-muted-foreground mt-0.5">Pedidos ainda não faturados deste cliente.</p></div>
          <div className="flex items-center gap-3 flex-wrap">
            <MultiSelect width={190} placeholder="Todas as empresas" searchPlaceholder="Buscar empresa..." options={empresaOpcoes} selected={empresaFiltro} onChange={setEmpresaFiltro} />
            <MultiSelect width={220} placeholder="Todos os produtos" searchPlaceholder="Buscar produto..." options={produtoOpcoes} selected={produtoFiltro} onChange={setProdutoFiltro} />
            <div className="text-right"><div className="bi-stat-label">Quantidade</div><div className="font-display font-bold tabular-nums">{totalQuantidade.toLocaleString("pt-BR")}</div></div>
            <div className="text-right"><div className="bi-stat-label">Valor</div><div className="font-display font-bold text-primary tabular-nums">{formatBRL(totalValor)}</div></div>
            <Button variant="secondary" onClick={exportar} disabled={pendencias.length === 0}><Download /> Excel</Button>
          </div>
        </header>
        <div className="overflow-x-auto"><table className="bi-table"><thead><tr><th>Empresa</th><th>Nº Pedido</th><th>Data Emissão</th><th>Previsão Entrega</th><th>Produto</th><th>Operação</th><th className="text-right">Preço Unit.</th><th className="text-right">Quantidade</th><th className="text-right">Valor</th></tr></thead><tbody>
          {isLoading && <tr><td colSpan={9} className="text-center text-muted-foreground py-10">Carregando…</td></tr>}
          {!isLoading && pendencias.length === 0 && <tr><td colSpan={9} className="text-center text-muted-foreground py-10">Nenhuma pendência registrada.</td></tr>}
          {pendencias.map((item) => <tr key={item.id}><td>{item.empresa}</td><td>{item.numero_pedido || "—"}</td><td>{item.data_emissao ? formatDateBR(item.data_emissao) : "—"}</td><td>{item.data_entrega ? formatDateBR(item.data_entrega) : "—"}</td><td className="font-medium">{item.produto}</td><td><span className={Number(item.preco_unitario) > 0 ? "inline-flex rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success" : "inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"}>{Number(item.preco_unitario) > 0 ? "Venda" : "Bonificação"}</span></td><td className="text-right tabular-nums">{formatBRL(Number(item.preco_unitario))}</td><td className="text-right tabular-nums">{Number(item.quantidade).toLocaleString("pt-BR")}</td><td className="text-right tabular-nums font-semibold">{formatBRL(Number(item.valor))}</td></tr>)}
        </tbody><tfoot><tr><td colSpan={7}>TOTAL</td><td className="text-right tabular-nums">{totalQuantidade.toLocaleString("pt-BR")}</td><td className="text-right tabular-nums text-primary">{formatBRL(totalValor)}</td></tr></tfoot></table></div>
      </section>
    </div>
  );
}
