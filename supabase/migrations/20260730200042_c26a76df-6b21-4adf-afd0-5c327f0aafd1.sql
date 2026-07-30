DROP FUNCTION IF EXISTS public.crm_sync_pedido(uuid, text, date, text);

CREATE OR REPLACE FUNCTION public.crm_sync_pedido(
  p_user_id uuid,
  p_cliente_nome text,
  p_data date,
  p_status text,
  p_representada_slug text DEFAULT 'globo'
) RETURNS void AS $$
DECLARE
  v_rep_id uuid;
  v_cliente_id uuid;
  v_cr_id uuid;
  v_mes_ref date;
  v_crm_status public.crm_cliente_status;
BEGIN
  IF p_user_id IS NULL OR p_cliente_nome IS NULL OR p_data IS NULL THEN
    RETURN;
  END IF;

  v_crm_status := CASE WHEN p_status = 'aprovado' THEN 'comprou' ELSE 'negociacao' END;

  SELECT id INTO v_rep_id FROM public.crm_representadas WHERE slug = p_representada_slug;
  IF v_rep_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO v_cliente_id
  FROM public.crm_clientes
  WHERE user_id = p_user_id AND lower(trim(nome)) = lower(trim(p_cliente_nome))
  LIMIT 1;

  IF v_cliente_id IS NULL THEN
    INSERT INTO public.crm_clientes (user_id, nome)
    VALUES (p_user_id, p_cliente_nome)
    ON CONFLICT (user_id, nome) DO UPDATE SET nome = EXCLUDED.nome
    RETURNING id INTO v_cliente_id;
  END IF;

  SELECT id INTO v_cr_id
  FROM public.crm_cliente_representadas
  WHERE cliente_id = v_cliente_id AND representada_id = v_rep_id;

  IF v_cr_id IS NULL THEN
    INSERT INTO public.crm_cliente_representadas (user_id, cliente_id, representada_id)
    VALUES (p_user_id, v_cliente_id, v_rep_id)
    ON CONFLICT (cliente_id, representada_id) DO UPDATE SET representada_id = EXCLUDED.representada_id
    RETURNING id INTO v_cr_id;
  END IF;

  v_mes_ref := date_trunc('month', p_data)::date;
  INSERT INTO public.crm_status_mensal (user_id, cliente_representada_id, mes_ref, status)
  VALUES (p_user_id, v_cr_id, v_mes_ref, v_crm_status)
  ON CONFLICT (cliente_representada_id, mes_ref) DO UPDATE SET status = v_crm_status, updated_at = now();

  IF v_crm_status = 'comprou' THEN
    INSERT INTO public.crm_compras (user_id, cliente_representada_id, data_compra)
    VALUES (p_user_id, v_cr_id, p_data)
    ON CONFLICT (cliente_representada_id, data_compra) DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.crm_sync_pedido_enviado_trigger() RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
  v_nome_cliente text;
BEGIN
  v_user_id := COALESCE(NEW.created_by, auth.uid());
  SELECT nome INTO v_nome_cliente FROM public.clientes WHERE id = NEW.cliente_id;
  PERFORM public.crm_sync_pedido(v_user_id, v_nome_cliente, NEW.data, NEW.status, 'globo');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_crm_sync_pedido_enviado ON public.pedidos_enviados;
CREATE TRIGGER trg_crm_sync_pedido_enviado
  AFTER INSERT OR UPDATE OF cliente_id, data, status ON public.pedidos_enviados
  FOR EACH ROW EXECUTE FUNCTION public.crm_sync_pedido_enviado_trigger();

CREATE OR REPLACE FUNCTION public.crm_backfill_pedidos_globo() RETURNS integer AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_count integer := 0;
  r RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'É preciso estar logado para importar o histórico do BI.';
  END IF;

  FOR r IN
    SELECT c.nome AS cliente_nome, p.data AS data, p.status AS status
    FROM public.pedidos_enviados p
    JOIN public.clientes c ON c.id = p.cliente_id
  LOOP
    PERFORM public.crm_sync_pedido(v_user_id, r.cliente_nome, r.data, r.status, 'globo');
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.crm_sync_pedido(uuid, text, date, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_backfill_pedidos_globo() TO authenticated;