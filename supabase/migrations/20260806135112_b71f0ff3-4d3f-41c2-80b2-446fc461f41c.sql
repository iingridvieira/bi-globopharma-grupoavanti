-- Mais 3 variações reais de nome de produto encontradas numa NF (mesma
-- causa das anteriores: a escrita do arquivo de faturamento difere da Ficha
-- Técnica). Apelidos do mesmo produto (mesmo EAN/código interno).
INSERT INTO public.imec_produtos (codigo_interno, produto, ean) VALUES
  ('0001.000005', 'IMECALCIO D3 500/200 C/ 60 COMP FARMA', '7898964832118'),
  ('0001.000009', 'COMPLEXO B C/ 60 COMP', '7898964832156'),
  ('0001.000010', 'CLORETO DE MAGNÉSIO C/ 60 COMP FARMA', '7898964832057');

UPDATE public.imec_itens_nf it
SET
  ean = COALESCE(it.ean, (SELECT m.ean FROM public.imec_match_produto(it.produto) m)),
  codigo_produto = COALESCE(it.codigo_produto, (SELECT m.codigo_interno FROM public.imec_match_produto(it.produto) m))
WHERE it.ean IS NULL OR it.codigo_produto IS NULL;

SELECT public.imec_investimento_recheck_recentes();

NOTIFY pgrst, 'reload schema';