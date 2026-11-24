import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { readExcelFile, rowToBRDate } from "./excel";

describe("datas nos arquivos importados", () => {
  it("lê uma célula numérica sem formatação de data como 16/01/2026", async () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([{ "Data de Lançamento": 46038, NF: "12345" }]);
    XLSX.utils.book_append_sheet(wb, ws, "Faturamento");
    const bytes = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const file = { name: "faturamento.xlsx", type: "", arrayBuffer: async () => bytes } as File;
    const { sheets } = await readExcelFile(file);
    const row = sheets["Faturamento"]?.[0];
    expect(row?.["Data de Lançamento"]).toBe(46038);
    expect(rowToBRDate(row?.["Data de Lançamento"])).toBe("2026-01-16");
  });

  it("preserva dia e mês de datas brasileiras em CSV", async () => {
    const bytes = new TextEncoder().encode("NF;DATA ENTREGA\n12345;03/09/2026").buffer;
    const file = { name: "entregas.csv", type: "text/csv", arrayBuffer: async () => bytes } as File;
    const { sheets } = await readExcelFile(file);
    const row = Object.values(sheets)[0]?.[0];
    expect(rowToBRDate(row?.["DATA ENTREGA"])).toBe("2026-09-03");
  });
});