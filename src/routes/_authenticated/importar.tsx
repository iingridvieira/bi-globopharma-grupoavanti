import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { readExcelFile, pickCol, rowToBRDate, rowToBRNumber, type ExcelRow } from "@/lib/excel";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/importar")({ component: ImportarPage });

type TipoImport = "metas" | "pedidos" | "notas_fiscais" | "itens_nf" | "sell_in" | "sell_out";

const TIPOS: { key: TipoImport; label: string; desc: string }[] = [
  { key: "metas", label: "Metas Mensais", desc: "Colunas: Cliente, Ano, Mes, Valor, PendenciaInicial" },
  { key: "pedidos", label: "Pedidos Enviados", desc: "Colunas: Data, Cliente, Valor" },
  { key: "notas_fiscais", label: "Notas Fiscais", desc: "Colunas: Data, Numero, Cliente, Valor, Desconto" },
  { key: "itens_nf", label: "Itens da NF", desc: "Colunas: NumeroNF, Codigo, Produto, Quantidade, ValorUnitario, ValorTotal, Desconto" },
  { key: "sell_in", label: "Sell In", desc: "Colunas: Cliente, Ano, Mes, Valor" },
  { key: "sell_out", label: "Sell Out", desc: "Colunas: Cliente, Ano, Mes, Valor" },
];

