-- Corrige uma lacuna na integração CRM <-> Pedidos Enviados: os gatilhos só sabiam
-- reagir a pedido novo/editado, nunca a pedido EXCLUÍDO. Resultado: ao apagar um
-- pedido, o CRM continuava mostrando o status do mês e a "última compra" antigos,
-- como se o pedido ainda existisse.
--
-- Agora, sempre que um pedido é apagado (ou tem cliente/data alterados), o mês e
-- cliente afetados são recalculados do zero a partir do que realmente resta no
-- banco: se não sobrar nenhum pedido daquele cliente naquele mês, o status volta
-- para "não comprou" e a data deixa de contar como última compra.

-- ===================== BI IMEC =====================

CREATE OR REPLACE FUNCTION public.crm_recompute_pedido_imec(
  p_user_id uuid,
  p_imec_cliente_id uuid,
  p_mes_ref date
) RETURNS void AS $$
DECLARE
  v_nome_cliente text;
  v_rep_id uuid;
  v_cliente_id uuid;
  v_cr_id uuid;
  v_tem_pedido boolean;
BEGIN
  IF p_user_id IS NULL OR p_imec_cliente_id IS NULL OR p_mes_ref IS NULL THEN
    RETURN;
  END IF;

  SELECT nome INTO v_nome_cliente FROM public.imec_clientes WHERE id = p_imec_cliente_id;
  IF v_nome_cliente IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO v_rep_id FROM public.crm_representadas WHERE slug = 'imec-nutivit';
  IF v_rep_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO v_cliente_id
  FROM public.crm_clientes
  WHERE user_id = p_user_id AND lower(trim(nome)) = lower(trim(v_nome_cliente))
  LIMIT 1;
  IF v_cliente_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO v_cr_id
  FROM public.crm_cliente_representadas
  WHERE cliente_id = v_cliente_id AND representada_id = v_rep_id;
  IF v_cr_id IS NULL THEN
    RETURN;
  END IF;

  -- Ainda existe algum pedido desse cliente nesse mês (considerando o que restou
  -- no banco, não o pedido que foi apagado/movido)?
  SELECT EXISTS (
    SELECT 1
    FROM public.imec_pedidos_enviados p
    JOIN public.imec_clientes c ON c.id = p.cliente_id
    WHERE lower(trim(c.nome)) = lower(trim(v_nome_cliente))
      AND date_trunc('month', p.data)::date = p_mes_ref
  ) INTO v_tem_pedido;

  INSERT INTO public.crm_status_mensal (user_id, cliente_representada_id, mes_ref, status)
  VALUES (
    p_user_id, v_cr_id, p_mes_ref,
    CASE WHEN v_tem_pedido THEN 'comprou' ELSE 'nao_comprou' END
  )
  ON CONFLICT (cliente_representada_id, mes_ref) DO UPDATE
    SET status = CASE WHEN v_tem_pedido THEN 'comprou' ELSE 'nao_comprou' END, updated_at = now();

  -- Remove da "última compra" as datas desse mês que não têm mais nenhum pedido.
  DELETE FROM public.crm_compras cco
  WHERE cco.cliente_representada_id = v_cr_id
    AND date_trunc('month', cco.data_compra)::date = p_mes_ref
    AND NOT EXISTS (
      SELECT 1 FROM public.imec_pedidos_enviados p2
      JOIN public.imec_clientes c2 ON c2.id = p2.cliente_id
      WHERE lower(trim(c2.nome)) = lower(trim(v_nome_cliente))
        AND p2.data = cco.data_compra
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.crm_sync_pedido_imec_trigger() RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
  v_nome_cliente text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.crm_recompute_pedido_imec(
      COALESCE(OLD.created_by, auth.uid()), OLD.cliente_id, date_trunc('month', OLD.data)::date
    );
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND (NEW.cliente_id IS DISTINCT FROM OLD.cliente_id OR NEW.data IS DISTINCT FROM OLD.data) THEN
    PERFORM public.crm_recompute_pedido_imec(
      COALESCE(OLD.created_by, auth.uid()), OLD.cliente_id, date_trunc('month', OLD.data)::date
    );
  END IF;

  v_user_id := COALESCE(NEW.created_by, auth.uid());
  SELECT nome INTO v_nome_cliente FROM public.imec_clientes WHERE id = NEW.cliente_id;
  PERFORM public.crm_sync_pedido(v_user_id, v_nome_cliente, NEW.data, 'aprovado', 'imec-nutivit');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_crm_sync_pedido_imec ON public.imec_pedidos_enviados;
CREATE TRIGGER trg_crm_sync_pedido_imec
  AFTER INSERT OR DELETE OR UPDATE OF cliente_id, data ON public.imec_pedidos_enviados
  FOR EACH ROW EXECUTE FUNCTION public.crm_sync_pedido_imec_trigger();

-- ===================== BI Globo Pharma =====================
-- Mesma correção, para o mesmo problema que também existia na integração original
-- do BI Globo com o CRM (não altera nada da tela/funcionalidade do BI Globo em si,
-- só o "cano" interno que liga os pedidos ao CRM).

CREATE OR REPLACE FUNCTION public.crm_recompute_pedido_globo(
  p_user_id uuid,
  p_bi_cliente_id uuid,
  p_mes_ref date
) RETURNS void AS $$
DECLARE
  v_nome_cliente text;
  v_rep_id uuid;
  v_cliente_id uuid;
  v_cr_id uuid;
  v_tem_aprovado boolean;
  v_tem_aguardando boolean;
  v_novo_status public.crm_cliente_status;
BEGIN
  IF p_user_id IS NULL OR p_bi_cliente_id IS NULL OR p_mes_ref IS NULL THEN
    RETURN;
  END IF;

  SELECT nome INTO v_nome_cliente FROM public.clientes WHERE id = p_bi_cliente_id;
  IF v_nome_cliente IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO v_rep_id FROM public.crm_representadas WHERE slug = 'globo';
  IF v_rep_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO v_cliente_id
  FROM public.crm_clientes
  WHERE user_id = p_user_id AND lower(trim(nome)) = lower(trim(v_nome_cliente))
  LIMIT 1;
  IF v_cliente_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO v_cr_id
  FROM public.crm_cliente_representadas
  WHERE cliente_id = v_cliente_id AND representada_id = v_rep_id;
  IF v_cr_id IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.pedidos_enviados p
    JOIN public.clientes c ON c.id = p.cliente_id
    WHERE lower(trim(c.nome)) = lower(trim(v_nome_cliente))
      AND date_trunc('month', p.data)::date = p_mes_ref AND p.status = 'aprovado'
  ) INTO v_tem_aprovado;

  SELECT EXISTS (
    SELECT 1 FROM public.pedidos_enviados p
    JOIN public.clientes c ON c.id = p.cliente_id
    WHERE lower(trim(c.nome)) = lower(trim(v_nome_cliente))
      AND date_trunc('month', p.data)::date = p_mes_ref AND p.status <> 'aprovado'
  ) INTO v_tem_aguardando;

  v_novo_status := CASE
    WHEN v_tem_aprovado THEN 'comprou'
    WHEN v_tem_aguardando THEN 'negociacao'
    ELSE 'nao_comprou'
  END;

  INSERT INTO public.crm_status_mensal (user_id, cliente_representada_id, mes_ref, status)
  VALUES (p_user_id, v_cr_id, p_mes_ref, v_novo_status)
  ON CONFLICT (cliente_representada_id, mes_ref) DO UPDATE
    SET status = v_novo_status, updated_at = now();

  DELETE FROM public.crm_compras cco
  WHERE cco.cliente_representada_id = v_cr_id
    AND date_trunc('month', cco.data_compra)::date = p_mes_ref
    AND NOT EXISTS (
      SELECT 1 FROM public.pedidos_enviados p2
      JOIN public.clientes c2 ON c2.id = p2.cliente_id
      WHERE lower(trim(c2.nome)) = lower(trim(v_nome_cliente))
        AND p2.data = cco.data_compra AND p2.status = 'aprovado'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.crm_sync_pedido_enviado_trigger() RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
  v_nome_cliente text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.crm_recompute_pedido_globo(
      COALESCE(OLD.created_by, auth.uid()), OLD.cliente_id, date_trunc('month', OLD.data)::date
    );
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND (NEW.cliente_id IS DISTINCT FROM OLD.cliente_id OR NEW.data IS DISTINCT FROM OLD.data) THEN
    PERFORM public.crm_recompute_pedido_globo(
      COALESCE(OLD.created_by, auth.uid()), OLD.cliente_id, date_trunc('month', OLD.data)::date
    );
  END IF;

  v_user_id := COALESCE(NEW.created_by, auth.uid());
  SELECT nome INTO v_nome_cliente FROM public.clientes WHERE id = NEW.cliente_id;
  PERFORM public.crm_sync_pedido(v_user_id, v_nome_cliente, NEW.data, NEW.status, 'globo');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_crm_sync_pedido_enviado ON public.pedidos_enviados;
CREATE TRIGGER trg_crm_sync_pedido_enviado
  AFTER INSERT OR DELETE OR UPDATE OF cliente_id, data, status ON public.pedidos_enviados
  FOR EACH ROW EXECUTE FUNCTION public.crm_sync_pedido_enviado_trigger();

NOTIFY pgrst, 'reload schema';
