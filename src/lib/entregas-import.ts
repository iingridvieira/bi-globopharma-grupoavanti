import { hasCol, pickCol, pickFirst, rowToBRDate, type ExcelRow } from "./excel";
import { parseBRDate } from "./format";

/** Uma linha de nf_entregas (1 por NF, chaveada por `numero`). */
export type EntregaRow = {
  numero: string;
  data_entrega: string | null;
  data_agendamento: string | null;
  previsao_entrega: string | null;
  previsao_entrega_inicial: string | null;
  status: string;
  transportadora: string | null;
  observacao: string | null;
  status_coleta: string | null;
  data_coleta: string | null;
  previsao_coleta: string | null;
  data_emissao_cte: string | null;
  cte: string | null;
  vendedor: string | null;
  canal: string | null;
  gerente_contas: string | null;
  status_entrega_planilha: string | null;
  status_agendamento_detalhe: string | null;
};

/**
 * Nomes de coluna aceitos para cada campo (sem acento/maiúscula, a busca é
 * tolerante). Cobre o modelo atual da planilha (exportação "entregas_<vendedor>_<data>.csv")
 * e os nomes do modelo anterior, então planilhas antigas continuam funcionando.
 */
const COLS = {
  numero: ["NOTA", "NF", "Número", "Numero", "Número da NF", "Numero da NF"],
  emissao: ["DATA EMISSÃO NF", "DATA EMISSAO NF"],
  data_entrega: ["DATA ENTREGA (Alterar Data)", "DATA ENTREGA", "Data Entrega", "Data de Entrega"],
  data_agendamento: ["DATA AGENDAMENTO", "Data Agendamento", "Data de Agendamento"],
  previsao_entrega: [
    "PREVISÃO DE ENTREGA SITE",
    "PREVISAO DE ENTREGA SITE",
    "Previsão de Entrega",
    "Previsao de Entrega",
    "PREVISÃO ENTREGA TABELA TRANSPORTADORA",
    "PREVISAO ENTREGA TABELA TRANSPORTADORA",
    "PREVISÃO DE ENTREGA SITE TRASP",
    "PREVISAO DE ENTREGA SITE TRASP",
  ],
  previsao_entrega_inicial: ["PREVISÃO ENTREGA INICIAL", "PREVISAO ENTREGA INICIAL"],
  transportadora: ["TRANSPORTADORA", "Transportadora"],
  // "OBS DE RASTREIO" é o texto que a transportadora devolve no rastreio.
  observacao: ["OBS DE RASTREIO", "STATUS", "OBSERVAÇÃO", "OBSERVACAO", "Observação", "Observacao"],
  status_entrega_planilha: [
    "STATUS ENTREGA - OK (NÃO ALTERAR NADA)",
    "STATUS ENTREGA - OK",
    "STATUS ENTREGA",
  ],
  // No modelo atual "STATUS DE AGENDAMENTO" vem vazio e o detalhe do agendamento
  // (ex: "AGENDAMENTO PELO CLIENTE PARA DIA 25/08/2026") fica em "AÇÃO REUNIÃO".
  status_agendamento_detalhe: ["STATUS DE AGENDAMENTO", "AÇÃO REUNIÃO", "ACAO REUNIAO"],
  // Só usado para detectar extravio; não é gravado.
  status_agendamento: ["STATUS AGENDAMENTO"],
  status_coleta: ["STATUS COLETA"],
  data_coleta: ["DATA COLETA"],
  previsao_coleta: ["DATA PREVISÃO COLETA", "DATA PREVISAO COLETA"],
  data_emissao_cte: ["DATA EMISSÃO CTE", "DATA EMISSAO CTE"],
  cte: ["CTE", "NUMERO CTE", "NÚMERO CTE", "NUMERO DO CTE", "NÚMERO DO CTE"],
  vendedor: ["VENDEDOR"],
  canal: ["CANAL"],
  gerente_contas: ["GERENTE DE CONTAS", "GERENTE DE CONTA"],
} as const;

/** Campos opcionais: só são gravados se a planilha tiver a coluna (ver `parseEntregas`). */
const CAMPOS_OPCIONAIS = [
  "data_entrega",
  "data_agendamento",
  "previsao_entrega",
  "previsao_entrega_inicial",
  "transportadora",
  "observacao",
  "status_entrega_planilha",
  "status_agendamento_detalhe",
  "status_coleta",
  "data_coleta",
  "previsao_coleta",
  "data_emissao_cte",
  "cte",
  "vendedor",
  "canal",
  "gerente_contas",
] as const satisfies readonly (keyof EntregaRow & keyof typeof COLS)[];

const norm = (s: unknown) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const texto = (v: unknown) => String(v ?? "").trim() || null;

// Cálculo de status original — sem alteração: prioriza Extraviada, depois
// olha só se as datas de entrega/agendamento/previsão estão preenchidas.
function inferirStatus(args: {
  extraviada: boolean;
  data_entrega: string | null;
  data_agendamento: string | null;
  previsao_entrega: string | null;
}): string {
  if (args.extraviada) return "Extraviada";
  if (args.data_entrega) return "Entregue";
  if (args.data_agendamento) return "Agendada";
  if (args.previsao_entrega) return "Com Previsão";
  return "Sem Previsão";
}

