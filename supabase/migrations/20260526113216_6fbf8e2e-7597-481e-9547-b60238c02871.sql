
CREATE TABLE public.descricoes_sell_in (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID,
  titulo TEXT,
  texto TEXT NOT NULL DEFAULT '',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.descricoes_sell_in ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read descricoes" ON public.descricoes_sell_in FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin/repr manage descricoes" ON public.descricoes_sell_in FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'representante'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'representante'::app_role));

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_descricoes_updated BEFORE UPDATE ON public.descricoes_sell_in
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Garante dedup de pedidos (mesma data + cliente + valor)
CREATE UNIQUE INDEX IF NOT EXISTS pedidos_dedup_idx ON public.pedidos_enviados (data, cliente_id, valor);

-- Garante dedup de notas fiscais por número
CREATE UNIQUE INDEX IF NOT EXISTS nfs_numero_idx ON public.notas_fiscais (numero);

CREATE INDEX IF NOT EXISTS itens_nf_idx ON public.itens_nf (nota_fiscal_id);
CREATE INDEX IF NOT EXISTS pedidos_data_idx ON public.pedidos_enviados (data);
CREATE INDEX IF NOT EXISTS nfs_data_idx ON public.notas_fiscais (data);
