import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import React, { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, parseBRNumber } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Check, X } from "lucide-react";

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

// Campos editáveis manualmente em meses encerrados
type Campo = "metaGlobo" | "pendAnt" | "captado" | "enviado" | "faturado";
const CAMPOS: Campo[] = ["metaGlobo", "pendAnt", "captado", "enviado", "faturado"];

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
  const { canEdit } = useAuth();
  const qc = useQueryClient();
  const [ano, setAno] = useState(ANO_ATUAL);

  const { data, isLoading } = useQuery({
    queryKey: ["consolidado", ano],
    queryFn: async () => {
      const start = `${ano}-01-01`;
      const end = `${ano}-12-31`;
      const [metasGlobo, pedidos, nfs, pendAnt, overrides] = await Promise.all([
        supabase.from("metas_globo").select("mes,valor").eq("ano", ano),
        supabase.from("pedidos_enviados").select("data,valor").gte("data", start).lte("data", end),
        supabase.from("notas_fiscais").select("data,valor").gte("data", start).lte("data", end),
        (supabase.from("pendencias_anteriores_produtos").select("mes,valor") as unknown as { eq: (c: string, v: number) => Promise<{ data: { mes: number; valor: number }[] | null }> }).eq("ano", ano),
        supabase.from("consolidado_overrides").select("mes,campo,valor").eq("ano", ano),
      ]);

      const base: Record<number, { metaGlobo: number; pendAnt: number; enviado: number; faturado: number }> = {};
      for (let m = 1; m <= 12; m++) base[m] = { metaGlobo: 0, pendAnt: 0, enviado: 0, faturado: 0 };
      (metasGlobo.data ?? []).forEach((r) => { base[r.mes].metaGlobo += Number(r.valor); });
      (pedidos.data ?? []).forEach((r) => {
        const m = Number(r.data.slice(5, 7));
        base[m].enviado += Number(r.valor);
      });
      (nfs.data ?? []).forEach((r) => {
        const m = Number(r.data.slice(5, 7));
        base[m].faturado += Number(r.valor);
      });
      (pendAnt.data ?? []).forEach((r) => { base[r.mes].pendAnt += Number(r.valor); });

      const ov: Record<string, number> = {};
      (overrides.data ?? []).forEach((r) => { ov[`${r.mes}:${r.campo}`] = Number(r.valor); });

      const linhas: LinhaMes[] = [];
      for (let m = 1; m <= 12; m++) {
        const b = base[m];
        const encerrado = ano < ANO_ATUAL || (ano === ANO_ATUAL && m < MES_ATUAL);
        const get = (campo: Campo, fallback: number) => {
          const k = `${m}:${campo}`;
          return ov[k] !== undefined ? ov[k] : fallback;
        };
        const metaGlobo = get("metaGlobo", b.metaGlobo);
        const pendAntV = get("pendAnt", b.pendAnt);
        const captado = get("captado", b.enviado);
        const enviado = get("enviado", b.enviado);
        const faturado = get("faturado", b.faturado);
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

  const saveOverride = useMutation({
    mutationFn: async ({ mes, campo, valor }: { mes: number; campo: Campo; valor: number }) => {
      const { error } = await supabase
        .from("consolidado_overrides")
        .upsert({ ano, mes, campo, valor }, { onConflict: "ano,mes,campo" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Valor atualizado");
      qc.invalidateQueries({ queryKey: ["consolidado", ano] });
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const clearOverride = useMutation({
    mutationFn: async ({ mes, campo }: { mes: number; campo: Campo }) => {
      const { error } = await supabase
        .from("consolidado_overrides")
        .delete()
        .eq("ano", ano).eq("mes", mes).eq("campo", campo);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Override removido");
      qc.invalidateQueries({ queryKey: ["consolidado", ano] });
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

      <div className="bi-card overflow-x-auto">
        {isLoading ? (
          <div className="p-10 text-center text-muted-foreground">Carregando…</div>
        ) : (
          <TabelaConsolidado
            linhas={data ?? []}
            canEdit={canEdit}
            onSave={(mes, campo, valor) => saveOverride.mutate({ mes, campo, valor })}
            onClear={(mes, campo) => clearOverride.mutate({ mes, campo })}
          />
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        Os meses encerrados aceitam edição manual (ícone de lápis). Valores informados manualmente prevalecem sobre o cálculo automático.
      </p>
    </div>
  );
}

function TabelaConsolidado({
  linhas, canEdit, onSave, onClear,
}: {
  linhas: LinhaMes[];
  canEdit: boolean;
  onSave: (mes: number, campo: Campo, valor: number) => void;
  onClear: (mes: number, campo: Campo) => void;
}) {
  const porMes = useMemo(() => Object.fromEntries(linhas.map((l) => [l.mes, l])), [linhas]);

  function totalTri(meses: number[]) {
    const rs = meses.map((m) => porMes[m]).filter(Boolean);
    const sum = (k: keyof LinhaMes) => rs.reduce((a, r) => a + (r[k] as number), 0);
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

  // Definição declarativa das colunas para auto-ocultar as vazias
  type Col = {
    key: string;
    label: string;
    derived?: keyof LinhaMes; // campo usado para o teste "tem dados?"
    render: (r: LinhaMes, m: number) => React.ReactNode;
    renderTotal: (t: ReturnType<typeof totalTri>) => React.ReactNode;
    headClass?: string;
    cellClass?: string;
    totalClass?: string;
  };

  const fmtPct = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")}%`;
  const num = "px-3 py-2.5 text-right tabular-nums";

  const allCols: Col[] = [
    {
      key: "metaGlobo", label: "Meta Trimestral Globo", derived: "metaGlobo",
      render: (r, m) => <EditableCell value={r.metaGlobo} editable={canEdit && r.encerrado} onSave={(v) => onSave(m, "metaGlobo", v)} onClear={() => onClear(m, "metaGlobo")} />,
      renderTotal: (t) => <td className={num}>{formatBRL(t.metaGlobo)}</td>,
    },
    {
      key: "metaAvanti", label: "Meta Avanti (+20%)", derived: "metaAvanti",
      render: (r) => <td className={num}>{formatBRL(r.metaAvanti)}</td>,
      renderTotal: (t) => <td className={num}>{formatBRL(t.metaAvanti)}</td>,
    },
    {
      key: "pendAnt", label: "Pendência Anterior", derived: "pendAnt",
      render: (r, m) => <EditableCell value={r.pendAnt} editable={canEdit && r.encerrado} onSave={(v) => onSave(m, "pendAnt", v)} onClear={() => onClear(m, "pendAnt")} />,
      renderTotal: (t) => <td className={num}>{formatBRL(t.pendAnt)}</td>,
    },
    {
      key: "captado", label: "Total Captado", derived: "captado",
      render: (r, m) => <EditableCell value={r.captado} editable={canEdit && r.encerrado} onSave={(v) => onSave(m, "captado", v)} onClear={() => onClear(m, "captado")} />,
      renderTotal: (t) => <td className={num}>{formatBRL(t.captado)}</td>,
    },
    {
      key: "enviado", label: "Valor Enviado", derived: "enviado",
      render: (r, m) => <EditableCell value={r.enviado} editable={canEdit && r.encerrado} onSave={(v) => onSave(m, "enviado", v)} onClear={() => onClear(m, "enviado")} />,
      renderTotal: (t) => <td className={num}>{formatBRL(t.enviado)}</td>,
    },
    {
      key: "pendMaisEnviado", label: "Pendência + Total Enviado", derived: "pendMaisEnviado",
      render: (r) => <td className={`${num} font-medium`}>{formatBRL(r.pendMaisEnviado)}</td>,
      renderTotal: (t) => <td className={num}>{formatBRL(t.pendMaisEnviado)}</td>,
    },
    {
      key: "faturado", label: "Valor Faturado", derived: "faturado",
      render: (r, m) => <EditableCell value={r.faturado} editable={canEdit && r.encerrado} onSave={(v) => onSave(m, "faturado", v)} onClear={() => onClear(m, "faturado")} />,
      renderTotal: (t) => <td className={num}>{formatBRL(t.faturado)}</td>,
    },
    {
      key: "atGlobo", label: "Ating. Faturado / Meta Globo", derived: "atGlobo",
      render: (r) => <td className={num}>{fmtPct(r.atGlobo)}</td>,
      renderTotal: (t) => <td className={num}>{fmtPct(t.atGlobo)}</td>,
    },
    {
      key: "atAvanti", label: "Ating. Faturado / Meta Avanti", derived: "atAvanti",
      headClass: "bg-[#095E11] border-l border-r border-[#063a09]",
      cellClass: "bg-[#095E11]/10 text-[#095E11] font-semibold",
      totalClass: "bg-[#063a09] text-white",
      render: (r) => <td className={`${num} bg-[#095E11]/10 text-[#095E11] font-semibold`}>{fmtPct(r.atAvanti)}</td>,
      renderTotal: (t) => <td className={`${num} bg-[#063a09] text-white`}>{fmtPct(t.atAvanti)}</td>,
    },
    {
      key: "nivelServico", label: "Nível de Serviço Globo", derived: "nivelServico",
      render: (r) => <td className={num}>{fmtPct(r.nivelServico)}</td>,
      renderTotal: (t) => <td className={num}>{fmtPct(t.nivelServico)}</td>,
    },
  ];

  // Oculta colunas sem dados (todos os meses com valor 0)
  const cols = allCols.filter((c) => {
    if (!c.derived) return true;
    return linhas.some((l) => Number(l[c.derived as keyof LinhaMes]) !== 0);
  });

  return (
    <table className="w-full text-[13px] border-separate border-spacing-0">
      <thead className="sticky top-0 z-10">
        <tr className="bg-[#FF3E00] text-white">
          <th className="px-3 py-3 text-left font-semibold uppercase text-[11px] tracking-wider w-20">Tri</th>
          <th className="px-3 py-3 text-left font-semibold uppercase text-[11px] tracking-wider">Mês</th>
          {cols.map((c) => (
            <th
              key={c.key}
              className={`px-3 py-3 text-right font-semibold uppercase text-[11px] tracking-wider whitespace-nowrap ${c.headClass ?? ""}`}
            >
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {TRIMESTRES.map((tri, triIdx) => {
          const tot = totalTri(tri.meses);
          return (
            <ReactFragmentTri key={tri.label}>
              {tri.meses.map((m, i) => {
                const r = porMes[m];
                if (!r) return null;
                const zebra = i % 2 === 0 ? "bg-background" : "bg-muted/20";
                return (
                  <tr key={m} className={`${zebra} hover:bg-primary/5 transition-colors`}>
                    {i === 0 && (
                      <td
                        rowSpan={tri.meses.length}
                        className="px-3 py-2.5 font-bold text-[#FF3E00] bg-[#FF3E00]/10 align-middle text-center border-y border-[#FF3E00]/20 text-sm tracking-wide"
                      >
                        {tri.label}
                      </td>
                    )}
                    <td className="px-3 py-2.5 font-semibold text-foreground border-b border-border/40">
                      {MESES[m - 1]}
                    </td>
                    {cols.map((c) => (
                      <React.Fragment key={c.key}>{c.render(r, m)}</React.Fragment>
                    ))}
                  </tr>
                );
              })}
              <tr className="bg-[#FF3E00] text-white font-bold uppercase text-[11px] tracking-wider">
                <td className="px-3 py-2.5 text-center" colSpan={2}>Total {tri.label}</td>
                {cols.map((c) => (
                  <React.Fragment key={c.key}>{c.renderTotal(tot)}</React.Fragment>
                ))}
              </tr>
              {triIdx < TRIMESTRES.length - 1 && (
                <tr><td colSpan={cols.length + 2} className="h-2 bg-transparent" /></tr>
              )}
            </ReactFragmentTri>
          );
        })}
      </tbody>
    </table>
  );
}



function ReactFragmentTri({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function EditableCell({
  value, editable, onSave, onClear,
}: { value: number; editable: boolean; onSave: (v: number) => void; onClear: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  if (editing) {
    return (
      <td className="px-2 py-1 text-right">
        <div className="flex items-center gap-1 justify-end">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { onSave(parseBRNumber(draft)); setEditing(false); }
              if (e.key === "Escape") setEditing(false);
            }}
            className="w-28 rounded border border-border bg-background px-1.5 py-0.5 text-right tabular-nums"
          />
          <button className="text-emerald-600" onClick={() => { onSave(parseBRNumber(draft)); setEditing(false); }} aria-label="Salvar"><Check className="h-3.5 w-3.5" /></button>
          <button className="text-muted-foreground" onClick={() => setEditing(false)} aria-label="Cancelar"><X className="h-3.5 w-3.5" /></button>
        </div>
      </td>
    );
  }
  return (
    <td className="px-2 py-2 text-right tabular-nums group">
      <div className="flex items-center justify-end gap-1">
        <span>{formatBRL(value)}</span>
        {editable && (
          <>
            <button
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
              onClick={() => { setDraft(String(value).replace(".", ",")); setEditing(true); }}
              aria-label="Editar"
              title="Editar valor (mês encerrado)"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-warning"
              onClick={onClear}
              aria-label="Restaurar automático"
              title="Restaurar valor automático"
            >
              <X className="h-3 w-3" />
            </button>
          </>
        )}
      </div>
    </td>
  );
}
