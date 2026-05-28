import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { readExcelFile, pickCol, rowToBRDate, rowToBRNumber, type ExcelRow } from "@/lib/excel";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { buildClienteIndex, clienteIdFromRazao, normalizeKey } from "@/lib/cliente-mapping";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/importar")({ component: ImportarPage });

type TipoImport = "faturamento" | "metas" | "pedidos" | "sell_out";

const TIPOS: { key: TipoImport; label: string; desc: string }[] = [
  {
    key: "faturamento",
    label: "Faturamento Sell In",
    desc: "Planilha com Data Lançamento, NF, Cliente, EAN, Faturado (R$). Cria NFs + itens + sell in automaticamente.",
  },
  {
    key: "metas",
    label: "Metas Mensais",
    desc: "Colunas: Cliente, Ano, Mes, Valor, PendenciaInicial",
  },
  {
    key: "pedidos",
    label: "Pedidos Enviados",
    desc: "Colunas: DATA, CLIENTE, VALOR (também aceito colar manual)",
  },
  {
    key: "sell_out",
    label: "Sell Out",
    desc: "Aceita formato largo (1ª coluna Cliente, demais como jan/25, fev/25, …) ou longo (Cliente, Ano, Mes, Valor). Apenas períodos presentes são atualizados.",
  },
];

const MESES_MAP: Record<string, number> = {
  jan: 1,
  janeiro: 1,
  january: 1,
  fev: 2,
  fevereiro: 2,
  feb: 2,
  february: 2,
  mar: 3,
  marco: 3,
  march: 3,
  abr: 4,
  abril: 4,
  apr: 4,
  april: 4,
  mai: 5,
  maio: 5,
  may: 5,
  jun: 6,
  junho: 6,
  june: 6,
  jul: 7,
  julho: 7,
  july: 7,
  ago: 8,
  agosto: 8,
  aug: 8,
  august: 8,
  set: 9,
  setembro: 9,
  sep: 9,
  september: 9,
  out: 10,
  outubro: 10,
  oct: 10,
  october: 10,
  nov: 11,
  novembro: 11,
  november: 11,
  dez: 12,
  dezembro: 12,
  dec: 12,
  december: 12,
};

function parseMesAno(header: unknown): { mes: number; ano: number } | null {
  // Suporta cabeçalho Date (planilhas onde "jan/25" é formatação de uma data real).
  if (header instanceof Date && !Number.isNaN(header.getTime())) {
    return { mes: header.getUTCMonth() + 1, ano: header.getUTCFullYear() };
  }
  // Suporta serial Excel (número) — converte para Date.
  if (typeof header === "number" && header > 10000 && header < 100000) {
    const d = new Date(Math.round((header - 25569) * 86400 * 1000));
    if (!Number.isNaN(d.getTime())) return { mes: d.getUTCMonth() + 1, ano: d.getUTCFullYear() };
  }
  const raw = String(header ?? "").trim();
  const serial = Number(raw.replace(",", "."));
  if (Number.isFinite(serial) && serial > 10000 && serial < 100000) {
    const d = new Date(Math.round((serial - 25569) * 86400 * 1000));
    if (!Number.isNaN(d.getTime())) return { mes: d.getUTCMonth() + 1, ano: d.getUTCFullYear() };
  }
  const s = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  // jan/25, janeiro/2025, fevereiro de 2026, feb 2026, etc.
  const monthNames = Object.keys(MESES_MAP)
    .sort((a, b) => b.length - a.length)
    .join("|");
  const m = s.match(
    new RegExp(`\\b(${monthNames})\\b(?:\\s*(?:de|do|da)\\s*|[\\s/_.-]+)(\\d{2,4})\\b`),
  );
  if (m) {
    const mes = MESES_MAP[m[1]];
    let ano = Number(m[2]);
    if (ano < 100) ano += 2000;
    return { mes, ano };
  }
  // MM/YYYY, MM-YY, YYYY/MM, YYYY-MM
  const mesAno = s.match(/^(\d{1,2})[/_.-](\d{2,4})$/);
  if (mesAno) {
    const mes = Number(mesAno[1]);
    let ano = Number(mesAno[2]);
    if (ano < 100) ano += 2000;
    if (mes >= 1 && mes <= 12) return { mes, ano };
  }
  const anoMes = s.match(/^(\d{4})[/_.-](\d{1,2})$/);
  if (anoMes) {
    const mes = Number(anoMes[2]);
    if (mes >= 1 && mes <= 12) return { mes, ano: Number(anoMes[1]) };
  }
  // ISO ou DD/MM/YYYY dentro do header
  const iso = raw.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
  if (iso) return { mes: Number(iso[2]), ano: Number(iso[1]) };
  const br = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (br) {
    let ano = Number(br[3]);
    if (ano < 100) ano += 2000;
    return { mes: Number(br[2]), ano };
  }
  return null;
}

