CREATE TABLE public.imec_pendencias_produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.imec_clientes(id) ON DELETE CASCADE,
  empresa text NOT NULL DEFAULT 'IMEC',
  codigo_produto text,
  produto text NOT NULL,
  numero_pedido text,
  data_emissao date,
  data_entrega date,
  preco_unitario numeric NOT NULL DEFAULT 0,
  quantidade numeric NOT NULL DEFAULT 0,
  valor numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX imec_pend_cliente_idx ON public.imec_pendencias_produtos (cliente_id);
CREATE INDEX imec_pend_empresa_idx ON public.imec_pendencias_produtos (empresa);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imec_pendencias_produtos TO authenticated;
GRANT ALL ON public.imec_pendencias_produtos TO service_role;

ALTER TABLE public.imec_pendencias_produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "imec_pend_select" ON public.imec_pendencias_produtos
  FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));

CREATE POLICY "imec_pend_insert" ON public.imec_pendencias_produtos
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor')
    OR public.has_role(auth.uid(),'representante')
  );

CREATE POLICY "imec_pend_update" ON public.imec_pendencias_produtos
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor')
    OR public.has_role(auth.uid(),'representante')
  ) WITH CHECK (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor')
    OR public.has_role(auth.uid(),'representante')
  );

CREATE POLICY "imec_pend_delete" ON public.imec_pendencias_produtos
  FOR DELETE TO authenticated USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor')
    OR public.has_role(auth.uid(),'representante')
  );

NOTIFY pgrst, 'reload schema';