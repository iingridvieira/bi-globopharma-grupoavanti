ALTER TABLE public.pendencias_produtos
  ADD COLUMN IF NOT EXISTS ean text,
  ADD COLUMN IF NOT EXISTS data_lancamento date,
  ADD COLUMN IF NOT EXISTS preco_unitario numeric NOT NULL DEFAULT 0;