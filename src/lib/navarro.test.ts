import { describe, expect, it } from "vitest";
import { somaSellInNavarro } from "./navarro";

const linha = (o: Record<string, unknown>) => ({
  "Número da NF": "1", Cliente: "NAVARRO DISTRIBUIDORA DE MEDICAMENTOS S/A", "MÊS/ANO": "mar/26", " Faturado (R$)": 100, ...o,
});

describe("Sell In Navarro pelo relatório de faturamento", () => {
  it("relatório geral (sem Vendedor): só clientes Navarro, tudo na regional SP", () => {
    const r = somaSellInNavarro([
      linha({ "Número da NF": "1" }),
      linha({ "Número da NF": "2", Cliente: "SLEIMAN COMERCIO DE MEDICAMENTOS LTDA", " Faturado (R$)": 999 }),
      linha({ "Número da NF": "3", "MÊS/ANO": "abr/26", " Faturado (R$)": 50 }),
    ]);
    expect(r.regionais).toEqual(["SP"]);
    expect(Object.fromEntries(r.soma)).toEqual({ "SP|2026|3": 100, "SP|2026|4": 50 });
  });

  it("com coluna Vendedor: o vendedor define a regional", () => {
    const r = somaSellInNavarro([
      linha({ Vendedor: "Cleber" }),
      linha({ "Número da NF": "2", Vendedor: "Jéssica", " Faturado (R$)": 30 }),
      linha({ "Número da NF": "3", Vendedor: "Fulano" }),
    ]);
    expect(r.regionais).toEqual(["SP", "RJ", "MG", "ES", "PR"]);
    expect(Object.fromEntries(r.soma)).toEqual({ "ES|2026|3": 100, "RJ|2026|3": 30 });
    expect(r.ignorados).toEqual(["FULANO"]);
  });

  it("nota com linha negativa fica inteira de fora", () => {
    const r = somaSellInNavarro([
      linha({ "Número da NF": "7", " Faturado (R$)": 500 }),
      linha({ "Número da NF": "7", " Faturado (R$)": -20 }),
      linha({ "Número da NF": "8", " Faturado (R$)": 40 }),
    ]);
    expect(Object.fromEntries(r.soma)).toEqual({ "SP|2026|3": 40 });
  });
});
