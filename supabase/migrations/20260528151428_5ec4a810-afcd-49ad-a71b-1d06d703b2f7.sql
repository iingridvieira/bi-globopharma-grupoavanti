CREATE TABLE public.pendencias_produtos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL,
  codigo_produto TEXT,
  produto TEXT NOT NULL DEFAULT '',
  quantidade NUMERIC NOT NULL DEFAULT 0,
  valor NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pendencias_produtos TO authenticated;
GRANT ALL ON public.pendencias_produtos TO service_role;

ALTER TABLE public.pendencias_produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read pendencias_produtos"
ON public.pendencias_produtos
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "editor write pendencias_produtos"
ON public.pendencias_produtos
FOR ALL
TO authenticated
USING ((auth.jwt() ->> 'email') = 'avantipharma.comercial@gmail.com')
WITH CHECK ((auth.jwt() ->> 'email') = 'avantipharma.comercial@gmail.com');

CREATE INDEX idx_pendencias_produtos_cliente ON public.pendencias_produtos(cliente_id);