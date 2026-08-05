CREATE TABLE public.imec_notas_fiscais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL,
  numero text NOT NULL,
  empresa text NOT NULL DEFAULT 'IMEC',
  cliente_id uuid NOT NULL REFERENCES public.imec_clientes(id) ON DELETE CASCADE,
  razao_social text,
  valor numeric NOT NULL DEFAULT 0,
  observacao text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX imec_nf_numero_empresa_idx ON public.imec_notas_fiscais (numero, empresa);
CREATE INDEX imec_nf_data_idx ON public.imec_notas_fiscais (data);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imec_notas_fiscais TO authenticated;
GRANT ALL ON public.imec_notas_fiscais TO service_role;
ALTER TABLE public.imec_notas_fiscais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "imec_nf_select" ON public.imec_notas_fiscais FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "imec_nf_insert" ON public.imec_notas_fiscais FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor') OR public.has_role(auth.uid(),'representante'));
CREATE POLICY "imec_nf_update" ON public.imec_notas_fiscais FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor') OR public.has_role(auth.uid(),'representante')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor') OR public.has_role(auth.uid(),'representante'));
CREATE POLICY "imec_nf_delete" ON public.imec_notas_fiscais FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor') OR public.has_role(auth.uid(),'representante'));
CREATE TRIGGER imec_nf_touch BEFORE UPDATE ON public.imec_notas_fiscais FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.imec_itens_nf (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_fiscal_id uuid NOT NULL REFERENCES public.imec_notas_fiscais(id) ON DELETE CASCADE,
  codigo_produto text,
  produto text NOT NULL,
  ean text,
  quantidade numeric NOT NULL DEFAULT 0,
  valor_unitario numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX imec_itens_nf_nf_idx ON public.imec_itens_nf (nota_fiscal_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imec_itens_nf TO authenticated;
GRANT ALL ON public.imec_itens_nf TO service_role;
ALTER TABLE public.imec_itens_nf ENABLE ROW LEVEL SECURITY;
CREATE POLICY "imec_itens_nf_select" ON public.imec_itens_nf FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "imec_itens_nf_insert" ON public.imec_itens_nf FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor') OR public.has_role(auth.uid(),'representante'));
CREATE POLICY "imec_itens_nf_update" ON public.imec_itens_nf FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor') OR public.has_role(auth.uid(),'representante')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor') OR public.has_role(auth.uid(),'representante'));
CREATE POLICY "imec_itens_nf_delete" ON public.imec_itens_nf FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor') OR public.has_role(auth.uid(),'representante'));

CREATE TABLE public.imec_sell_in (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.imec_clientes(id) ON DELETE CASCADE,
  empresa text NOT NULL DEFAULT 'IMEC',
  ano integer NOT NULL,
  mes integer NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX imec_sell_in_unq ON public.imec_sell_in (cliente_id, empresa, ano, mes);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imec_sell_in TO authenticated;
GRANT ALL ON public.imec_sell_in TO service_role;
ALTER TABLE public.imec_sell_in ENABLE ROW LEVEL SECURITY;
CREATE POLICY "imec_sell_in_select" ON public.imec_sell_in FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "imec_sell_in_insert" ON public.imec_sell_in FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor') OR public.has_role(auth.uid(),'representante'));
CREATE POLICY "imec_sell_in_update" ON public.imec_sell_in FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor') OR public.has_role(auth.uid(),'representante')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor') OR public.has_role(auth.uid(),'representante'));
CREATE POLICY "imec_sell_in_delete" ON public.imec_sell_in FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor') OR public.has_role(auth.uid(),'representante'));
CREATE TRIGGER imec_sell_in_touch BEFORE UPDATE ON public.imec_sell_in FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

NOTIFY pgrst, 'reload schema';