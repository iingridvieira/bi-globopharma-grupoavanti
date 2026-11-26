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

/** Como formatBRL, mas omite ",00" quando não há centavos. */
export function formatBRLSmart(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (n == null || Number.isNaN(n)) return "R$ 0";
  const s = brl.format(n);
  return s.replace(/,00$/, "");
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

/**
 * Valor monetário do relatório de faturamento: valores negativos (bonificações
 * lançadas com sinal de menos) não são reconhecidos e contam como zero.
 */
export function parseValorFaturado(value: unknown): number {
  return Math.max(0, parseBRNumber(value));
}

/** Retorna apenas datas ISO completas, sem anos expandidos ou datas inválidas. */
function dateToISO(date: Date): string | null {
  if (!Number.isFinite(date.getTime())) return null;
  const iso = date.toISOString().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
}

/** Converte datas brasileiras, Date e seriais Excel para ISO YYYY-MM-DD. */
export function parseBRDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return dateToISO(value);
  const s = String(value).trim();
  // Células numéricas sem formato de data chegam como serial Excel. Nunca
  // usar new Date("46038"): isso interpreta o serial como o ano 46038.
  if (typeof value === "number" || /^\d{5,7}(?:[.,]\d+)?$/.test(s)) {
    const serial = typeof value === "number" ? value : Number(s.replace(",", "."));
    if (!Number.isFinite(serial) || serial < 1 || serial >= 2958466) return null;
    const day = Math.floor(serial);
    // O Excel inclui o fictício 29/02/1900 (serial 60).
    if (day === 60) return null;
    const offset = day < 60 ? 25568 : 25569;
    return dateToISO(new Date((day - offset) * 86400000));
  }
  // DD/MM/AAAA
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const dd = m[1];
    const mm = m[2];
    let yy = m[3];
    if (!dd || !mm || !yy) return null;
    if (yy.length === 2) yy = "20" + yy;
    const iso = `${yy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    return dateToISO(new Date(iso)) === iso ? iso : null;
  }
  // Não aceitar um número isolado como ano, nem corrigir um dia ISO inválido.
  if (/^[+-]?\d+(?:[.,]\d+)?$/.test(s)) return null;
  const iso = dateToISO(new Date(s));
  if (/^\d{4}-\d{2}-\d{2}$/.test(s) && iso !== s) return null;
  return iso;
}

export const MESES_BR = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
export const MESES_BR_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
