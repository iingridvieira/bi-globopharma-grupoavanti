CREATE TABLE public.imec_metas_mensais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano integer NOT NULL CHECK (ano >= 2000 AND ano <= 2100),
  mes integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  valor numeric NOT NULL DEFAULT 0 CHECK (valor >= 0),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  UNIQUE (ano, mes)
);

GRANT SELECT ON public.imec_metas_mensais TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.imec_metas_mensais TO authenticated;
GRANT ALL ON public.imec_metas_mensais TO service_role;

ALTER TABLE public.imec_metas_mensais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "imec_metas_select"
ON public.imec_metas_mensais
FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid()));

CREATE POLICY "imec_metas_insert"
ON public.imec_metas_mensais
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "imec_metas_update"
ON public.imec_metas_mensais
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "imec_metas_delete"
ON public.imec_metas_mensais
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER imec_metas_touch
BEFORE UPDATE ON public.imec_metas_mensais
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();