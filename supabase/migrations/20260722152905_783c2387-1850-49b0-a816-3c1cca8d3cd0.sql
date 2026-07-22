
-- User-provided indexes
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_cliente ON public.notas_fiscais(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_enviados_cliente ON public.pedidos_enviados(cliente_id);

-- Novos campos no pedido (ordem de compra e prazo por pedido)
ALTER TABLE public.pedidos_enviados
  ADD COLUMN IF NOT EXISTS ordem_compra TEXT,
  ADD COLUMN IF NOT EXISTS prazo DATE;

-- Itens do pedido
CREATE TABLE IF NOT EXISTS public.pedido_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id UUID NOT NULL REFERENCES public.pedidos_enviados(id) ON DELETE CASCADE,
  ean TEXT,
  descricao TEXT NOT NULL,
  preco_passado NUMERIC(14,4) NOT NULL DEFAULT 0,
  quantidade NUMERIC(14,3) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedido_itens TO authenticated;
GRANT ALL ON public.pedido_itens TO service_role;

ALTER TABLE public.pedido_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read pedido_itens" ON public.pedido_itens
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin/repr manage pedido_itens" ON public.pedido_itens
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'representante'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'representante'::app_role));

CREATE INDEX IF NOT EXISTS idx_pedido_itens_pedido ON public.pedido_itens(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pedido_itens_ean ON public.pedido_itens(ean);

CREATE TRIGGER trg_pedido_itens_updated BEFORE UPDATE ON public.pedido_itens
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
