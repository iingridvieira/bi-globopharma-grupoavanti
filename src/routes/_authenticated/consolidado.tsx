import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import React, { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/consolidado")({
  component: Consolidado,
});

const MESES = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO",
];
const TRIMESTRES = [
  { label: "1° TRI", meses: [1, 2, 3] },
  { label: "2° TRI", meses: [4, 5, 6] },
  { label: "3° TRI", meses: [7, 8, 9] },
  { label: "4° TRI", meses: [10, 11, 12] },
];

type LinhaMes = {
  ano: number;
  mes: number;
  encerrado: boolean;
  metaGlobo: number;
  metaAvanti: number;
  pendAnt: number;
  captado: number;
  enviado: number;
  pendMaisEnviado: number;
  faturado: number;
  atGlobo: number;
  atAvanti: number;
  nivelServico: number;
};

const ANO_ATUAL = new Date().getFullYear();
const MES_ATUAL = new Date().getMonth() + 1;

function Consolidado() {
  const [ano, setAno] = React.useState(ANO_ATUAL);

  const { data, isLoading } = useQuery({
    queryKey: ["consolidado", ano],
    queryFn: async () => {
      const start = `${ano}-01-01`;
      const end = `${ano}-12-31`;

      async function fetchAll<T>(build: () => any): Promise<T[]> {
        const PAGE = 1000;
        let from = 0;
        const out: T[] = [];
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { data, error } = await build().range(from, from + PAGE - 1);
          if (error) throw error;
          const rows = (data ?? []) as T[];
          out.push(...rows);
          if (rows.length < PAGE) break;
          from += PAGE;
        }
        return out;
      }

      const [metasGlobo, pedidosRows, nfsRows, pendAntRows] = await Promise.all([
        supabase.from("metas_globo").select("mes,valor").eq("ano", ano),
        fetchAll<{ data: string; valor: number }>(() =>
          supabase.from("pedidos_enviados").select("data,valor").gte("data", start).lte("data", end)
        ),
        fetchAll<{ data: string; valor: number }>(() =>
          supabase.from("notas_fiscais").select("data,valor").gte("data", start).lte("data", end)
        ),
        fetchAll<{ mes: number; valor: number }>(() =>
          (supabase.from("pendencias_anteriores_produtos").select("mes,valor") as any).eq("ano", ano)
        ),
      ]);
      const pedidos = { data: pedidosRows };
      const nfs = { data: nfsRows };
      const pendAnt = { data: pendAntRows };

      const base: Record<number, { metaGlobo: number; enviado: number; faturado: number; pendAnt: number }> = {};
      for (let m = 1; m <= 12; m++) base[m] = { metaGlobo: 0, enviado: 0, faturado: 0, pendAnt: 0 };
      (metasGlobo.data ?? []).forEach((r) => { base[r.mes].metaGlobo += Number(r.valor); });
      (pedidos.data ?? []).forEach((r) => {
        const m = Number(r.data.slice(5, 7));
        base[m].enviado += Number(r.valor);
      });
      (nfs.data ?? []).forEach((r) => {
        const m = Number(r.data.slice(5, 7));
        base[m].faturado += Number(r.valor);
      });
      (pendAnt.data ?? []).forEach((r) => {
        if (r.mes >= 1 && r.mes <= 12) base[r.mes].pendAnt += Number(r.valor);
      });

      const linhas: LinhaMes[] = [];
      for (let m = 1; m <= 12; m++) {
        const b = base[m];
        const encerrado = ano < ANO_ATUAL || (ano === ANO_ATUAL && m < MES_ATUAL);
        const metaGlobo = b.metaGlobo;
        const captado = b.enviado;
        const enviado = b.enviado;
        const faturado = b.faturado;
        const pendAntV = b.pendAnt;
        const metaAvanti = metaGlobo * 1.2;
        const pendMaisEnviado = pendAntV + enviado;
        linhas.push({
          ano, mes: m, encerrado,
          metaGlobo, metaAvanti, pendAnt: pendAntV, captado, enviado,
          pendMaisEnviado, faturado,
          atGlobo: metaGlobo > 0 ? faturado / metaGlobo : 0,
          atAvanti: metaAvanti > 0 ? faturado / metaAvanti : 0,
          nivelServico: pendMaisEnviado > 0 ? faturado / pendMaisEnviado : 0,
        });
      }
      return linhas;
    },
  });


  return (
    <div className="p-8 max-w-[1800px] mx-auto">
      <header className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <div>
            <div className="bi-stat-label">Visão anual</div>
            <h1 className="font-display text-2xl font-bold">Consolidado {ano}</h1>
          </div>
        </div>
        <select
          className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium"
          value={ano}
          onChange={(e) => setAno(Number(e.target.value))}
        >
          {Array.from({ length: 5 }, (_, i) => ANO_ATUAL - 2 + i).map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </header>

      <div className="bi-card overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-muted-foreground">Carregando…</div>
        ) : (
          <TabelaConsolidado linhas={data ?? []} />
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        Todos os valores são calculados automaticamente a partir dos dados do sistema. A Pendência Anterior é o total importado de Pendências Anteriores do mês.
      </p>
    </div>
  );
}

