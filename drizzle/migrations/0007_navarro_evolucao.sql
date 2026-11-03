CREATE TABLE public.navarro_evolucao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regional text NOT NULL CHECK (regional IN ('SP','RJ','MG','ES','PR')),
  tipo text NOT NULL CHECK (tipo IN ('sell_in','sell_out')),
  ano integer NOT NULL,
  mes integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  valor numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE (regional,tipo,ano,mes)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.navarro_evolucao TO authenticated;
GRANT ALL ON public.navarro_evolucao TO service_role;
ALTER TABLE public.navarro_evolucao ENABLE ROW LEVEL SECURITY;
CREATE POLICY navarro_select ON public.navarro_evolucao FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY navarro_insert ON public.navarro_evolucao FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));
CREATE POLICY navarro_update ON public.navarro_evolucao FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));
CREATE POLICY navarro_delete ON public.navarro_evolucao FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));
CREATE TRIGGER navarro_touch BEFORE UPDATE ON public.navarro_evolucao FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();