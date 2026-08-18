-- A planilha de Faturamento Sell In já traz a coluna "Nitro (S/N)" por item,
-- mas o sistema nunca capturava esse dado — só existia uma função
-- (mediaSemNitro) que tentava ADIVINHAR estatisticamente quais preços eram
-- "Nitro" (outliers extremos), sem usar a informação real da planilha.
ALTER TABLE public.itens_nf ADD COLUMN IF NOT EXISTS nitro boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_itens_nf_nitro ON public.itens_nf (nitro) WHERE nitro = true;

NOTIFY pgrst, 'reload schema';
