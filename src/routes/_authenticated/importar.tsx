import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { readExcelFile, pickCol, rowToBRDate, rowToBRNumber, type ExcelRow } from "@/lib/excel";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { buildClienteIndex, clienteIdFromRazao, normalizeKey } from "@/lib/cliente-mapping";

export const Route = createFileRoute("/_authenticated/importar")({ component: ImportarPage });

type TipoImport = "faturamento" | "metas" | "pedidos" | "sell_out";

const TIPOS: { key: TipoImport; label: string; desc: string }[] = [
  { key: "faturamento", label: "Faturamento Sell In", desc: "Planilha com Data Lançamento, NF, Cliente, EAN, Faturado (R$). Cria NFs + itens + sell in automaticamente." },
  { key: "metas", label: "Metas Mensais", desc: "Colunas: Cliente, Ano, Mes, Valor, PendenciaInicial" },
  { key: "pedidos", label: "Pedidos Enviados", desc: "Colunas: DATA, CLIENTE, VALOR (também aceito colar manual)" },
  { key: "sell_out", label: "Sell Out (manual)", desc: "Colunas: Cliente, Ano, Mes, Valor" },
];

function ImportarPage() {
  const [tipo, setTipo] = useState<TipoImport>("faturamento");
  const [loading, setLoading] = useState(false);
  const [resumo, setResumo] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: clientes } = useQuery({
    queryKey: ["clientes-all"],
    queryFn: async () => (await supabase.from("clientes").select("id,nome")).data ?? [],
  });

  async function processFile(file: File) {
    setLoading(true); setResumo(null);
    try {
      const { sheets } = await readExcelFile(file);
      const firstSheet = Object.values(sheets)[0] as ExcelRow[];
      if (!firstSheet || firstSheet.length === 0) throw new Error("Planilha vazia");

      const idx = buildClienteIndex(clientes ?? []);
      let resumoTxt = "";

      if (tipo === "faturamento") {
        resumoTxt = await processFaturamento(firstSheet, idx);
      } else if (tipo === "pedidos") {
        const rows = firstSheet.map((r) => {
          const nome = String(pickCol(r, "Cliente", "CLIENTE") ?? "");
          return {
            data: rowToBRDate(pickCol(r, "Data", "DATA")),
            cliente_id: clienteIdFromRazao(nome, idx),
            valor: rowToBRNumber(pickCol(r, "Valor", "VALOR")),
          };
        }).filter((r) => r.data && r.cliente_id && r.valor > 0);
        const { error, count } = await supabase.from("pedidos_enviados").upsert(rows as never, { onConflict: "data,cliente_id,valor", ignoreDuplicates: true, count: "exact" });
        if (error) throw error;
        resumoTxt = `${count ?? rows.length} pedidos processados (duplicados ignorados).`;
      } else if (tipo === "metas") {
        const rows = firstSheet.map((r) => ({
          cliente_id: clienteIdFromRazao(String(pickCol(r, "Cliente") ?? ""), idx),
          ano: Number(pickCol(r, "Ano")), mes: Number(pickCol(r, "Mes", "Mês")),
          valor: rowToBRNumber(pickCol(r, "Valor", "Meta")),
          pendencia_inicial: rowToBRNumber(pickCol(r, "PendenciaInicial", "Pendencia Inicial") ?? 0),
        })).filter((r) => r.cliente_id && r.ano && r.mes);
        const { error } = await supabase.from("metas_mensais").upsert(rows as never, { onConflict: "cliente_id,ano,mes" });
        if (error) throw error;
        resumoTxt = `${rows.length} metas importadas.`;
      } else if (tipo === "sell_out") {
        const rows = firstSheet.map((r) => ({
          cliente_id: clienteIdFromRazao(String(pickCol(r, "Cliente") ?? ""), idx),
          ano: Number(pickCol(r, "Ano")), mes: Number(pickCol(r, "Mes", "Mês")),
          valor: rowToBRNumber(pickCol(r, "Valor")),
        })).filter((r) => r.cliente_id && r.ano && r.mes);
        const { error } = await supabase.from("sell_out").upsert(rows as never, { onConflict: "cliente_id,ano,mes" });
        if (error) throw error;
        resumoTxt = `${rows.length} registros sell out importados.`;
      }
      setResumo(resumoTxt);
      toast.success(resumoTxt);
      await qc.invalidateQueries();
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
        <p className="text-muted-foreground mt-2">Padrão brasileiro · datas DD/MM/AAAA · vírgula decimal · R$. Cruzamento automático de clientes.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        {TIPOS.map((t) => (
          <button key={t.key} onClick={() => setTipo(t.key)}
            className={"bi-card p-4 text-left transition-colors " + (tipo === t.key ? "border-primary bi-orange-glow" : "hover:border-primary")}>
            <div className="flex items-start gap-3">
              <FileSpreadsheet className={"h-5 w-5 mt-0.5 " + (tipo === t.key ? "text-primary" : "text-muted-foreground")} />
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

/**
 * Processa planilha de faturamento Sell In:
 * - Agrupa linhas por Número da NF
 * - Cria/upserta `notas_fiscais` (uma por NF) com cliente padronizado
 * - Insere `itens_nf` (uma linha por produto)
 * - Recalcula agregados `sell_in` por cliente x ano-mês
 */
async function processFaturamento(rows: ExcelRow[], idx: Map<string, string>): Promise<string> {
  type NFAgg = {
    numero: string; data: string; cliente_id: string; total: number;
    itens: Array<{ codigo_produto: string; produto: string; quantidade: number; valor_unitario: number; valor_total: number }>;
  };
  const nfMap = new Map<string, NFAgg>();
  const sellInAgg = new Map<string, { cliente_id: string; ano: number; mes: number; valor: number }>();

  for (const r of rows) {
    const numero = String(pickCol(r, "Número da NF", "Numero da NF", "NF", "Número NF") ?? "").trim();
    const dataISO = rowToBRDate(pickCol(r, "Data de Lançamento", "Data Lançamento", "Data"));
    const rs = String(pickCol(r, "Cliente") ?? "");
    const cliente_id = clienteIdFromRazao(rs, idx);
    const valor = rowToBRNumber(pickCol(r, "Faturado (R$)", "Faturado R$", "Faturado"));
    const qtd = rowToBRNumber(pickCol(r, "Faturado (VOL)", "Faturado VOL", "Quantidade"));
    const cod = String(pickCol(r, "Código do PN", "Codigo do PN", "EAN") ?? "");
    const desc = String(pickCol(r, "Descrição", "Descricao") ?? "");

    if (!numero || !dataISO || !cliente_id) continue;

    let agg = nfMap.get(numero);
    if (!agg) {
      agg = { numero, data: dataISO, cliente_id, total: 0, itens: [] };
      nfMap.set(numero, agg);
    }
    agg.total += valor;
    agg.itens.push({
      codigo_produto: cod, produto: desc,
      quantidade: qtd, valor_unitario: qtd > 0 ? valor / qtd : valor, valor_total: valor,
    });

    const d = new Date(dataISO);
    const ano = d.getUTCFullYear(); const mes = d.getUTCMonth() + 1;
    const k = `${cliente_id}|${ano}|${mes}`;
    const cur = sellInAgg.get(k) ?? { cliente_id, ano, mes, valor: 0 };
    cur.valor += valor;
    sellInAgg.set(k, cur);
  }

  // Upsert NFs (numero é chave única) — captura ids existentes vs novos
  const nfsArr = Array.from(nfMap.values());
  const { data: nfsRet, error: nfErr } = await supabase.from("notas_fiscais").upsert(
    nfsArr.map((n) => ({ numero: n.numero, data: n.data, cliente_id: n.cliente_id, valor: n.total })) as never,
    { onConflict: "numero" }
  ).select("id,numero");
  if (nfErr) throw nfErr;

  const idByNumero = new Map((nfsRet ?? []).map((n) => [n.numero, n.id]));

  // Re-cria itens (limpa para evitar duplicação em re-import)
  const allNfIds = Array.from(idByNumero.values()).filter(Boolean) as string[];
  if (allNfIds.length > 0) {
    await supabase.from("itens_nf").delete().in("nota_fiscal_id", allNfIds);
  }

  const itensRows: unknown[] = [];
  for (const n of nfsArr) {
    const nfId = idByNumero.get(n.numero);
    if (!nfId) continue;
    for (const it of n.itens) {
      itensRows.push({ nota_fiscal_id: nfId, ...it, desconto: 0 });
    }
  }
  if (itensRows.length > 0) {
    const { error } = await supabase.from("itens_nf").insert(itensRows as never);
    if (error) throw error;
  }

  // Upsert sell_in agregado
  const sellArr = Array.from(sellInAgg.values());
  if (sellArr.length > 0) {
    const { error } = await supabase.from("sell_in").upsert(sellArr as never, { onConflict: "cliente_id,ano,mes" });
    if (error) throw error;
  }

  // discard normalizeKey usage warning
  void normalizeKey;

  return `${nfsArr.length} NFs processadas · ${itensRows.length} itens · ${sellArr.length} agregados sell in atualizados.`;
}