function ImportarPage() {
  const { canEdit } = useAuth();
  const [tipo, setTipo] = useState<TipoImport>("faturamento");
  const [loading, setLoading] = useState(false);
  const [resumo, setResumo] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: clientes } = useQuery({
    queryKey: ["clientes-all"],
    queryFn: async () => (await supabase.from("clientes").select("id,nome")).data ?? [],
    enabled: canEdit,
  });

  if (!canEdit) {
    return (
      <div className="p-8 max-w-xl mx-auto">
        <div className="bi-card p-8 text-center">
          <h1 className="font-display text-2xl font-bold mb-2">Acesso restrito</h1>
          <p className="text-sm text-muted-foreground">
            Apenas o usuário autorizado pode importar planilhas neste sistema.
          </p>
        </div>
      </div>
    );
  }

  async function processFile(file: File) {
    setLoading(true);
    setResumo(null);
    try {
      const { sheets } = await readExcelFile(file);
      const firstSheet = Object.values(sheets)[0] as ExcelRow[];
      if (!firstSheet || firstSheet.length === 0) throw new Error("Planilha vazia");

      const idx = buildClienteIndex(clientes ?? []);
      let resumoTxt = "";

      if (tipo === "faturamento") {
        resumoTxt = await processFaturamento(firstSheet, idx);
      } else if (tipo === "pedidos") {
        const rows = firstSheet
          .map((r) => {
            const nome = String(pickCol(r, "Cliente", "CLIENTE") ?? "");
            return {
              data: rowToBRDate(pickCol(r, "Data", "DATA")),
              cliente_id: clienteIdFromRazao(nome, idx),
              valor: rowToBRNumber(pickCol(r, "Valor", "VALOR")),
            };
          })
          .filter((r) => r.data && r.cliente_id && r.valor > 0);
        const { error, count } = await supabase.from("pedidos_enviados").upsert(rows as never, {
          onConflict: "data,cliente_id,valor",
          ignoreDuplicates: true,
          count: "exact",
        });
        if (error) throw error;
        resumoTxt = `${count ?? rows.length} pedidos processados (duplicados ignorados).`;
      } else if (tipo === "metas") {
        const rows = firstSheet
          .map((r) => ({
            cliente_id: clienteIdFromRazao(String(pickCol(r, "Cliente") ?? ""), idx),
            ano: Number(pickCol(r, "Ano")),
            mes: Number(pickCol(r, "Mes", "Mês")),
            valor: rowToBRNumber(pickCol(r, "Valor", "Meta")),
            pendencia_inicial: rowToBRNumber(
              pickCol(r, "PendenciaInicial", "Pendencia Inicial") ?? 0,
            ),
          }))
          .filter((r) => r.cliente_id && r.ano && r.mes);
        const { error } = await supabase
          .from("metas_mensais")
          .upsert(rows as never, { onConflict: "cliente_id,ano,mes" });
        if (error) throw error;
        resumoTxt = `${rows.length} metas importadas.`;
      } else if (tipo === "sell_out") {
        const headers = Object.keys(firstSheet[0] ?? {});
        const wideCols = headers
          .map((h) => ({ h, parsed: parseMesAno(h) }))
          .filter((x) => x.parsed) as { h: string; parsed: { mes: number; ano: number } }[];

        type SellOutRow = { cliente_id: string; ano: number; mes: number; valor: number };
        const rows: SellOutRow[] = [];

        if (wideCols.length > 0) {
          // Formato largo: 1ª coluna = nome do cliente, demais = jan/25, fev/25...
          const clienteCol = headers.find((h) => !parseMesAno(h)) ?? headers[0];
          for (const r of firstSheet) {
            const nome = String(r[clienteCol] ?? "").trim();
            if (!nome) continue;
            const cliente_id = idx.get(normalizeKey(nome)) ?? clienteIdFromRazao(nome, idx);
            if (!cliente_id) continue;
            for (const { h, parsed } of wideCols) {
              const valor = rowToBRNumber(r[h]);
              if (!valor) continue;
              rows.push({ cliente_id, ano: parsed.ano, mes: parsed.mes, valor });
            }
          }
        } else {
          // Formato longo: Cliente, Ano, Mes, Valor
          for (const r of firstSheet) {
            const cliente_id = clienteIdFromRazao(String(pickCol(r, "Cliente") ?? ""), idx);
            const ano = Number(pickCol(r, "Ano"));
            const mes = Number(pickCol(r, "Mes", "Mês"));
            const valor = rowToBRNumber(pickCol(r, "Valor"));
            if (cliente_id && ano && mes) rows.push({ cliente_id, ano, mes, valor });
          }
        }

        if (rows.length === 0) throw new Error("Nenhuma linha válida encontrada na planilha.");
        const { error } = await supabase
          .from("sell_out")
          .upsert(rows as never, { onConflict: "cliente_id,ano,mes" });
        if (error) throw error;
        resumoTxt = `${rows.length} registros sell out atualizados (períodos não presentes no arquivo foram preservados).`;
      }
      setResumo(resumoTxt);
      toast.success(resumoTxt);
      await qc.invalidateQueries();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro";
      toast.error(msg);
      setResumo(`Erro: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-[1100px] mx-auto">
      <header className="mb-6">
        <div className="bi-stat-label">Atualização de dados</div>
        <h1 className="font-display text-3xl font-bold mt-1">Importar Excel</h1>
        <p className="text-muted-foreground mt-2">
          Padrão brasileiro · datas DD/MM/AAAA · vírgula decimal · R$. Cruzamento automático de
          clientes.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        {TIPOS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTipo(t.key)}
            className={
              "bi-card p-4 text-left transition-colors " +
              (tipo === t.key ? "border-primary bi-orange-glow" : "hover:border-primary")
            }
          >
            <div className="flex items-start gap-3">
              <FileSpreadsheet
                className={
                  "h-5 w-5 mt-0.5 " + (tipo === t.key ? "text-primary" : "text-muted-foreground")
                }
              />
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
        <div className="text-xs text-muted-foreground mt-1">
          Tipo selecionado: {TIPOS.find((t) => t.key === tipo)?.label}
        </div>
        <input
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          disabled={loading}
          onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
        />
      </label>

      {loading && <div className="mt-4 text-sm text-muted-foreground">Processando…</div>}
      {resumo && <div className="mt-4 bi-card p-4 text-sm">{resumo}</div>}
    </div>
  );
}

/**
 * Processa planilha de faturamento Sell In (formato padrão BI GLOBO PHARMA):
 * Colunas esperadas: Data de Lançamento, Número Documento, Número de Ref. do Cliente,
 * Número da NF, Código do PN, Cliente, CNPJ, Descrição, EAN, Nitro (S/N), MÊS/ANO,
 * Utilização, Faturado (VOL), Faturado (R$).
 *
 * Apenas Número da NF, Data, Cliente e Faturado (R$) são obrigatórios — demais são opcionais.
 * Agrupa linhas por NF, recria itens, e agrega sell_in por cliente x ano-mês.
 */
async function processFaturamento(rows: ExcelRow[], idx: Map<string, string>): Promise<string> {
  type NFAgg = {
    numero: string;
    data: string;
    cliente_id: string;
    total: number;
    itens: Array<{
      codigo_produto: string;
      produto: string;
      quantidade: number;
      valor_unitario: number;
      valor_total: number;
    }>;
  };
  const nfMap = new Map<string, NFAgg>();
  const sellInAgg = new Map<
    string,
    { cliente_id: string; ano: number; mes: number; valor: number }
  >();
  let puladas = 0;

  for (const r of rows) {
    const numero = String(
      pickCol(r, "Número da NF", "Numero da NF", "NF", "Número NF", "Num NF") ?? "",
    ).trim();
    const dataISO = rowToBRDate(
      pickCol(
        r,
        "Data de Lançamento",
        "Data Lançamento",
        "Data de Lancamento",
        "Data Lancamento",
        "Data",
      ),
    );
    const rs = String(pickCol(r, "Cliente", "Razão Social", "Razao Social") ?? "").trim();
    const valor = rowToBRNumber(
      pickCol(r, "Faturado (R$)", "Faturado R$", "Faturado RS", "Faturado", "Valor"),
    );
    const qtd = rowToBRNumber(
      pickCol(r, "Faturado (VOL)", "Faturado VOL", "Quantidade", "Qtd", "VOL"),
    );
    const cod = String(pickCol(r, "Código do PN", "Codigo do PN", "Cod PN", "EAN") ?? "").trim();
    const desc = String(pickCol(r, "Descrição", "Descricao", "Produto") ?? "").trim();

    if (!numero || !dataISO || !rs) {
      puladas++;
      continue;
    }
    const cliente_id = clienteIdFromRazao(rs, idx);
    if (!cliente_id) {
      puladas++;
      continue;
    }

    let agg = nfMap.get(numero);
    if (!agg) {
      agg = { numero, data: dataISO, cliente_id, total: 0, itens: [] };
      nfMap.set(numero, agg);
    }
    agg.total += valor;
    agg.itens.push({
      codigo_produto: cod,
      produto: desc,
      quantidade: qtd,
      valor_unitario: qtd > 0 ? valor / qtd : valor,
      valor_total: valor,
    });

    const d = new Date(dataISO);
    const ano = d.getUTCFullYear();
    const mes = d.getUTCMonth() + 1;
    const k = `${cliente_id}|${ano}|${mes}`;
    const cur = sellInAgg.get(k) ?? { cliente_id, ano, mes, valor: 0 };
    cur.valor += valor;
    sellInAgg.set(k, cur);
  }

  const nfsArr = Array.from(nfMap.values());
  if (nfsArr.length === 0) {
    return `Nenhuma NF válida encontrada. ${puladas} linhas puladas (verifique colunas Data, NF, Cliente).`;
  }

  // Upsert NFs em lotes de 500
  const BATCH = 500;
  const idByNumero = new Map<string, string>();
  for (let i = 0; i < nfsArr.length; i += BATCH) {
    const slice = nfsArr.slice(i, i + BATCH);
    const { data: nfsRet, error: nfErr } = await supabase
      .from("notas_fiscais")
      .upsert(
        slice.map((n) => ({
          numero: n.numero,
          data: n.data,
          cliente_id: n.cliente_id,
          valor: n.total,
        })) as never,
        { onConflict: "numero" },
      )
      .select("id,numero");
    if (nfErr) throw new Error(`NFs lote ${i / BATCH + 1}: ${nfErr.message}`);
    (nfsRet ?? []).forEach((n) => idByNumero.set(n.numero, n.id));
  }

  // Limpa itens antigos das NFs reimportadas (em lotes)
  const allNfIds = Array.from(idByNumero.values()).filter(Boolean) as string[];
  for (let i = 0; i < allNfIds.length; i += BATCH) {
    await supabase
      .from("itens_nf")
      .delete()
      .in("nota_fiscal_id", allNfIds.slice(i, i + BATCH));
  }

  // Insere itens em lotes
  const itensRows: unknown[] = [];
  for (const n of nfsArr) {
    const nfId = idByNumero.get(n.numero);
    if (!nfId) continue;
    for (const it of n.itens) itensRows.push({ nota_fiscal_id: nfId, ...it, desconto: 0 });
  }
  for (let i = 0; i < itensRows.length; i += BATCH) {
    const { error } = await supabase
      .from("itens_nf")
      .insert(itensRows.slice(i, i + BATCH) as never);
    if (error) throw new Error(`Itens lote ${i / BATCH + 1}: ${error.message}`);
  }

  // Recalcula sell_in a partir de TODAS as NFs do banco nos períodos afetados
  // (preserva dados já existentes que não estão no arquivo importado).
  const periodos = new Map<string, { cliente_id: string; ano: number; mes: number }>();
  for (const s of sellInAgg.values()) periodos.set(`${s.cliente_id}|${s.ano}|${s.mes}`, s);

  const clienteIdsAfetados = Array.from(
    new Set(Array.from(periodos.values()).map((p) => p.cliente_id)),
  );
  const anosAfetados = Array.from(new Set(Array.from(periodos.values()).map((p) => p.ano)));

  const sellInRecalc: { cliente_id: string; ano: number; mes: number; valor: number }[] = [];
  if (clienteIdsAfetados.length > 0 && anosAfetados.length > 0) {
    const minAno = Math.min(...anosAfetados);
    const maxAno = Math.max(...anosAfetados);
    const start = `${minAno}-01-01`;
    const end = `${maxAno}-12-31`;

    const { data: nfsBanco, error: qErr } = await supabase
      .from("notas_fiscais")
      .select("cliente_id,data,valor")
      .in("cliente_id", clienteIdsAfetados)
      .gte("data", start)
      .lte("data", end);
    if (qErr) throw new Error(`Recalcular sell_in: ${qErr.message}`);

    const totais = new Map<
      string,
      { cliente_id: string; ano: number; mes: number; valor: number }
    >();
    (nfsBanco ?? []).forEach((n) => {
      const d = new Date(n.data as string);
      const ano = d.getUTCFullYear();
      const mes = d.getUTCMonth() + 1;
      const k = `${n.cliente_id}|${ano}|${mes}`;
      if (!periodos.has(k)) return; // só recalcula períodos do arquivo importado
      const cur = totais.get(k) ?? { cliente_id: n.cliente_id as string, ano, mes, valor: 0 };
      cur.valor += Number(n.valor);
      totais.set(k, cur);
    });
    sellInRecalc.push(...totais.values());
  }

  for (let i = 0; i < sellInRecalc.length; i += BATCH) {
    const { error } = await supabase
      .from("sell_in")
      .upsert(sellInRecalc.slice(i, i + BATCH) as never, { onConflict: "cliente_id,ano,mes" });
    if (error) throw new Error(`Sell In lote ${i / BATCH + 1}: ${error.message}`);
  }

  void normalizeKey;

  const aviso = puladas > 0 ? ` · ${puladas} linhas ignoradas` : "";
  return `${nfsArr.length} NFs · ${itensRows.length} itens · ${sellInRecalc.length} períodos sell in recalculados (dados existentes preservados)${aviso}.`;
}
