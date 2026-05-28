/** Mapeamento de razão social → nome padronizado do cliente no BI. */

const RAW_MAP: Array<[string, string]> = [
  ["AMBROSIO & CORREA COMERCIO DE PRODUTOS FARMACEUTICOS LTDA", "DISMAP"],
  ["ANDORINHA COMERCIO E DISTRIBUICAO LTDA", "ANDORINHA"],
  ["BANDEIRANTES COMERCIO DE MEDICAMENTOS E PRODUTOS PARA SAUDE LTDA", "BANDEIRANTES"],
  ["C.G. COMERCIO DE PRODUTOS FARMACEUTICOS E PERFUMARIA LTDA", "CG MEDICAMENTOS"],
  ["DF COMERCIO DE PRODUTOS FARMACEUTICOS LTDA", "DF COMERCIAL"],
  ["DISMED - DISTRIBUIDORA DE MEDICAMENTOS OLIMPIA LTDA.", "DISMED"],
  ["DROGARIA CAMPEA POPULAR C. COSTA LTDA", "CAMPEÃ"],
  ["FARMA CONDE S/A", "FARMA CONDE"],
  ["GEMELI MEDICAL LTDA", "GEMELI"],
  ["IMPACTA MED DISTRIBUIDORA DE MEDICAMENTOS E MATERIAIS HOSPITALARES LTDA", "IMPACTA MED"],
  ["J. K. MEDICAMENTOS LTDA", "JK MEDICAMENTOS"],
  ["MAXIFARMA DISTRIBUIDORA DE MEDICAMENTOS LTDA", "MAXIFARMA"],
  ["MED VALLE COMERCIO DE PRODUTOS FARMACEUTICOS LTDA", "MED VALLE"],
  ["MEDSOL DISTRIBUIDORA DE MEDICAMENTOS LTDA", "MEDSOL"],
  ["MILFARMA COMERCIAL LTDA", "MILFARMA"],
  ["NAVARRO DISTRIBUIDORA DE MEDICAMENTOS", "NAVARRO SP"],
  ["NAVARRO DISTRIBUIDORA DE MEDICAMENTOS S/A", "NAVARRO INTER"],
  ["NUCLEO FARMA COMERCIO DE PRODUTOS FARMACEUTICOS LTDA", "NÚCLEO FARMA"],
  ["SLEIMAN COMERCIO DE MEDICAMENTOS LTDA", "SLEIMAN"],
  ["TIMEH PRODUTOS HOSPITALARES LTDA", "TIMEH"],
  ["VALE COMERCIAL LTDA", "VALE COMERCIAL"],
];

export function normalizeKey(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

const NORMALIZED_MAP = new Map(RAW_MAP.map(([k, v]) => [normalizeKey(k), v]));

/** Palavras-chave distintivas → nome padrão. Fallback robusto para variações. */
const KEYWORDS: Array<[string, string]> = [
  ["sleiman", "SLEIMAN"],
  ["andorinha", "ANDORINHA"],
  ["bandeirantes", "BANDEIRANTES"],
  ["dismap", "DISMAP"],
  ["dismed", "DISMED"],
  ["maxifarma", "MAXIFARMA"],
  ["milfarma", "MILFARMA"],
  ["medsol", "MEDSOL"],
  ["nucleofarma", "NÚCLEO FARMA"],
  ["impactamed", "IMPACTA MED"],
  ["medvalle", "MED VALLE"],
  ["farmaconde", "FARMA CONDE"],
  ["gemeli", "GEMELI"],
  ["timeh", "TIMEH"],
  ["valecomercial", "VALE COMERCIAL"],
  ["drogariacampea", "CAMPEÃ"],
  ["jkmedicamentos", "JK MEDICAMENTOS"],
  ["ambrosioecorrea", "DISMAP"],
];

/** Resolve uma razão social bruta da planilha para o nome padrão. Retorna "OUTROS" se não mapeado. */
export function mapRazaoSocialToCliente(razaoSocial: string): string {
  if (!razaoSocial) return "OUTROS";
  const key = normalizeKey(razaoSocial);
  if (NORMALIZED_MAP.has(key)) return NORMALIZED_MAP.get(key)!;
  // Match por palavra-chave distintiva (mais confiável que prefixo).
  for (const [kw, std] of KEYWORDS) {
    if (key.includes(kw)) return std;
  }
  // Fallback: correspondência por prefixo amplo.
  for (const [k, v] of NORMALIZED_MAP) {
    if (key.startsWith(k.slice(0, 12)) || k.startsWith(key.slice(0, 12))) return v;
  }
  return "OUTROS";
}

/** Constrói um índice cliente padronizado → id a partir da tabela `clientes`. */
export function buildClienteIndex(clientes: { id: string; nome: string }[]): Map<string, string> {
  const idx = new Map<string, string>();
  clientes.forEach((c) => idx.set(normalizeKey(c.nome), c.id));
  return idx;
}

export function clienteIdFromRazao(razao: string, idx: Map<string, string>): string | null {
  const std = mapRazaoSocialToCliente(razao);
  return idx.get(normalizeKey(std)) ?? idx.get(normalizeKey("OUTROS")) ?? null;
}
