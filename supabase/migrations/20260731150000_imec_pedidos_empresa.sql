-- Adiciona a origem do pedido (IMEC ou NUTIVIT) em imec_pedidos_enviados,
-- exibida como badge na tela de Pedidos Enviados.
ALTER TABLE public.imec_pedidos_enviados
  ADD COLUMN IF NOT EXISTS empresa text NOT NULL DEFAULT 'IMEC' CHECK (empresa IN ('IMEC', 'NUTIVIT'));

-- Atualiza o índice de dedup do "colar em massa" para considerar a empresa
-- (pedidos de empresas diferentes não devem ser tratados como duplicados).
DROP INDEX IF EXISTS imec_pedidos_dedup_idx;
CREATE UNIQUE INDEX IF NOT EXISTS imec_pedidos_dedup_idx
  ON public.imec_pedidos_enviados (data, cliente_id, valor, empresa);
