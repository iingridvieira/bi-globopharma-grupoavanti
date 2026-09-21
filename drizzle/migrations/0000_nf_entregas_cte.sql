ALTER TABLE public.nf_entregas ADD COLUMN IF NOT EXISTS cte text;

NOTIFY pgrst, 'reload schema';