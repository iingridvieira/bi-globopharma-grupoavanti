CREATE TABLE public.imec_clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imec_clientes TO authenticated;
GRANT ALL ON public.imec_clientes TO service_role;
ALTER TABLE public.imec_clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "imec_clientes select" ON public.imec_clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "imec_clientes insert admin/editor" ON public.imec_clientes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));
CREATE POLICY "imec_clientes update admin/editor" ON public.imec_clientes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));
CREATE POLICY "imec_clientes delete admin/editor" ON public.imec_clientes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));

CREATE TABLE public.imec_pedidos_enviados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL,
  cliente_id uuid NOT NULL REFERENCES public.imec_clientes(id) ON DELETE RESTRICT,
  valor numeric(14,2) NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imec_pedidos_enviados TO authenticated;
GRANT ALL ON public.imec_pedidos_enviados TO service_role;
ALTER TABLE public.imec_pedidos_enviados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "imec_pedidos select" ON public.imec_pedidos_enviados FOR SELECT TO authenticated USING (true);
CREATE POLICY "imec_pedidos insert admin/editor" ON public.imec_pedidos_enviados FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));
CREATE POLICY "imec_pedidos update admin/editor" ON public.imec_pedidos_enviados FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));
CREATE POLICY "imec_pedidos delete admin/editor" ON public.imec_pedidos_enviados FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));

CREATE INDEX idx_imec_pedidos_data ON public.imec_pedidos_enviados(data);
CREATE INDEX idx_imec_pedidos_cliente ON public.imec_pedidos_enviados(cliente_id);
CREATE UNIQUE INDEX IF NOT EXISTS imec_pedidos_dedup_idx
  ON public.imec_pedidos_enviados (data, cliente_id, valor);

CREATE TABLE public.imec_pedido_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.imec_pedidos_enviados(id) ON DELETE CASCADE,
  ean text,
  descricao text NOT NULL,
  preco_passado numeric(14,4) NOT NULL DEFAULT 0,
  quantidade numeric(14,3) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imec_pedido_itens TO authenticated;
GRANT ALL ON public.imec_pedido_itens TO service_role;
ALTER TABLE public.imec_pedido_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "imec_itens select" ON public.imec_pedido_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "imec_itens insert admin/editor" ON public.imec_pedido_itens FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));
CREATE POLICY "imec_itens update admin/editor" ON public.imec_pedido_itens FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));
CREATE POLICY "imec_itens delete admin/editor" ON public.imec_pedido_itens FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));

CREATE INDEX idx_imec_itens_pedido ON public.imec_pedido_itens(pedido_id);

NOTIFY pgrst, 'reload schema';