/**
 * Regra do relatório de faturamento: uma NF com qualquer linha de valor
 * negativo não é reconhecida — a nota inteira (e seus itens) fica de fora.
 */
export function notasComValorNegativo(
  linhas: ReadonlyArray<{ numero: string; valor: number }>,
): Set<string> {
  const negativas = new Set<string>();
  for (const l of linhas) if (l.numero && l.valor < 0) negativas.add(l.numero);
  return negativas;
}
