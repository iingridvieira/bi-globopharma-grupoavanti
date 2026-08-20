ALTER TABLE public.itens_nf ADD COLUMN IF NOT EXISTS nitro boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_itens_nf_nitro ON public.itens_nf (nitro) WHERE nitro = true;

NOTIFY pgrst, 'reload schema';