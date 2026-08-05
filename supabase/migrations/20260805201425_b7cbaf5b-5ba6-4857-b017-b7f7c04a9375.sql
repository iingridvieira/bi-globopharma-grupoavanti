INSERT INTO public.imec_produtos (codigo_interno, produto, ean) VALUES
  ('0001.000013', 'IMECALCIO 1.250 C/ 60 COMP FARMA', '7898964832101'),
  ('0001.000012', 'IMECALCIO D3 500/400 C/ 60 COMP FARMA', '7898964832125'),
  ('0001.000014', 'IMECALCIO D3 600/400 C/ 60 COMP FARMA', '7898964832149'),
  ('0001.000002', 'IMECVIT C GOTAS 20ML', '7898964832071'),
  ('0001.000015', 'IMEGOV C/ 25 ENVELOPES FARMA', '7898964832163');

UPDATE public.imec_itens_nf it
SET
  ean = COALESCE(it.ean, (SELECT m.ean FROM public.imec_match_produto(it.produto) m)),
  codigo_produto = COALESCE(it.codigo_produto, (SELECT m.codigo_interno FROM public.imec_match_produto(it.produto) m))
WHERE it.ean IS NULL OR it.codigo_produto IS NULL;

SELECT public.imec_investimento_recheck_recentes();

UPDATE public.imec_investimento_precos
SET ean = '7898964832040'
WHERE ean = '7898964832033'
  AND public.imec_normalize_produto(produto) LIKE '%2000%';

NOTIFY pgrst, 'reload schema';