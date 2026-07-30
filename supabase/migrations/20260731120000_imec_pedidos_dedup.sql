-- Índice único para permitir "colar manualmente" (upsert com ignoreDuplicates)
-- na tela de Pedidos Enviados do BI IMEC, igual ao já existente no BI Globo
-- (pedidos_dedup_idx em public.pedidos_enviados).
CREATE UNIQUE INDEX IF NOT EXISTS imec_pedidos_dedup_idx
  ON public.imec_pedidos_enviados (data, cliente_id, valor);