function TabelaConsolidado({ linhas }: { linhas: LinhaMes[] }) {
  const porMes = useMemo(() => Object.fromEntries(linhas.map((l) => [l.mes, l])), [linhas]);

  function totalTri(meses: number[]) {
    const rs = meses.map((m) => porMes[m]).filter(Boolean);
    const sum = (k: keyof LinhaMes) => rs.reduce((a, r) => a + (Number(r[k]) || 0), 0);
    const metaGlobo = sum("metaGlobo");
    const metaAvanti = sum("metaAvanti");
    const faturado = sum("faturado");
    const pendMaisEnviado = sum("pendMaisEnviado");
    return {
      metaGlobo, metaAvanti,
      pendAnt: sum("pendAnt"),
      captado: sum("captado"),
      enviado: sum("enviado"),
      pendMaisEnviado,
      faturado,
      atGlobo: metaGlobo > 0 ? faturado / metaGlobo : 0,
      atAvanti: metaAvanti > 0 ? faturado / metaAvanti : 0,
      nivelServico: pendMaisEnviado > 0 ? faturado / pendMaisEnviado : 0,
    };
  }

  const trisVisiveis = useMemo(() => {
    return TRIMESTRES.filter((tri, idx) => {
      if (idx < 2) return true;
      return tri.meses.some((m) => {
        const r = porMes[m];
        if (!r) return false;
        return (
          r.metaGlobo !== 0 || r.pendAnt !== 0 || r.captado !== 0 ||
          r.enviado !== 0 || r.faturado !== 0
        );
      });
    });
  }, [porMes]);

  type Col = {
    key: string;
    label: string;
    derived?: keyof LinhaMes;
    render: (r: LinhaMes) => React.ReactNode;
    renderTotal: (t: ReturnType<typeof totalTri>) => React.ReactNode;
    headClass?: string;
  };

  const fmtPct = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")}%`;
  const cellNum = "px-2.5 py-2 text-right tabular-nums border-l border-border/40";
  const totalNum = "px-2.5 py-2 text-right tabular-nums border-l border-white/15";

  const allCols: Col[] = [
    {
      key: "metaGlobo", label: "Meta Trimestral Globo", derived: "metaGlobo",
      render: (r) => <td className={cellNum}>{formatBRL(r.metaGlobo)}</td>,
      renderTotal: (t) => <td className={totalNum}>{formatBRL(t.metaGlobo)}</td>,
    },
    {
      key: "metaAvanti", label: "Meta Avanti (+20%)", derived: "metaAvanti",
      render: (r) => <td className={cellNum}>{formatBRL(r.metaAvanti)}</td>,
      renderTotal: (t) => <td className={totalNum}>{formatBRL(t.metaAvanti)}</td>,
    },
    {
      key: "pendAnt", label: "Pendência Anterior", derived: "pendAnt",
      render: (r) => <td className={cellNum}>{formatBRL(r.pendAnt)}</td>,
      renderTotal: (t) => <td className={totalNum}>{formatBRL(t.pendAnt)}</td>,
    },
    {
      key: "captado", label: "Total Captado", derived: "captado",
      render: (r) => <td className={cellNum}>{formatBRL(r.captado)}</td>,
      renderTotal: (t) => <td className={totalNum}>{formatBRL(t.captado)}</td>,
    },
    {
      key: "enviado", label: "Valor Enviado", derived: "enviado",
      render: (r) => <td className={cellNum}>{formatBRL(r.enviado)}</td>,
      renderTotal: (t) => <td className={totalNum}>{formatBRL(t.enviado)}</td>,
    },
    {
      key: "pendMaisEnviado", label: "Pendência + Total Enviado", derived: "pendMaisEnviado",
      render: (r) => <td className={`${cellNum} font-medium`}>{formatBRL(r.pendMaisEnviado)}</td>,
      renderTotal: (t) => <td className={totalNum}>{formatBRL(t.pendMaisEnviado)}</td>,
    },
    {
      key: "faturado", label: "Valor Faturado", derived: "faturado",
      render: (r) => <td className={cellNum}>{formatBRL(r.faturado)}</td>,
      renderTotal: (t) => <td className={totalNum}>{formatBRL(t.faturado)}</td>,
    },
    {
      key: "atGlobo", label: "Ating. Faturado / Meta Globo", derived: "atGlobo",
      render: (r) => <td className={cellNum}>{fmtPct(r.atGlobo)}</td>,
      renderTotal: (t) => <td className={totalNum}>{fmtPct(t.atGlobo)}</td>,
    },
    {
      key: "atAvanti", label: "Ating. Faturado / Meta Avanti", derived: "atAvanti",
      headClass: "bg-[#095E11]",
      render: (r) => <td className={`${cellNum} bg-[#095E11]/10 text-[#095E11] font-semibold`}>{fmtPct(r.atAvanti)}</td>,
      renderTotal: (t) => <td className={`${totalNum} bg-[#063a09] text-white`}>{fmtPct(t.atAvanti)}</td>,
    },
    {
      key: "nivelServico", label: "Nível de Serviço Globo", derived: "nivelServico",
      render: (r) => <td className={cellNum}>{fmtPct(r.nivelServico)}</td>,
      renderTotal: (t) => <td className={totalNum}>{fmtPct(t.nivelServico)}</td>,
    },
  ];

  const cols = allCols.filter((c) => {
    if (!c.derived) return true;
    return linhas.some((l) => Number(l[c.derived as keyof LinhaMes]) !== 0);
  });

  const stickyTri = "sticky left-0 z-20";
  const stickyMes = "sticky left-14 z-20";

  return (
    <div className="overflow-auto max-h-[calc(100vh-220px)]">
      <table className="w-full text-[12.5px] border-separate border-spacing-0">
        <thead className="sticky top-0 z-30">
          <tr className="bg-[#FF3E00] text-white">
            <th className={`${stickyTri} bg-[#FF3E00] px-2 py-2.5 text-left font-semibold uppercase text-[10.5px] tracking-wider w-14 align-middle border-r border-white/15`}>Tri</th>
            <th className={`${stickyMes} bg-[#FF3E00] px-2.5 py-2.5 text-left font-semibold uppercase text-[10.5px] tracking-wider w-[120px] align-middle border-r border-white/15`}>Mês</th>
            {cols.map((c) => (
              <th
                key={c.key}
                className={`px-2.5 py-2.5 text-right font-semibold uppercase text-[10.5px] tracking-wider align-middle leading-tight whitespace-normal break-words border-l border-white/15 ${c.headClass ?? ""}`}
                style={{ minWidth: 96, maxWidth: 132 }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {trisVisiveis.map((tri, triIdx) => {
            const tot = totalTri(tri.meses);
            return (
              <React.Fragment key={tri.label}>
                {tri.meses.map((m, i) => {
                  const r = porMes[m];
                  if (!r) return null;
                  const zebra = i % 2 === 0 ? "bg-background" : "bg-muted/15";
                  return (
                    <tr key={m} className={`${zebra} hover:bg-primary/5 transition-colors`}>
                      {i === 0 && (
                        <td
                          rowSpan={tri.meses.length}
                          className={`${stickyTri} px-1 py-2 font-bold text-[#FF3E00] bg-[#FF3E00]/10 text-center text-xs tracking-wide border-r border-y border-[#FF3E00]/30 align-middle`}
                          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                        >
                          {tri.label}
                        </td>
                      )}
                      <td className={`${stickyMes} ${zebra} px-2.5 py-2 font-semibold text-foreground border-b border-r border-border/40`}>
                        {MESES[m - 1]}
                      </td>
                      {cols.map((c) => (
                        <React.Fragment key={c.key}>{c.render(r)}</React.Fragment>
                      ))}
                    </tr>
                  );
                })}
                <tr className="bg-[#FF3E00] text-white font-bold uppercase text-[10.5px] tracking-wider">
                  <td className={`${stickyTri} bg-[#FF3E00] px-2 py-2 text-center border-r border-white/15`} />
                  <td className={`${stickyMes} bg-[#FF3E00] px-2.5 py-2 text-left border-r border-white/15`}>Total {tri.label}</td>
                  {cols.map((c) => (
                    <React.Fragment key={c.key}>{c.renderTotal(tot)}</React.Fragment>
                  ))}
                </tr>
                {triIdx < trisVisiveis.length - 1 && (
                  <tr aria-hidden><td colSpan={cols.length + 2} className="h-1.5 bg-transparent" /></tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
