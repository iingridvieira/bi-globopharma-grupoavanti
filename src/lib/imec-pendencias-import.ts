import * as XLSX from "xlsx";
import { parseBRDate, parseBRNumber } from "./format";
import {
  empresaFromSheetName,
  localizarCabecalho,
  norm,
  padronizarCliente,
  type Empresa,
} from "./imec-import";

export type ImecPendenciaLinha = {
  empresa: Empresa;
  clientePadrao: string;
  codigoProduto: string;
  produto: string;
  numeroPedido: string;
  dataEmissao: string | null;
  dataEntrega: string | null;
  precoUnitario: number;
  quantidade: number;
  valor: number;
};

/**
 * Planilha de "Pedidos em Aberto" (backlog de pedidos ainda não faturados) —
 * uma linha por item de pedido. Colunas do modelo atual (ex: "PENDENCIAS
 * AVANTI.xlsx"): Codigo do Produto, Descricao Auxiliar, Numero do Pedido,
 * Data da Emissao, Data da Entrega, Nome do cliente, Quantidade Vendida,
 * Preco Unitario Liquido, Valor Total do Item.
 */
const ALVOS = {
  codigo: ["codigodoproduto", "codigoproduto"],
  produto: ["descricaoauxiliar", "descricao", "produto"],
  numeroPedido: ["numerodopedido", "numeropedido"],
  cliente: ["nomedocliente", "razaosocial", "nome"],
  dataEmissao: ["datadaemissao", "dataemissao"],
  dataEntrega: ["datadaentrega", "dataentrega"],
  quantidade: ["quantidadevendida", "quantidade"],
  precoUnitario: ["precounitarioliquido", "precounitario", "vlrunitario"],
  valorTotal: ["valortotaldoitem", "valortotal", "vlrtotal"],
} as const;

function lerAbaPendencias(ws: XLSX.WorkSheet, empresa: Empresa): ImecPendenciaLinha[] {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: "" });
  const { headerIdx, header } = localizarCabecalho(matrix, ALVOS.cliente);

  const col = (alvos: readonly string[]) => header.findIndex((h) => alvos.includes(h));
  const iCodigo = col(ALVOS.codigo);
  const iProduto = col(ALVOS.produto);
  const iNumPedido = col(ALVOS.numeroPedido);
  const iCliente = col(ALVOS.cliente);
  const iEmissao = col(ALVOS.dataEmissao);
  const iEntrega = col(ALVOS.dataEntrega);
  const iQtd = col(ALVOS.quantidade);
  const iPreco = col(ALVOS.precoUnitario);
  const iTotal = col(ALVOS.valorTotal);

  const out: ImecPendenciaLinha[] = [];
  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const r = matrix[i] ?? [];
    const clienteRaw = iCliente >= 0 ? String(r[iCliente] ?? "").trim() : "";
    const produto = iProduto >= 0 ? String(r[iProduto] ?? "").trim() : "";
    if (!clienteRaw || !produto) continue;

    const clientePadrao = padronizarCliente(clienteRaw);
    if (!clientePadrao) continue;

    out.push({
      empresa,
      clientePadrao,
      codigoProduto: iCodigo >= 0 ? String(r[iCodigo] ?? "").trim() : "",
      produto,
      numeroPedido: iNumPedido >= 0 ? String(r[iNumPedido] ?? "").trim() : "",
      dataEmissao: iEmissao >= 0 ? parseBRDate(r[iEmissao]) : null,
      dataEntrega: iEntrega >= 0 ? parseBRDate(r[iEntrega]) : null,
      precoUnitario: iPreco >= 0 ? parseBRNumber(r[iPreco]) : 0,
      quantidade: iQtd >= 0 ? parseBRNumber(r[iQtd]) : 0,
      valor: iTotal >= 0 ? parseBRNumber(r[iTotal]) : 0,
    });
  }
  return out;
}

/**
 * Lê a planilha de Pendências (pedidos em aberto) do IMEC/NUTIVIT.
 * Mesma convenção da planilha de Faturamento: uma aba por empresa, nomeada
 * "IMEC" e/ou "NUTIVIT". Se nenhuma aba tiver esses nomes, usa a primeira
 * aba do arquivo e assume `empresaPadrao`.
 */
export async function lerPlanilhaPendenciasImec(
  file: File,
  empresaPadrao: Empresa = "IMEC",
): Promise<ImecPendenciaLinha[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });

  const abasPorEmpresa = wb.SheetNames.map((name) => ({
    name,
    empresa: empresaFromSheetName(name),
  })).filter((s): s is { name: string; empresa: Empresa } => s.empresa !== null);
  if (abasPorEmpresa.length > 0) {
    return abasPorEmpresa.flatMap(({ name, empresa }) =>
      lerAbaPendencias(wb.Sheets[name], empresa),
    );
  }

  return lerAbaPendencias(wb.Sheets[wb.SheetNames[0]], empresaPadrao);
}

export { norm };
