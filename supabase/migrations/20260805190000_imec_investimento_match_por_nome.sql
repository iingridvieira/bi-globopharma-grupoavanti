-- O arquivo de origem das Notas Fiscais do BI IMEC não traz o EAN dos produtos
-- (confirmado em src/lib/imec-import.ts: o campo fica sempre nulo). Por isso o
-- casamento do investimento passa a ser feito pelo NOME do produto — ignorando
-- maiúsculas/minúsculas, acentos e espaços/pontuação — em vez do EAN. O EAN
-- continua funcionando como casamento adicional, caso um dia passe a ser
-- preenchido.

-- Normaliza um texto do mesmo jeito que o front-end já faz (normalizeKey):
-- minúsculas, sem acento, só letras e números.
CREATE OR REPLACE FUNCTION public.imec_normalize_produto(s text) RETURNS text AS $$
  SELECT regexp_replace(
    lower(
      translate(
        coalesce(s, ''),
        'áàâãäåéèêëíìîïóòôõöúùûüçñýÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑÝ',
        'aaaaaaeeeeiiiiooooouuuucnyAAAAAAEEEEIIIIOOOOOUUUUCNY'
      )
    ),
    '[^a-z0-9]+', '', 'g'
  );
$$ LANGUAGE sql IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.imec_calc_investimento_nf(p_nota_fiscal_id uuid) RETURNS numeric AS $$
  SELECT COALESCE(SUM(it.quantidade * (p.preco_custo - p.preco_final)), 0)
  FROM public.imec_itens_nf it
  JOIN LATERAL (
    SELECT pr.preco_custo, pr.preco_final
    FROM public.imec_investimento_precos pr
    WHERE pr.ativo
      AND (
        (it.ean IS NOT NULL AND trim(pr.ean) <> '' AND trim(pr.ean) = trim(it.ean))
        OR public.imec_normalize_produto(pr.produto) = public.imec_normalize_produto(it.produto)
      )
    ORDER BY pr.updated_at DESC
    LIMIT 1
  ) p ON true
  WHERE it.nota_fiscal_id = p_nota_fiscal_id;
$$ LANGUAGE sql STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION public.imec_normalize_produto(text) TO authenticated;

-- Reaplica a carga inicial com a nova regra de casamento.
SELECT public.imec_investimento_recheck_recentes();

NOTIFY pgrst, 'reload schema';
