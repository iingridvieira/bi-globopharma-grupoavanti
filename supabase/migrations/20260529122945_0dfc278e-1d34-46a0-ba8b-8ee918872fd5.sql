
CREATE TABLE public.metas_globo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano integer NOT NULL,
  mes integer NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE (ano, mes)
);

GRANT SELECT ON public.metas_globo TO authenticated;
GRANT ALL ON public.metas_globo TO service_role;

ALTER TABLE public.metas_globo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read metas_globo" ON public.metas_globo
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "editor manage metas_globo" ON public.metas_globo
  FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'email') = 'avantipharma.comercial@gmail.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'avantipharma.comercial@gmail.com');

GRANT INSERT, UPDATE, DELETE ON public.metas_globo TO authenticated;
