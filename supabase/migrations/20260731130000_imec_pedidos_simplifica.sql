-- Simplifica public.imec_pedidos_enviados: a tela de Pedidos Enviados do BI IMEC
-- passou a ter só Data, Cliente e Valor (sem itens, status, ordem de compra ou
-- prazo). Remove as colunas que deixaram de ser usadas.
ALTER TABLE public.imec_pedidos_enviados DROP COLUMN IF EXISTS status;
ALTER TABLE public.imec_pedidos_enviados DROP COLUMN IF EXISTS ordem_compra;
ALTER TABLE public.imec_pedidos_enviados DROP COLUMN IF EXISTS prazo;

-- A tabela de itens não é mais usada nesta tela (sem cadastro/visualização de
-- itens por pedido neste momento). Mantemos a tabela por enquanto (não apaga
-- dados), apenas deixa de ser referenciada pelo código.
