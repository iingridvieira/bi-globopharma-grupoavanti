CREATE TABLE IF NOT EXISTS public.consolidado_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano integer NOT NULL,
  mes integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  campo text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE (ano, mes, campo)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consolidado_overrides TO authenticated;
GRANT ALL ON public.consolidado_overrides TO service_role;
ALTER TABLE public.consolidado_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consolidado_overrides_select_auth" ON public.consolidado_overrides FOR SELECT TO authenticated USING (true);
CREATE POLICY "consolidado_overrides_write_admin_editor" ON public.consolidado_overrides FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));
CREATE TRIGGER set_consolidado_overrides_updated_at BEFORE UPDATE ON public.consolidado_overrides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();