import { describe, expect, it } from "vitest";
import { notasComValorNegativo } from "./faturamento";

describe("relatório de faturamento — notas com valor negativo", () => {
  it("marca para remoção a nota inteira quando alguma linha é negativa", () => {
    const negativas = notasComValorNegativo([
      { numero: "176110", valor: -717.64 },
      { numero: "170609", valor: 120 },
      { numero: "170609", valor: -50 },
      { numero: "176200", valor: 1234.56 },
      { numero: "176201", valor: 0 },
    ]);
    expect([...negativas].sort()).toEqual(["170609", "176110"]);
  });
});
