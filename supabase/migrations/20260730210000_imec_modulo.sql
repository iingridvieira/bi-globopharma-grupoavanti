-- Módulo BI IMEC — versão inicial, simplificada, do BI Globo Pharma.
-- Tabelas com prefixo "imec_" para não colidir com nada do BI Globo Pharma
-- (que tem suas próprias "clientes", "pedidos_enviados", "pedido_itens").
-- Nenhuma tabela existente é alterada por esta migration.
--
-- Diferente do BI Globo, aqui os pedidos são cadastrados manualmente
-- (sem importação de planilha) — por isso não há tabelas de importação/
-- notas fiscais/metas/pendências neste primeiro momento.

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
  status text NOT NULL DEFAULT 'aguardando' CHECK (status IN ('aguardando', 'aprovado')),
  ordem_compra text,
  prazo text,
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
