import { forwardRef } from "react";

export type EntregaReportRow = {
  numero: string;
  cliente: string;
  dataFaturamento: string;
  dataEntrega: string;
  dias: number | null;
  status: string;
};

export const STATUS_CORES: Record<string, string> = {
  "Entregue": "#10b981",
  "Com Previsão": "#38bdf8",
  "Agendada": "#eab308",
  "Não Coletada": "#9ca39a",
  "Extraviada": "#ef4444",
  "Devolvida": "#a78bfa",
};

const ORDEM = ["Entregue", "Com Previsão", "Agendada", "Não Coletada", "Extraviada", "Devolvida"];

type Props = {
  periodo: string;
  rows: EntregaReportRow[];
};

export const EntregasReportCard = forwardRef<HTMLDivElement, Props>(function EntregasReportCardImpl(
  { periodo, rows },
  ref,
) {
  const total = rows.length;
  const counts = new Map<string, number>();
  rows.forEach((r) => counts.set(r.status, (counts.get(r.status) ?? 0) + 1));
  const resumo = ORDEM.filter((s) => (counts.get(s) ?? 0) > 0).map((s) => ({
    status: s,
    qtd: counts.get(s) ?? 0,
    cor: STATUS_CORES[s] ?? "#9ca39a",
  }));
  // status fora da lista padrão
  Array.from(counts.keys())
    .filter((s) => !ORDEM.includes(s))
    .forEach((s) => resumo.push({ status: s, qtd: counts.get(s) ?? 0, cor: "#9ca39a" }));

  const maxQtd = Math.max(1, ...resumo.map((r) => r.qtd));
  const entregues = counts.get("Entregue") ?? 0;
  const comDias = rows.filter((r) => r.dias != null).map((r) => r.dias as number);
  const mediaDias = comDias.length ? comDias.reduce((a, b) => a + b, 0) / comDias.length : null;
  const pctEntregue = total ? (entregues / total) * 100 : 0;

  const lista = [...rows].sort((a, b) => a.cliente.localeCompare(b.cliente, "pt-BR") || a.numero.localeCompare(b.numero, "pt-BR"));
  const MAX_LINHAS = 90;
  const visiveis = lista.slice(0, MAX_LINHAS);
  const restantes = lista.length - visiveis.length;
  const meio = Math.ceil(visiveis.length / 2);
  const leftRows = visiveis.slice(0, meio);
  const rightRows = visiveis.slice(meio);

  return (
    <div
      ref={ref}
      style={{
        width: 1280,
        background: "linear-gradient(180deg, #0E0F0C 0%, #1A1D17 100%)",
        color: "#E5E7E1",
        fontFamily: "'Inter', system-ui, sans-serif",
        padding: 44,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 28,
          borderBottom: "2px solid #F26A1F",
          paddingBottom: 18,
        }}
      >
        <div>
          <div style={{ fontSize: 13, letterSpacing: 2, color: "#F26A1F", fontWeight: 700, textTransform: "uppercase", whiteSpace: "nowrap" }}>
            BI Globo Pharma · Relatório de Entregas
          </div>
          <div style={{ fontSize: 40, fontWeight: 800, marginTop: 8, letterSpacing: -1 }}>{periodo}</div>
        </div>
        <div style={{ textAlign: "right", fontSize: 13, color: "#9ca39a" }}>
          <div>Gerado em</div>
          <div style={{ fontSize: 18, color: "#E5E7E1", fontWeight: 600 }}>{new Date().toLocaleDateString("pt-BR")}</div>
        </div>
      </div>

      {/* Indicadores */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
        {[
          { label: "TOTAL DE NFs", value: String(total), cor: "#F26A1F" },
          { label: "ENTREGUES", value: `${entregues} · ${pctEntregue.toFixed(0)}%`, cor: "#10b981" },
          {
            label: "MÉDIA DE DIAS",
            value: mediaDias == null ? "—" : `${mediaDias.toFixed(1).replace(".", ",")} dias`,
            cor: "#38bdf8",
          },
        ].map((c) => (
          <div
            key={c.label}
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid #3a3f34", borderRadius: 8, padding: 20 }}
          >
            <div style={{ fontSize: 11, letterSpacing: 2, fontWeight: 700, color: "#9ca39a" }}>{c.label}</div>
            <div style={{ fontSize: 32, fontWeight: 800, marginTop: 6, color: c.cor }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Gráfico por situação */}
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #3a3f34", borderRadius: 8, padding: 24, marginBottom: 24 }}>
        <div style={{ fontSize: 12, letterSpacing: 2, fontWeight: 700, color: "#9ca39a", marginBottom: 16 }}>
          SITUAÇÃO DAS ENTREGAS
        </div>
        {resumo.map((r) => (
          <div key={r.status} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <div style={{ width: 150, fontSize: 14, fontWeight: 600 }}>{r.status}</div>
            <div style={{ flex: 1, background: "rgba(255,255,255,0.06)", borderRadius: 4, height: 22, overflow: "hidden" }}>
              <div style={{ width: `${(r.qtd / maxQtd) * 100}%`, height: "100%", background: r.cor, borderRadius: 4 }} />
            </div>
            <div style={{ width: 90, textAlign: "right", fontSize: 14, fontWeight: 700, color: r.cor }}>
              {r.qtd} · {total ? ((r.qtd / total) * 100).toFixed(0) : 0}%
            </div>
          </div>
        ))}
        {resumo.length === 0 && <div style={{ color: "#9ca39a", fontSize: 14 }}>Sem notas fiscais no período.</div>}
      </div>

      {/* Tabelas lado a lado */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {[leftRows, rightRows].map((chunk, colIdx) => (
          <div key={colIdx} style={{ border: "1px solid #3a3f34", borderRadius: 8, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: 65 }} />
                <col />
                <col style={{ width: 80 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 42 }} />
                <col style={{ width: 95 }} />
              </colgroup>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.06)" }}>
                  {["NF", "Cliente", "Fat.", "Ent.", "Dias", "Situação"].map((h, i) => (
                    <th
                      key={h}
                      style={{
                        padding: "8px 8px",
                        textAlign: i >= 2 ? (i === 5 ? "right" : "center") : "left",
                        fontSize: 10,
                        letterSpacing: 1,
                        textTransform: "uppercase",
                        color: "#9ca39a",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chunk.map((r, idx) => (
                  <tr key={`${r.numero}-${colIdx}-${idx}`} style={{ background: idx % 2 ? "rgba(255,255,255,0.02)" : "transparent" }}>
                    <td style={{ padding: "6px 8px", fontWeight: 700, whiteSpace: "nowrap" }}>{r.numero}</td>
                    <td style={{ padding: "6px 8px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.cliente}</td>
                    <td style={{ padding: "6px 8px", textAlign: "center", color: "#c9cec6", whiteSpace: "nowrap" }}>{r.dataFaturamento}</td>
                    <td style={{ padding: "6px 8px", textAlign: "center", color: "#c9cec6", whiteSpace: "nowrap" }}>{r.dataEntrega || "—"}</td>
                    <td style={{ padding: "6px 8px", textAlign: "center", fontWeight: 700 }}>{r.dias == null ? "—" : r.dias}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "1px 8px",
                          borderRadius: 999,
                          fontSize: 10,
                          lineHeight: "14px",
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                          color: STATUS_CORES[r.status] ?? "#9ca39a",
                          border: `1px solid ${STATUS_CORES[r.status] ?? "#9ca39a"}`,
                        }}
                      >
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {chunk.length === 0 && (
              <div style={{ padding: "10px 8px", fontSize: 12, color: "#9ca39a", background: "rgba(255,255,255,0.04)" }}>
                Sem itens.
              </div>
            )}
          </div>
        ))}
      </div>
      {restantes > 0 && (
        <div style={{ padding: "10px 12px", fontSize: 12, color: "#9ca39a", background: "rgba(255,255,255,0.04)", borderRadius: 8, marginTop: 12 }}>
          + {restantes} NF(s) não exibidas neste relatório.
        </div>
      )}
    </div>
  );
});
