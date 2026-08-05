-- O ajuste anterior (migration 20260805200000) comparava o texto exato do
-- produto pra corrigir o EAN da "VITAMINA D3 2.000 UI", e não funcionou (o
-- texto salvo no banco não bateu 100% com o esperado). Desta vez o
-- casamento é pelo EAN antigo (que está duplicado) + a palavra "2000" já
-- normalizada, bem mais tolerante a diferença de pontuação/acento.
UPDATE public.imec_investimento_precos
SET ean = '7898964832040'
WHERE ean = '7898964832033'
  AND public.imec_normalize_produto(produto) LIKE '%2000%';

NOTIFY pgrst, 'reload schema';