function ImportarPage() {
  const [tipo, setTipo] = useState<TipoImport>("pedidos");
  const [loading, setLoading] = useState(false);
  const [resumo, setResumo] = useState<string | null>(null);

  const { data: clientes } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => (await supabase.from("clientes").select("id,nome")).data ?? [],
  });

  function clienteIdByName(nome: string): string | null {
    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const target = norm(nome);
    return clientes?.find((c) => norm(c.nome) === target)?.id ?? null;
  }

  async function processFile(file: File) {
    setLoading(true); setResumo(null);
    try {
      const { sheets } = await readExcelFile(file);
      const firstSheet = Object.values(sheets)[0] as ExcelRow[];
      if (!firstSheet || firstSheet.length === 0) throw new Error("Planilha vazia");

      let inserted = 0;
      if (tipo === "pedidos") {
        const rows = firstSheet.map((r) => {
          const nome = String(pickCol(r, "Cliente") ?? "");
          return { data: rowToBRDate(pickCol(r, "Data")), cliente_id: clienteIdByName(nome), valor: rowToBRNumber(pickCol(r, "Valor")) };
        }).filter((r) => r.data && r.cliente_id);
        const { error } = await supabase.from("pedidos_enviados").insert(rows as never);
        if (error) throw error; inserted = rows.length;
      } else if (tipo === "metas") {
        const rows = firstSheet.map((r) => ({
          cliente_id: clienteIdByName(String(pickCol(r, "Cliente") ?? "")),
          ano: Number(pickCol(r, "Ano")), mes: Number(pickCol(r, "Mes", "Mês")),
          valor: rowToBRNumber(pickCol(r, "Valor", "Meta")),
          pendencia_inicial: rowToBRNumber(pickCol(r, "PendenciaInicial", "Pendencia Inicial") ?? 0),
        })).filter((r) => r.cliente_id && r.ano && r.mes);
        const { error } = await supabase.from("metas_mensais").upsert(rows as never, { onConflict: "cliente_id,ano,mes" });
        if (error) throw error; inserted = rows.length;
      } else if (tipo === "notas_fiscais") {
        const rows = firstSheet.map((r) => ({
          data: rowToBRDate(pickCol(r, "Data")), numero: String(pickCol(r, "Numero", "Número", "NF") ?? ""),
          cliente_id: clienteIdByName(String(pickCol(r, "Cliente") ?? "")),
          valor: rowToBRNumber(pickCol(r, "Valor", "Total")),
          desconto: rowToBRNumber(pickCol(r, "Desconto") ?? 0),
        })).filter((r) => r.data && r.cliente_id && r.numero);
        const { error } = await supabase.from("notas_fiscais").insert(rows as never);
        if (error) throw error; inserted = rows.length;
      } else if (tipo === "itens_nf") {
        // requer NF já criada
        const { data: allNf } = await supabase.from("notas_fiscais").select("id,numero");
        const nfMap = new Map((allNf ?? []).map((n) => [n.numero, n.id]));
        const rows = firstSheet.map((r) => ({
          nota_fiscal_id: nfMap.get(String(pickCol(r, "NumeroNF", "NF", "Numero") ?? "")) ?? null,
          codigo_produto: String(pickCol(r, "Codigo", "Código", "CodProduto") ?? ""),
          produto: String(pickCol(r, "Produto", "Descrição", "Descricao") ?? ""),
          quantidade: rowToBRNumber(pickCol(r, "Quantidade", "Qtd")),
          valor_unitario: rowToBRNumber(pickCol(r, "ValorUnitario", "VlrUnit", "Unitario")),
          valor_total: rowToBRNumber(pickCol(r, "ValorTotal", "Total")),
          desconto: rowToBRNumber(pickCol(r, "Desconto") ?? 0),
        })).filter((r) => r.nota_fiscal_id);
        const { error } = await supabase.from("itens_nf").insert(rows as never);
        if (error) throw error; inserted = rows.length;
      } else if (tipo === "sell_in" || tipo === "sell_out") {
        const rows = firstSheet.map((r) => ({
          cliente_id: clienteIdByName(String(pickCol(r, "Cliente") ?? "")),
          ano: Number(pickCol(r, "Ano")), mes: Number(pickCol(r, "Mes", "Mês")),
          valor: rowToBRNumber(pickCol(r, "Valor")),
        })).filter((r) => r.cliente_id && r.ano && r.mes);
        const { error } = await supabase.from(tipo).upsert(rows as never, { onConflict: "cliente_id,ano,mes" });
        if (error) throw error; inserted = rows.length;
      }
      setResumo(`${inserted} registros importados com sucesso.`);
      toast.success(`${inserted} registros importados`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro";
      toast.error(msg); setResumo(`Erro: ${msg}`);
    } finally { setLoading(false); }
  }

  return (
    <div className="p-8 max-w-[1100px] mx-auto">
      <header className="mb-6">
        <div className="bi-stat-label">Atualização de dados</div>
        <h1 className="font-display text-3xl font-bold mt-1">Importar Excel</h1>
        <p className="text-muted-foreground mt-2">Formato brasileiro (datas DD/MM/AAAA · vírgula decimal · R$).</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {TIPOS.map((t) => (
          <button key={t.key} onClick={() => setTipo(t.key)}
            className={"bi-card p-4 text-left transition-colors " + (tipo === t.key ? "border-primary bi-orange-glow" : "hover:border-primary")}>
            <div className="flex items-start gap-3">
              <FileSpreadsheet className={"h-5 w-5 " + (tipo === t.key ? "text-primary" : "text-muted-foreground")} />
              <div>
                <div className="font-display font-bold">{t.label}</div>
                <div className="text-xs text-muted-foreground mt-1">{t.desc}</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <label className="bi-card p-10 border-dashed border-2 flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors">
        <Upload className="h-10 w-10 text-primary mb-3" />
        <div className="font-display font-semibold">Clique para selecionar o arquivo .xlsx</div>
        <div className="text-xs text-muted-foreground mt-1">Tipo selecionado: {TIPOS.find((t) => t.key === tipo)?.label}</div>
        <input type="file" accept=".xlsx,.xls" className="hidden" disabled={loading}
          onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])} />
      </label>

      {loading && <div className="mt-4 text-sm text-muted-foreground">Processando…</div>}
      {resumo && <div className="mt-4 bi-card p-4 text-sm">{resumo}</div>}
    </div>
  );
}
