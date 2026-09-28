ALTER TABLE public.pedidos_enviados ADD COLUMN IF NOT EXISTS nitro boolean NOT NULL DEFAULT false;
NOTIFY pgrst, 'reload schema';