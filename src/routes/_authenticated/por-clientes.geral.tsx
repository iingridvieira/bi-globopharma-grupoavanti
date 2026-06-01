import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, MESES_BR_SHORT } from "@/lib/format";
import { ArrowLeft, Globe2 } from "lucide-react";
import React, { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

export const Route = createFileRoute("/_authenticated/por-clientes/geral")({ component: GeralPage });

type Row = { ano: number; mes: number; valor: number | string };
type PositRow = { ano: number; mes: number; positivacao_total: number | string; positivacao_globo: number | string };

async function fetchAll(table: "sell_in" | "sell_out"): Promise<Row[]> {
  const PAGE = 1000;
  const out: Row[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select("ano,mes,valor")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const chunk = (data ?? []) as Row[];
    out.push(...chunk);
    if (chunk.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

async function fetchAllPositivacao(): Promise<PositRow[]> {
  const PAGE = 1000;
  const out: PositRow[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("positivacao")
      .select("ano,mes,positivacao_total,positivacao_globo")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const chunk = (data ?? []) as PositRow[];
    out.push(...chunk);
    if (chunk.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

function GeralPage() {
  const { data: sellIn } = useQuery({ queryKey: ["geral-sell-in"], queryFn: () => fetchAll("sell_in") });
  const { data: sellOut } = useQuery({ queryKey: ["geral-sell-out"], queryFn: () => fetchAll("sell_out") });
  const { data: positivacao } = useQuery({ queryKey: ["geral-positivacao"], queryFn: fetchAllPositivacao });

  const anos = useMemo(() => {
    const s = new Set<number>();
    (sellIn ?? []).forEach((r) => s.add(Number(r.ano)));
    (sellOut ?? []).forEach((r) => s.add(Number(r.ano)));
    return Array.from(s).sort((a, b) => a - b);
  }, [sellIn, sellOut]);

  return (
    <div className="p-8 max-w-[1500px] mx-auto">
      <Link to="/por-clientes" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <header className="mb-6">
        <div className="bi-stat-label">Consolidado</div>
        <h1 className="font-display text-3xl font-bold mt-1 flex items-center gap-2">
          <Globe2 className="h-7 w-7 text-primary" /> GERAL · Todos os clientes
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Compilado anual de Sell In e Sell Out de todos os clientes.</p>
      </header>

      <PositivacaoConsolidada rows={positivacao ?? []} />
      <MultiYearSection title="Sell In" rows={sellIn ?? []} anos={anos} colorVar="var(--color-chart-1)" />
      <MultiYearSection title="Sell Out" rows={sellOut ?? []} anos={anos} colorVar="var(--color-chart-2)" />
    </div>
  );
}

function PositivacaoConsolidada({ rows }: { rows: PositRow[] }) {
  const anos = useMemo(() => Array.from(new Set(rows.map((r) => Number(r.ano)))).sort((a, b) => a - b), [rows]);

  const byYear = useMemo(() => {
    const map = new Map<number, { total: number[]; globo: number[] }>();
    anos.forEach((a) => map.set(a, { total: Array(12).fill(0), globo: Array(12).fill(0) }));
    rows.forEach((r) => {
      const y = map.get(Number(r.ano));
      if (!y) return;
      const i = Number(r.mes) - 1;
      y.total[i] += Number(r.positivacao_total) || 0;
      y.globo[i] += Number(r.positivacao_globo) || 0;
    });
    return map;
  }, [rows, anos]);

  const totalGeral = useMemo(() => rows.reduce((a, r) => a + (Number(r.positivacao_total) || 0), 0), [rows]);
  const totalGlobo = useMemo(() => rows.reduce((a, r) => a + (Number(r.positivacao_globo) || 0), 0), [rows]);

  const ultimoAno = anos[anos.length - 1];
  const chartData = useMemo(() => {
    if (!ultimoAno) return [];
    const y = byYear.get(ultimoAno)!;
    return MESES_BR_SHORT.map((m, i) => ({ mes: m, Total: y.total[i], Globo: y.globo[i] }));
  }, [byYear, ultimoAno]);

  return (
    <section className="bi-card mb-6 overflow-hidden">
      <header className="px-6 py-4 border-b border-border flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold">Positivação · Todos os clientes</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Soma consolidada de positivação total e Globo</p>
        </div>
        <div className="flex gap-6">
          <div>
            <div className="bi-stat-label">Positivação Total</div>
            <div className="font-display text-2xl font-bold tabular-nums text-primary">{formatBRL(totalGeral)}</div>
          </div>
          <div>
            <div className="bi-stat-label">Positivação Globo</div>
            <div className="font-display text-2xl font-bold tabular-nums" style={{ color: "var(--color-chart-2)" }}>{formatBRL(totalGlobo)}</div>
          </div>
        </div>
      </header>

      {anos.length > 0 && (
        <div className="overflow-x-auto">
          <table className="bi-table">
            <thead>
              <tr>
                <th className="text-left">Ano</th>
                <th className="text-left">Métrica</th>
                {MESES_BR_SHORT.map((m) => <th key={m} className="text-right">{m}</th>)}
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {anos.map((ano) => {
                const y = byYear.get(ano)!;
                const totT = y.total.reduce((a, b) => a + b, 0);
                const totG = y.globo.reduce((a, b) => a + b, 0);
                return (
                  <React.Fragment key={ano}>
                    <tr>
                      <td className="font-semibold" rowSpan={2}>{ano}</td>
                      <td className="text-xs text-muted-foreground">Total</td>
                      {y.total.map((v, i) => <td key={i} className="text-right tabular-nums text-xs">{v ? formatBRL(v) : "—"}</td>)}
                      <td className="text-right tabular-nums font-semibold text-primary">{formatBRL(totT)}</td>
                    </tr>
                    <tr>
                      <td className="text-xs text-muted-foreground">Globo</td>
                      {y.globo.map((v, i) => <td key={i} className="text-right tabular-nums text-xs">{v ? formatBRL(v) : "—"}</td>)}
                      <td className="text-right tabular-nums font-semibold" style={{ color: "var(--color-chart-2)" }}>{formatBRL(totG)}</td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {chartData.length > 0 && (
        <div className="px-6 py-4 border-t border-border" style={{ height: 280 }}>
          <div className="bi-stat-label mb-2">Evolução mensal · {ultimoAno}</div>
          <ResponsiveContainer width="100%" height="90%">
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} width={70} tickFormatter={(v: number) => formatBRL(v)} />
              <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 12 }} formatter={(v: number) => formatBRL(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="Total" stroke="var(--color-chart-1)" strokeWidth={2.5} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="Globo" stroke="var(--color-chart-2)" strokeWidth={2.5} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {rows.length === 0 && (
        <div className="px-6 py-8 text-center text-muted-foreground text-sm">Sem dados de positivação cadastrados.</div>
      )}
    </section>
  );
}

type YearRow = { ano: number; meses: number[]; total: number; media: number; crescimento: number | null };

function buildYearMatrix(rows: Row[], anos: number[]): YearRow[] {
  const byYear = new Map<number, number[]>();
  anos.forEach((a) => byYear.set(a, Array(12).fill(0)));
  rows.forEach((r) => {
    const arr = byYear.get(Number(r.ano));
    if (arr) arr[Number(r.mes) - 1] += Number(r.valor);
  });
  const result: YearRow[] = [];
  anos.forEach((ano, idx) => {
    const meses = byYear.get(ano)!;
    const total = meses.reduce((a, b) => a + b, 0);
    const ativos = meses.filter((v) => v > 0).length;
    const media = ativos ? total / ativos : 0;
    const prev = idx > 0 ? result[idx - 1].total : null;
    const crescimento = prev && prev > 0 ? ((total - prev) / prev) * 100 : null;
    result.push({ ano, meses, total, media, crescimento });
  });
  return result;
}

function pctClass(v: number | null): string {
  if (v == null) return "text-muted-foreground";
  if (v >= 0) return "text-emerald-500";
  return "text-red-500";
}
function fmtPct(v: number | null): string {
  if (v == null) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2).replace(".", ",")}%`;
}

function MultiYearSection({ title, rows, anos, colorVar }: { title: string; rows: Row[]; anos: number[]; colorVar: string }) {
  const matrix = useMemo(() => buildYearMatrix(rows, anos), [rows, anos]);
  const chartData = useMemo(() => MESES_BR_SHORT.map((m, i) => {
    const obj: Record<string, number | string> = { mes: m };
    matrix.forEach((row) => { obj[String(row.ano)] = row.meses[i]; });
    return obj;
  }), [matrix]);

  const maxPorMes = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    let max = 0;
    matrix.forEach((r) => { if (r.meses[i] > max) max = r.meses[i]; });
    return max;
  }), [matrix]);

  return (
    <section className="bi-card mb-6 overflow-hidden">
      <header className="px-6 py-4 border-b border-border">
        <h2 className="font-display text-lg font-semibold">{title} · Todos os anos</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Compilado de todos os clientes por ano · maior valor de cada mês destacado em verde</p>
      </header>
      <div className="overflow-x-auto">
        <table className="bi-table">
          <thead>
            <tr>
              <th className="text-left">Ano</th>
              {MESES_BR_SHORT.map((m) => <th key={m} className="text-right">{m}</th>)}
              <th className="text-right">Total</th>
              <th className="text-right">Média</th>
              <th className="text-right">Crescimento</th>
            </tr>
          </thead>
          <tbody>
            {matrix.map((row) => (
              <tr key={row.ano}>
                <td className="font-semibold">{row.ano}</td>
                {row.meses.map((v, i) => {
                  const isMax = v > 0 && v === maxPorMes[i];
                  return (
                    <td key={i} className={`text-right tabular-nums text-xs ${isMax ? "bg-emerald-500/15 text-emerald-500 font-semibold rounded" : ""}`}>
                      {v ? formatBRL(v) : "—"}
                    </td>
                  );
                })}
                <td className="text-right tabular-nums font-semibold text-primary">{formatBRL(row.total)}</td>
                <td className="text-right tabular-nums font-semibold">{formatBRL(row.media)}</td>
                <td className={`text-right tabular-nums font-semibold ${pctClass(row.crescimento)}`}>{fmtPct(row.crescimento)}</td>
              </tr>
            ))}
            {matrix.length === 0 && (
              <tr><td colSpan={16} className="text-center text-muted-foreground py-8">Sem dados.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {matrix.length >= 2 && (
        <div className="px-6 py-4 border-t border-border">
          <div className="bi-stat-label mb-3">Comparativo entre anos</div>
          <div className="flex flex-wrap gap-3">
            {matrix.slice(1).map((row, i) => {
              const prev = matrix[i];
              const yyA = String(prev.ano).slice(-2);
              const yyB = String(row.ano).slice(-2);
              return (
                <div key={row.ano} className="rounded-md border border-border bg-card px-4 py-3 min-w-[160px]">
                  <div className="text-xs text-muted-foreground">{yyA} x {yyB}</div>
                  <div className={`font-display text-xl font-bold tabular-nums ${pctClass(row.crescimento)}`}>{fmtPct(row.crescimento)}</div>
                  <div className="text-[11px] text-muted-foreground tabular-nums mt-1">{formatBRL(prev.total)} → {formatBRL(row.total)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="px-6 py-4 border-t border-border" style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
            <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} width={70} tickFormatter={(v: number) => formatBRL(v)} />
            <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 12 }} formatter={(v: number) => formatBRL(v)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {matrix.map((row, i) => (
              <Line key={row.ano} type="monotone" dataKey={String(row.ano)}
                stroke={i === matrix.length - 1 ? colorVar : `hsl(${(i * 67) % 360} 60% 55%)`}
                strokeWidth={i === matrix.length - 1 ? 2.5 : 1.8} dot={{ r: 2 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
