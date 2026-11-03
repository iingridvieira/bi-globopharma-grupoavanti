import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Upload, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatBRL } from "@/lib/format";
import { readExcelFile, pickCol, rowToBRNumber } from "@/lib/excel";
import { UltimaAtualizacao } from "@/components/UltimaAtualizacao";

export const Route = createFileRoute("/_authenticated/navarro")({
  head: () => ({
    meta: [
      { title: "Grupo Navarro · Evolução Sell In e Sell Out" },
      { name: "description", content: "Resultados do Grupo Navarro por regional: Sell In e Sell Out mensais." },
    ],
  }),
  component: NavarroPage,
});

type Regional = "SP" | "RJ" | "MG" | "ES" | "PR";
type Tipo = "sell_in" | "sell_out";
const REGIONAIS: { id: Regional; nome: string; rep: string; siRow: number; soRow: number }[] = [
  { id: "SP", nome: "NAVARRO SP", rep: "SP + INTER", siRow: 23, soRow: 31 },
  { id: "RJ", nome: "NAVARRO RJ", rep: "Jéssica", siRow: 39, soRow: 47 },
  { id: "MG", nome: "NAVARRO MG", rep: "Victor", siRow: 55, soRow: 63 },
  { id: "ES", nome: "NAVARRO ES", rep: "Cleber", siRow: 71, soRow: 79 },
  { id: "PR", nome: "NAVARRO PR - SC", rep: "Suellen", siRow: 87, soRow: 95 },
];
const VENDEDOR_REGIONAL: Record<string, Regional> = {
  "PAULO COLELLA": "SP", JESSICA: "RJ", "JÉSSICA": "RJ", VICTOR: "MG", CLEBER: "ES", SUELLEN: "PR",
};
const MESES = ["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];
const MES_ABREV: Record<string, number> = { jan:1,fev:2,mar:3,abr:4,mai:5,jun:6,jul:7,ago:8,set:9,out:10,nov:11,dez:12 };

type Row = { regional: Regional; tipo: Tipo; ano: number; mes: number; valor: number };
type Mat = Record<number, number[]>; // ano -> 12 valores

const key = (r: Regional, t: Tipo) => `${r}|${t}`;

function useDados() {
  return useQuery({
    queryKey: ["navarro-evolucao"],
    queryFn: async () => {
      const { data, error } = await supabase.from("navarro_evolucao").select("regional,tipo,ano,mes,valor");
      if (error) throw error;
      return (data ?? []).map((d) => ({ ...d, valor: Number(d.valor) })) as Row[];
    },
  });
}

/** Divisor da média: 12 para anos fechados; no ano corrente, meses até o último com valor. */
function divisores(rows: Row[], anos: number[]): Record<number, number> {
  const atual = Math.max(...anos);
  const ult = Math.max(0, ...rows.filter((r) => r.ano === atual && r.valor !== 0).map((r) => r.mes));
  return Object.fromEntries(anos.map((a) => [a, a === atual ? Math.max(ult, 1) : 12]));
}

function NavarroPage() {
  const { canEdit } = useAuth();
  const qc = useQueryClient();
  const { data: rows = [] } = useDados();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const anoAtual = new Date().getFullYear();
  const anos = Array.from(new Set([2022, 2023, 2024, 2025, anoAtual, ...rows.map((r) => r.ano)])).sort();
  const div = divisores(rows, anos);

  const mats: Record<string, Mat> = {};
  for (const reg of REGIONAIS) for (const t of ["sell_in", "sell_out"] as Tipo[]) {
    const m: Mat = {};
    anos.forEach((a) => (m[a] = Array(12).fill(0)));
    mats[key(reg.id, t)] = m;
  }
  rows.forEach((r) => {
    const m = mats[key(r.regional, r.tipo)];
    if (m?.[r.ano]) m[r.ano][r.mes - 1] = r.valor;
  });
  const grupo = (t: Tipo): Mat => {
    const m: Mat = {};
    anos.forEach((a) => (m[a] = Array.from({ length: 12 }, (_, i) =>
      REGIONAIS.reduce((s, r) => s + mats[key(r.id, t)][a][i], 0))));
    return m;
  };
  const grupoSI = grupo("sell_in");
  const grupoSO = grupo("sell_out");

  async function salvar(regional: Regional, tipo: Tipo, ano: number, mes: number, valor: number) {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("navarro_evolucao").upsert(
      { regional, tipo, ano, mes, valor, updated_by: u.user?.id ?? null, updated_at: new Date().toISOString() },
      { onConflict: "regional,tipo,ano,mes" },
    );
    if (error) return toast.error("Erro ao salvar: " + error.message);
    qc.invalidateQueries({ queryKey: ["navarro-evolucao"] });
    qc.invalidateQueries({ queryKey: ["ultima-atualizacao"] });
  }

  async function importarFaturamento(file: File) {
    setBusy(true);
    try {
      const { sheets } = await readExcelFile(file);
      const linhas = Object.values(sheets)[0] ?? [];
      const soma = new Map<string, number>();
      const ignorados = new Set<string>();
      for (const l of linhas) {
        const vend = String(pickCol(l, "Vendedor") ?? "").trim().toUpperCase();
        const reg = VENDEDOR_REGIONAL[vend];
        const ma = String(pickCol(l, "MÊS/ANO", "MES/ANO") ?? "").trim().toLowerCase();
        const mm = ma.match(/^([a-zç]{3})\/(\d{2,4})$/);
        if (!vend && !ma) continue;
        if (!reg) { ignorados.add(vend || "(sem vendedor)"); continue; }
        if (!mm || !MES_ABREV[mm[1]]) continue;
        const ano = mm[2].length === 2 ? 2000 + Number(mm[2]) : Number(mm[2]);
        const k = `${reg}|${ano}|${MES_ABREV[mm[1]]}`;
        soma.set(k, (soma.get(k) ?? 0) + rowToBRNumber(pickCol(l, "Faturado (R$)")));
      }
      if (soma.size === 0) throw new Error("Nenhuma linha reconhecida. Confira as colunas Vendedor, MÊS/ANO e Faturado (R$).");
      const { data: u } = await supabase.auth.getUser();
      // Meses presentes no arquivo são substituídos para todas as regionais (inclusive zerando quem não faturou).
      const mesesArquivo = new Set([...soma.keys()].map((k) => k.split("|").slice(1).join("|")));
      const payload = [...mesesArquivo].flatMap((am) => {
        const [ano, mes] = am.split("|").map(Number);
        return REGIONAIS.map((r) => ({
          regional: r.id, tipo: "sell_in" as const, ano, mes,
          valor: Math.round((soma.get(`${r.id}|${am}`) ?? 0) * 100) / 100,
          updated_by: u.user?.id ?? null, updated_at: new Date().toISOString(),
        }));
      });
      const { error } = await supabase.from("navarro_evolucao").upsert(payload, { onConflict: "regional,tipo,ano,mes" });
      if (error) throw error;
      toast.success(`Sell In atualizado em ${mesesArquivo.size} mês(es).`);
      if (ignorados.size) toast.warning(`Vendedores sem regional ignorados: ${[...ignorados].join(", ")}`);
      qc.invalidateQueries({ queryKey: ["navarro-evolucao"] });
      qc.invalidateQueries({ queryKey: ["ultima-atualizacao"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function exportar() {
    setBusy(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const buf = await (await fetch("/downloads/navarro-modelo.xlsx")).arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf);
      const ws = wb.worksheets[0];
      const anosModelo = [0, 1, 2, 3, 4].map((i) => Number(ws.getCell(23 + i, 3).value));
      for (const reg of REGIONAIS) for (const [t, start] of [["sell_in", reg.siRow], ["sell_out", reg.soRow]] as [Tipo, number][]) {
        anosModelo.forEach((ano, i) => {
          const vals = mats[key(reg.id, t)][ano] ?? Array(12).fill(0);
          vals.forEach((v, m) => (ws.getCell(start + i, 4 + m).value = v));
        });
      }
      const ultimo = anosModelo[anosModelo.length - 1];
      ws.getCell("V3").value = div[ultimo] ?? 12;
      wb.calcProperties.fullCalcOnLoad = true;
      const out = await wb.xlsx.writeBuffer();
      const blob = new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "EVOLUÇÃO_GRUPO_NAVARRO.xlsx";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e) {
      toast.error("Erro ao exportar: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-8 max-w-[1800px] mx-auto">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="bi-stat-label">Cliente</div>
          <h1 className="font-display text-3xl font-bold mt-1 flex items-center gap-2">
            <Building2 className="h-7 w-7 text-primary" /> Resultados Grupo Navarro
          </h1>
          <UltimaAtualizacao tabela="navarro_evolucao" className="mt-2" />
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={(e) => e.target.files?.[0] && importarFaturamento(e.target.files[0])} />
              <button disabled={busy} onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-accent disabled:opacity-50">
                <Upload className="h-4 w-4" /> Importar faturamento (Sell In)
              </button>
            </>
          )}
          <button disabled={busy} onClick={exportar}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
            <Download className="h-4 w-4" /> Exportar Excel
          </button>
        </div>
      </header>
      {canEdit && (
        <p className="text-xs text-muted-foreground mb-6">
          Clique em um valor das regionais para editar. O Sell In também pode ser atualizado importando a planilha de faturamento (Vendedor → regional).
        </p>
      )}

      <Bloco titulo="SELL IN GRUPO NAVARRO" rotulo="SELL IN" mat={grupoSI} anos={anos} div={div} />
      <Bloco titulo="SELL OUT GRUPO NAVARRO" rotulo="SELL OUT" mat={grupoSO} anos={anos} div={div} />
      {REGIONAIS.map((r) => (
        <div key={r.id}>
          <Bloco titulo={`SELL IN ${r.nome} (${r.rep})`} rotulo={`${r.id} SELL IN`} mat={mats[key(r.id, "sell_in")]}
            anos={anos} div={div} base={grupoSI} editavel={canEdit}
            onSave={(a, m, v) => salvar(r.id, "sell_in", a, m, v)} />
          <Bloco titulo={`SELL OUT ${r.nome}`} rotulo={`${r.id} SELL OUT`} mat={mats[key(r.id, "sell_out")]}
            anos={anos} div={div} base={grupoSO} editavel={canEdit}
            onSave={(a, m, v) => salvar(r.id, "sell_out", a, m, v)} />
        </div>
      ))}
    </div>
  );
}

const fmt = (v: number) => (v === 0 ? "-" : formatBRL(v));
const pct = (v: number | null) => (v == null || !Number.isFinite(v) ? "-" : `${(v * 100).toFixed(1).replace(".", ",")}%`);

function Bloco({ titulo, rotulo, mat, anos, div, base, editavel, onSave }: {
  titulo: string; rotulo: string; mat: Mat; anos: number[]; div: Record<number, number>;
  base?: Mat; editavel?: boolean; onSave?: (ano: number, mes: number, v: number) => void;
}) {
  const tot = (m: Mat | undefined, a: number) => (m?.[a] ?? []).reduce((s, v) => s + v, 0);
  return (
    <section className="bi-card mb-6 overflow-x-auto">
      <div className="px-4 py-2 font-display font-bold text-sm bg-primary text-primary-foreground">{titulo}</div>
      <table className="w-full text-[11px] tabular-nums">
        <thead>
          <tr className="bg-muted/60">
            <th className="px-2 py-1.5 text-left">{rotulo}</th>
            <th className="px-2 py-1.5">ANO</th>
            {MESES.map((m) => <th key={m} className="px-2 py-1.5 text-right">{m}</th>)}
            <th className="px-2 py-1.5 text-right">TOTAL</th>
            <th className="px-2 py-1.5 text-right">MÉDIA</th>
            <th className="px-2 py-1.5 text-right">CRESCIMENTO</th>
            {base && <th className="px-2 py-1.5 text-right">REPRES.</th>}
          </tr>
        </thead>
        <tbody>
          {anos.map((a, i) => {
            const t = tot(mat, a);
            const ant = i > 0 ? tot(mat, anos[i - 1]) : 0;
            const tb = tot(base, a);
            return (
              <tr key={a} className="border-t border-border">
                <td />
                <td className="px-2 py-1 font-semibold text-center">{a}</td>
                {mat[a].map((v, m) => (
                  <td key={m} className="px-1 py-0.5 text-right">
                    {editavel ? <CelulaEditavel valor={v} onSave={(nv) => onSave?.(a, m + 1, nv)} /> : fmt(v)}
                  </td>
                ))}
                <td className="px-2 py-1 text-right font-semibold">{fmt(t)}</td>
                <td className="px-2 py-1 text-right">{fmt(t / div[a])}</td>
                <td className="px-2 py-1 text-right">{i === 0 || ant === 0 ? "-" : pct(t / ant - 1)}</td>
                {base && <td className="px-2 py-1 text-right">{tb ? pct(t / tb) : "-"}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function CelulaEditavel({ valor, onSave }: { valor: number; onSave: (v: number) => void }) {
  const [edit, setEdit] = useState<string | null>(null);
  if (edit === null)
    return (
      <button className="w-full text-right rounded px-1 py-0.5 hover:bg-accent" onClick={() => setEdit(valor ? String(valor).replace(".", ",") : "")}>
        {fmt(valor)}
      </button>
    );
  const commit = () => {
    const nv = rowToBRNumber(edit);
    setEdit(null);
    if (nv !== valor) onSave(nv);
  };
  return (
    <input autoFocus value={edit} onChange={(e) => setEdit(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEdit(null); }}
      className="w-24 text-right bg-background border border-primary rounded px-1 py-0.5" />
  );
}