// Meses anteriores a julho/2026 não podem ser alterados por essa importação,
// mesmo que a planilha traga uma NF antiga por engano. (ISO compara como texto.)
const CUTOFF_ISO = "2026-07-01";

export type EntregasParseadas = {
  /** Uma por NF (a última linha da planilha vence, se a NF se repetir). */
  linhas: (Pick<EntregaRow, "numero" | "status"> & Partial<EntregaRow>)[];
  puladas: number;
  ignoradasPorData: number;
};

/**
 * Converte as linhas da planilha de Entregas em linhas de `nf_entregas`.
 *
 * Só entram no resultado os campos cujas colunas existem na planilha: se o
 * modelo da planilha não traz, por exemplo, "CANAL" ou "DATA EMISSÃO CTE", o
 * valor que já está salvo no banco é preservado (o upsert não sobrescreve com
 * vazio). Coluna presente mas com célula vazia continua limpando o campo.
 */
export function parseEntregas(rows: ExcelRow[]): EntregasParseadas {
  const presentes = new Set<string>(
    CAMPOS_OPCIONAIS.filter((campo) => hasCol(rows[0], ...COLS[campo])),
  );

  const dedup = new Map<string, EntregasParseadas["linhas"][number]>();
  let puladas = 0;
  let ignoradasPorData = 0;

  for (const r of rows) {
    const numero = String(pickCol(r, ...COLS.numero) ?? "")
      .trim()
      .replace(/\.0$/, "");
    if (!numero || numero === "undefined") {
      puladas++;
      continue;
    }

    const dataEmissaoNf = rowToBRDate(pickCol(r, ...COLS.emissao));
    if (dataEmissaoNf && dataEmissaoNf < CUTOFF_ISO) {
      ignoradasPorData++;
      continue;
    }

    const data_entrega = rowToBRDate(pickCol(r, ...COLS.data_entrega));
    let data_agendamento = rowToBRDate(pickCol(r, ...COLS.data_agendamento));
    const previsao_entrega = rowToBRDate(pickCol(r, ...COLS.previsao_entrega));
    const status_agendamento_detalhe = texto(pickFirst(r, ...COLS.status_agendamento_detalhe));

    // Quando a coluna "DATA AGENDAMENTO" está vazia, mas o detalhe do
    // agendamento já diz que o cliente marcou um dia (ex: "AGENDAMENTO PELO
    // CLIENTE PARA DIA 10/08/2026"), usa essa data como data de agendamento —
    // isso já basta pra NF virar "Agendada" e a data aparecer em "Data
    // Entrega" (o resto do sistema já sabe usar data_agendamento assim).
    if (!data_agendamento && status_agendamento_detalhe) {
      const m = status_agendamento_detalhe.match(/dia\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
      if (m) data_agendamento = parseBRDate(m[1]);
    }

    const observacao = texto(pickFirst(r, ...COLS.observacao));
    const status_entrega_planilha = texto(pickCol(r, ...COLS.status_entrega_planilha));
    const statusAgend = String(pickCol(r, ...COLS.status_agendamento) ?? "");

    const extraviada =
      norm(observacao).includes("extrav") ||
      norm(status_entrega_planilha).includes("extrav") ||
      norm(statusAgend).includes("extrav") ||
      norm(status_agendamento_detalhe).includes("extrav");

    const completa: EntregaRow = {
      numero,
      data_entrega,
      data_agendamento,
      previsao_entrega,
      previsao_entrega_inicial: rowToBRDate(pickCol(r, ...COLS.previsao_entrega_inicial)),
      status: inferirStatus({ extraviada, data_entrega, data_agendamento, previsao_entrega }),
      transportadora: texto(pickCol(r, ...COLS.transportadora)),
      observacao,
      status_coleta: texto(pickCol(r, ...COLS.status_coleta)),
      data_coleta: rowToBRDate(pickCol(r, ...COLS.data_coleta)),
      previsao_coleta: rowToBRDate(pickCol(r, ...COLS.previsao_coleta)),
      data_emissao_cte: rowToBRDate(pickCol(r, ...COLS.data_emissao_cte)),
      cte: texto(String(pickCol(r, ...COLS.cte) ?? "").replace(/\.0$/, "")),
      vendedor: texto(pickCol(r, ...COLS.vendedor)),
      canal: texto(pickCol(r, ...COLS.canal)),
      gerente_contas: texto(pickCol(r, ...COLS.gerente_contas)),
      status_entrega_planilha,
      status_agendamento_detalhe,
    };

    const linha: EntregasParseadas["linhas"][number] = {
      numero,
      status: completa.status,
    };
    for (const campo of presentes) {
      (linha as Record<string, unknown>)[campo] = completa[campo as keyof EntregaRow];
    }
    dedup.set(numero, linha);
  }

  return { linhas: Array.from(dedup.values()), puladas, ignoradasPorData };
}
