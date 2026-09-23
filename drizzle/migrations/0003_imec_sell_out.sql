CREATE TABLE public.imec_sell_out (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.imec_clientes(id) ON DELETE CASCADE,
  ano integer NOT NULL,
  mes integer NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, ano, mes)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imec_sell_out TO authenticated;
GRANT ALL ON public.imec_sell_out TO service_role;
ALTER TABLE public.imec_sell_out ENABLE ROW LEVEL SECURITY;
CREATE POLICY imec_so_select ON public.imec_sell_out FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY imec_so_insert ON public.imec_sell_out FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY imec_so_update ON public.imec_sell_out FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY imec_so_delete ON public.imec_sell_out FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
NOTIFY pgrst, 'reload schema';