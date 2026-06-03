ALTER TABLE public.itens_nf ADD COLUMN IF NOT EXISTS ean text;

UPDATE public.itens_nf i
SET ean = sub.ean
FROM (
  SELECT DISTINCT ON (produto) produto, ean
  FROM (
    SELECT produto, ean FROM public.pendencias_produtos WHERE ean IS NOT NULL AND produto IS NOT NULL
    UNION ALL
    SELECT produto, ean FROM public.pendencias_anteriores_produtos WHERE ean IS NOT NULL AND produto IS NOT NULL
  ) u
  ORDER BY produto, ean
) sub
WHERE i.ean IS NULL AND i.produto = sub.produto;

CREATE INDEX IF NOT EXISTS idx_itens_nf_ean ON public.itens_nf(ean);