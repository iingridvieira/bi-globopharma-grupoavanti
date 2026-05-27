/** Formatadores no padrão brasileiro. */

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const num = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numInt = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0,
});

export function formatBRL(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (n == null || Number.isNaN(n)) return "R$ 0,00";
  return brl.format(n);
}

export function formatNumberBR(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (n == null || Number.isNaN(n)) return "0,00";
  return num.format(n);
}

export function formatIntBR(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "0";
  return numInt.format(value);
}

export function formatDateBR(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Converte string "1.234,56" ou "1234,56" em number 1234.56. Aceita number direto. */
export function parseBRNumber(value: unknown): number {
  if (value == null || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "boolean") return value ? 1 : 0;
  const s = String(value).trim().replace(/\s|R\$/gi, "");
  if (!s) return 0;
  // Se tem vírgula, é decimal BR: remove pontos de milhar, troca vírgula por ponto.
  if (s.includes(",")) {
    const n = Number(s.replace(/\./g, "").replace(",", "."));
    return Number.isNaN(n) ? 0 : n;
  }
  // Só pontos: se padrão BR de milhar (ex: "3.614" ou "1.234.567"), remove os pontos.
  if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    const n = Number(s.replace(/\./g, ""));
    return Number.isNaN(n) ? 0 : n;
  }
  const n = Number(s);
  return Number.isNaN(n) ? 0 : n;
}

/** Converte string "DD/MM/AAAA" para ISO YYYY-MM-DD. Aceita Date também. */
export function parseBRDate(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  // DD/MM/AAAA
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let [, dd, mm, yy] = m;
    if (yy.length === 2) yy = "20" + yy;
    return `${yy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  // ISO
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

export const MESES_BR = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
export const MESES_BR_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
