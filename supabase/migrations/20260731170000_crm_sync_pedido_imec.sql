-- Sincroniza os Pedidos Enviados do BI IMEC com o CRM (representada "Imec/Nutivit").
-- Diferente do BI Globo, o BI IMEC não tem etapa de aprovação: todo pedido lançado já
-- é considerado uma venda concretizada, então NUNCA passa pela etapa "em negociação" —
-- ele já entra direto como "comprou" e atualiza a "última compra" do cliente.
-- Reaproveita a função genérica public.crm_sync_pedido(...) criada para o BI Globo,
-- sempre chamando com p_status = 'aprovado' (o "sem negociação" pedido pela Ingrid).

CREATE OR REPLACE FUNCTION public.crm_sync_pedido_imec_trigger() RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
  v_nome_cliente text;
BEGIN
  v_user_id := COALESCE(NEW.created_by, auth.uid());
  SELECT nome INTO v_nome_cliente FROM public.imec_clientes WHERE id = NEW.cliente_id;
  PERFORM public.crm_sync_pedido(v_user_id, v_nome_cliente, NEW.data, 'aprovado', 'imec-nutivit');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_crm_sync_pedido_imec ON public.imec_pedidos_enviados;
CREATE TRIGGER trg_crm_sync_pedido_imec
  AFTER INSERT OR UPDATE OF cliente_id, data ON public.imec_pedidos_enviados
  FOR EACH ROW EXECUTE FUNCTION public.crm_sync_pedido_imec_trigger();

-- RPC de backfill: importa de uma vez todo o histórico de pedidos já lançados no BI
-- IMEC para o CRM (idempotente — pode rodar quantas vezes quiser, sem duplicar nada).
CREATE OR REPLACE FUNCTION public.crm_backfill_pedidos_imec() RETURNS integer AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_count integer := 0;
  r RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'É preciso estar logado para importar o histórico do BI IMEC.';
  END IF;

  FOR r IN
    SELECT c.nome AS cliente_nome, p.data AS data
    FROM public.imec_pedidos_enviados p
    JOIN public.imec_clientes c ON c.id = p.cliente_id
  LOOP
    PERFORM public.crm_sync_pedido(v_user_id, r.cliente_nome, r.data, 'aprovado', 'imec-nutivit');
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.crm_backfill_pedidos_imec() TO authenticated;

NOTIFY pgrst, 'reload schema';
