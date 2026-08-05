import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Upload, FileSpreadsheet } from "lucide-react";
import { lerPlanilhaImec, type ImecLinha } from "@/lib/imec-import";
import { normalizeKey } from "@/lib/cliente-mapping";

export const Route = createFileRoute("/_authenticated/imec/importar")({
  head: () => ({
    meta: [
      { title: "Importar Excel · BI IMEC" },
      { name: "description", content: "Importação de faturamento IMEC e NUTIVIT a partir de planilhas Excel." },
    ],
  }),
  component: ImecImportarPage,
});

type Empresa = "IMEC" | "NUTIVIT";

function detectarEmpresa(nomeArquivo: string): Empresa {
  return /nutivit/i.test(nomeArquivo) ? "NUTIVIT" : "IMEC";
}

function ImecImportarPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [empresa, setEmpresa] = useState<Empresa | "auto">("auto");
  const [resumo, setResumo] = useState<string | null>(null);

  if (!isAdmin) {
    return (
      <div className="p-8 max-w-xl mx-auto">
        <div className="bi-card p-8 text-center">
          <h1 className="font-display text-2xl font-bold mb-2">Acesso restrito</h1>
          <p className="text-sm text-muted-foreground">
            Apenas usuários autorizados podem importar planilhas.
          </p>
        </div>
      </div>
    );
  }

  async function processar(file: File) {
    setLoading(true);
    setResumo(null);
    try {
      const linhas = await lerPlanilhaImec(file);
      if (linhas.length === 0) throw new Error("Nenhuma linha válida encontrada na planilha.");
      const emp: Empresa = empresa === "auto" ? detectarEmpresa(file.name) : empresa;
      const txt = await gravar(linhas, emp);
      setResumo(txt);
      toast.success(txt);
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
        <div className="bi-stat-label">Atualização de dados · IMEC</div>
        <h1 className="font-display text-3xl font-bold mt-1">Importar Excel</h1>
        <p className="text-muted-foreground mt-2">
          Planilha “Itens das Notas Fiscais de Saída”. Colunas usadas: Nome, Descricao, Num. Docto.,
          Razao Social, Emissao, Quantidade, Vlr.Unitario e Vlr.Total. Os clientes são reconhecidos
          e padronizados automaticamente, como no BI Globo.
        </p>
      </header>

      <div className="bi-card p-5 mb-5 flex flex-wrap items-end gap-4">
        <label className="block">
          <span className="bi-stat-label block mb-1.5">Empresa de origem</span>
          <select
            value={empresa}
            onChange={(e) => setEmpresa(e.target.value as Empresa | "auto")}
            className="h-10 px-3 bg-input border border-border rounded-md text-sm"
          >
            <option value="auto">Detectar pelo nome do arquivo</option>
            <option value="IMEC">IMEC</option>
            <option value="NUTIVIT">NUTIVIT</option>
          </select>
        </label>
        <p className="text-xs text-muted-foreground max-w-md">
          Notas já importadas são atualizadas (mesmo número + empresa), sem duplicar registros.
        </p>
      </div>

      <label
        className={`bi-card border-2 border-dashed flex flex-col items-center justify-center gap-3 p-14 cursor-pointer transition-colors ${
          loading ? "opacity-60 pointer-events-none" : "hover:border-primary"
        }`}
      >
        <input
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void processar(f);
            e.target.value = "";
          }}
        />
        {loading ? (
          <>
            <FileSpreadsheet className="h-10 w-10 text-primary animate-pulse" />
            <span className="text-sm font-semibold">Processando planilha…</span>
          </>
        ) : (
          <>
            <Upload className="h-10 w-10 text-primary" />
            <span className="text-sm font-semibold">Clique para selecionar o arquivo .xlsx</span>
            <span className="text-xs text-muted-foreground">IMEC ou NUTIVIT</span>
          </>
        )}
      </label>

      {resumo && (
        <div className="bi-card p-5 mt-5 text-sm whitespace-pre-wrap">{resumo}</div>
      )}
    </div>
  );
}

type NFAgg = {
  numero: string;
  data: string;
  cliente_id: string;
  razao_social: string;
  valor: number;
  itens: {
    produto: string;
    ean: string | null;
    codigo_produto: string | null;
    quantidade: number;
    valor_unitario: number;
    valor_total: number;
  }[];
};

