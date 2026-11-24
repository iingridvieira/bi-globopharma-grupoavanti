import { describe, expect, it } from "vitest";
import { parseBRDate } from "./format";

describe("parseBRDate — datas de importação", () => {
  it("converte o serial 46038 do erro em 16/01/2026, não no ano 46038", () => {
    expect(parseBRDate(46038)).toBe("2026-01-16");
    expect(parseBRDate("46038")).toBe("2026-01-16");
  });

  it("desconsidera a hora do serial sem mudar o dia", () => {
    expect(parseBRDate(46038.75)).toBe("2026-01-16");
    expect(parseBRDate("46038,75")).toBe("2026-01-16");
  });

  it("mantém datas brasileiras, ISO e objetos Date", () => {
    expect(parseBRDate("24/11/2026")).toBe("2026-11-24");
    expect(parseBRDate("3/9/26")).toBe("2026-09-03");
    expect(parseBRDate("2026-11-24")).toBe("2026-11-24");
    expect(parseBRDate(new Date("2026-11-24T15:30:00Z"))).toBe("2026-11-24");
  });

  it("rejeita datas inexistentes, anos expandidos e números inválidos", () => {
    for (const input of ["31/02/2026", "2026-02-31", "+046038-01", new Date("+046038-01-01"), NaN, Infinity, -1, 2958466]) {
      expect(parseBRDate(input)).toBeNull();
    }
  });

  it("preserva o calendário Excel sem aceitar 29/02/1900", () => {
    expect(parseBRDate(1)).toBe("1900-01-01");
    expect(parseBRDate(59)).toBe("1900-02-28");
    expect(parseBRDate(60)).toBeNull();
    expect(parseBRDate(61)).toBe("1900-03-01");
  });
});