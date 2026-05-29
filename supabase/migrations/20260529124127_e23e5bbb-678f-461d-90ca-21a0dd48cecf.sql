CREATE TABLE public.pendencias_anteriores_produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL,
  codigo_produto text,
  ean text,
  data_lancamento date,
  produto text NOT NULL DEFAULT '',
  preco_unitario numeric NOT NULL DEFAULT 0,
  quantidade numeric NOT NULL DEFAULT 0,
  valor numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pendencias_anteriores_produtos TO authenticated;
GRANT ALL ON public.pendencias_anteriores_produtos TO service_role;

ALTER TABLE public.pendencias_anteriores_produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read pendencias_anteriores_produtos"
ON public.pendencias_anteriores_produtos FOR SELECT
TO authenticated USING (true);

CREATE POLICY "editor write pendencias_anteriores_produtos"
ON public.pendencias_anteriores_produtos FOR ALL
TO authenticated
USING ((auth.jwt() ->> 'email'::text) = 'avantipharma.comercial@gmail.com'::text)
WITH CHECK ((auth.jwt() ->> 'email'::text) = 'avantipharma.comercial@gmail.com'::text);