async function gravar(linhas: ImecLinha[], empresa: "IMEC" | "NUTIVIT"): Promise<string> {
  // 1) Clientes — reaproveita/cria em imec_clientes com nome padronizado
  const { data: existentes } = await supabase.from("imec_clientes").select("id,nome");
  const idx = new Map((existentes ?? []).map((c) => [normalizeKey(c.nome), c.id]));
  const novos = Array.from(
    new Set(linhas.map((l) => l.clientePadrao).filter((n) => !idx.has(normalizeKey(n)))),
  );
  if (novos.length > 0) {
    const { data: criados, error } = await supabase
      .from("imec_clientes")
      .insert(novos.map((nome) => ({ nome })))
      .select("id,nome");
    if (error) throw error;
    (criados ?? []).forEach((c) => idx.set(normalizeKey(c.nome), c.id));
  }

  // 2) Agrupa por nota fiscal
  const nfMap = new Map<string, NFAgg>();
  const sellIn = new Map<string, { cliente_id: string; empresa: string; ano: number; mes: number; valor: number }>();
  let puladas = 0;

  for (const l of linhas) {
    const cliente_id = idx.get(normalizeKey(l.clientePadrao));
    if (!cliente_id) {
      puladas++;
      continue;
    }
    let nf = nfMap.get(l.numero);
    if (!nf) {
      nf = { numero: l.numero, data: l.data, cliente_id, razao_social: l.razaoSocial, valor: 0, itens: [] };
      nfMap.set(l.numero, nf);
    }
    nf.valor += l.valorTotal;
    nf.itens.push({
      produto: l.descricao || "—",
      ean: null,
      codigo_produto: null,
      quantidade: l.quantidade,
      valor_unitario: l.valorUnitario,
      valor_total: l.valorTotal,
    });

    const d = new Date(l.data);
    const ano = d.getUTCFullYear();
    const mes = d.getUTCMonth() + 1;
    const k = `${cliente_id}|${ano}|${mes}`;
    const cur = sellIn.get(k) ?? { cliente_id, empresa, ano, mes, valor: 0 };
    cur.valor += l.valorTotal;
    sellIn.set(k, cur);
  }

  const nfs = Array.from(nfMap.values());
  if (nfs.length === 0) throw new Error("Nenhuma nota fiscal válida encontrada.");

  // 3) Upsert das NFs
  const BATCH = 500;
  const idByNumero = new Map<string, string>();
  for (let i = 0; i < nfs.length; i += BATCH) {
    const slice = nfs.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from("imec_notas_fiscais")
      .upsert(
        slice.map((n) => ({
          numero: n.numero,
          empresa,
          data: n.data,
          cliente_id: n.cliente_id,
          razao_social: n.razao_social,
          valor: n.valor,
        })) as never,
        { onConflict: "numero,empresa" },
      )
      .select("id,numero");
    if (error) throw new Error(`Notas fiscais: ${error.message}`);
    (data ?? []).forEach((n) => idByNumero.set(n.numero, n.id));
  }

  // 4) Substitui itens das NFs reimportadas
  const nfIds = Array.from(idByNumero.values());
  for (let i = 0; i < nfIds.length; i += BATCH) {
    await supabase.from("imec_itens_nf").delete().in("nota_fiscal_id", nfIds.slice(i, i + BATCH));
  }
  const itens: unknown[] = [];
  for (const n of nfs) {
    const nfId = idByNumero.get(n.numero);
    if (!nfId) continue;
    for (const it of n.itens) itens.push({ nota_fiscal_id: nfId, ...it });
  }
  for (let i = 0; i < itens.length; i += 1000) {
    const { error } = await supabase.from("imec_itens_nf").insert(itens.slice(i, i + 1000) as never);
    if (error) throw new Error(`Itens: ${error.message}`);
  }

  // 5) Sell In consolidado
  const sellRows = Array.from(sellIn.values());
  if (sellRows.length > 0) {
    const { error } = await supabase
      .from("imec_sell_in")
      .upsert(sellRows as never, { onConflict: "cliente_id,empresa,ano,mes" });
    if (error) throw new Error(`Sell In: ${error.message}`);
  }

  return [
    `${nfs.length} notas fiscais (${empresa}) importadas/atualizadas.`,
    `${itens.length} itens gravados.`,
    `${sellRows.length} períodos de Sell In consolidados.`,
    novos.length > 0 ? `${novos.length} clientes novos cadastrados.` : null,
    puladas > 0 ? `${puladas} linhas ignoradas.` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
