import { describe, expect, it } from "vitest";
import { findRelatorioCarteira, parseEntregas } from "./entregas-import";

describe("Relatório da Carteira", () => {
  it("seleciona a aba de entregas mesmo quando o resumo é a primeira aba", () => {
    const notas = [{ NF: "12345", "Último evento": "Entregue", "Data Entrega": "24/11/2026" }];
    expect(findRelatorioCarteira({ Resumo: [{ Carteira: "Paulo" }], Notas: notas })).toBe(notas);
  });

  it("não identifica uma planilha de faturamento como relatório de entregas", () => {
    expect(findRelatorioCarteira({ Dados: [{ NF: "12345", Cliente: "ANDORINHA", Data: 46038, "Faturado (R$)": 150 }] })).toBeNull();
  });

  it("converte seriais de entrega sem apagar campos ausentes do relatório", () => {
    const result = parseEntregas([{ NF: "12345", "Último evento": "Entregue", "Data Entrega": 46350 }]);
    const row = result.linhas[0];
    expect(row?.data_entrega).toBe("2026-11-24");
    expect(row?.status).toBe("Entregue");
    expect(row).not.toHaveProperty("cte");
    expect(result.colunasFaltando).toEqual([]);
  });

  it("não importa notas emitidas antes de 01/07/2026", () => {
    const result = parseEntregas([
      { NF: "ANTIGA", "Emissão": "30/06/2026", Entrega: "24/11/2026" },
      { NF: "NOVA", "Emissão": "01/07/2026", Entrega: "24/11/2026" },
    ]);
    expect(result.linhas.map((row) => row.numero)).toEqual(["NOVA"]);
    expect(result.ignoradasPorData).toBe(1);
  });
});