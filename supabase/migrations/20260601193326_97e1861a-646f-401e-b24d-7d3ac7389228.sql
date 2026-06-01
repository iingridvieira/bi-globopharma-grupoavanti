CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.positivacao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  positivacao_total NUMERIC NOT NULL DEFAULT 0,
  positivacao_globo NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cliente_id, ano, mes)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.positivacao TO authenticated;
GRANT ALL ON public.positivacao TO service_role;

ALTER TABLE public.positivacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can read positivacao"
ON public.positivacao FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated can insert positivacao"
ON public.positivacao FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated can update positivacao"
ON public.positivacao FOR UPDATE TO authenticated USING (true);
CREATE POLICY "authenticated can delete positivacao"
ON public.positivacao FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_positivacao_updated_at
BEFORE UPDATE ON public.positivacao
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();