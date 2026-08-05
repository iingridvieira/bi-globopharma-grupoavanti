-- A Ficha Técnica usa nomes "oficiais" dos produtos, mas o arquivo de
-- faturamento real vem com uma escrita um pouco diferente (com sufixos como
-- "FARMA", "C/ 60 COMP", etc.). Como o casamento é por nome exato
-- (normalizado), cada variação de escrita precisa estar cadastrada.
--
-- Adiciona como "apelidos" (mesma EAN/código interno do produto oficial) as
-- variações reais encontradas na NF 006131 (GA COMERCIAL / NUTIVIT, 20/07),
-- identificadas pela Ingrid.
INSERT INTO public.imec_produtos (codigo_interno, produto, ean) VALUES
  ('0001.000013', 'IMECALCIO 1.250 C/ 60 COMP FARMA', '7898964832101'),
  ('0001.000012', 'IMECALCIO D3 500/400 C/ 60 COMP FARMA', '7898964832125'),
  ('0001.000014', 'IMECALCIO D3 600/400 C/ 60 COMP FARMA', '7898964832149'),
  ('0001.000002', 'IMECVIT C GOTAS 20ML', '7898964832071'),
  ('0001.000015', 'IMEGOV C/ 25 ENVELOPES FARMA', '7898964832163');

-- Preenche EAN/código interno dos itens de NF já lançados que agora batem
-- com esses apelidos novos.
UPDATE public.imec_itens_nf it
SET
  ean = COALESCE(it.ean, m.ean),
  codigo_produto = COALESCE(it.codigo_produto, m.codigo_interno)
FROM public.imec_match_produto(it.produto) m
WHERE it.ean IS NULL OR it.codigo_produto IS NULL;

-- Reavalia as NFs recentes com os novos casamentos.
SELECT public.imec_investimento_recheck_recentes();

NOTIFY pgrst, 'reload schema';
