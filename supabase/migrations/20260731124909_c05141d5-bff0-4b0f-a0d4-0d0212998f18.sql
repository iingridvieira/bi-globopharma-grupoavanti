ALTER TABLE public.imec_pedidos_enviados
  ADD COLUMN IF NOT EXISTS empresa text NOT NULL DEFAULT 'IMEC' CHECK (empresa IN ('IMEC', 'NUTIVIT'));

DROP INDEX IF EXISTS imec_pedidos_dedup_idx;
CREATE UNIQUE INDEX IF NOT EXISTS imec_pedidos_dedup_idx
  ON public.imec_pedidos_enviados (data, cliente_id, valor, empresa);