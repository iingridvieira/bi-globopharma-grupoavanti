-- Integração automática: Pedidos Enviados do BI Globo Pharma refletem no CRM
-- (representada "Globo" por enquanto), criando o cliente no CRM se necessário,
-- marcando o status do mês como "comprou" e registrando a data do pedido no
-- histórico de compras (crm_compras) — que é a fonte da "Última compra" do CRM.
--
-- public.crm_sync_pedido(...) contém a lógica compartilhada, usada por:
--  1) o trigger em pedidos_enviados (novos pedidos e edições, daqui pra frente)
--  2) public.crm_backfill_pedidos_globo(), chamada manualmente pela tela do CRM
--     para trazer todo o histórico de pedidos já existente de uma vez.
--
-- Escopo atual: somente public.pedidos_enviados -> representada "globo".
-- Não altera nada da tabela pedidos_enviados nem do restante do BI.

CREATE OR REPLACE FUNCTION public.crm_sync_pedido(
  p_user_id uuid,
  p_cliente_nome text,
  p_data date,
  p_representada_slug text DEFAULT 'globo'
) RETURNS void AS $$
DECLARE
  v_rep_id uuid;
  v_cliente_id uuid;
  v_cr_id uuid;
  v_mes_ref date;
BEGIN
  IF p_user_id IS NULL OR p_cliente_nome IS NULL OR p_data IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO v_rep_id FROM public.crm_representadas WHERE slug = p_representada_slug;
  IF v_rep_id IS NULL THEN
    RETURN; -- Representada ainda não existe no CRM.
  END IF;

  -- Cliente no CRM: busca por nome (case-insensitive) para o mesmo usuário;
  -- cria automaticamente se ainda não existir.
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

  -- Vínculo cliente <-> representada
  SELECT id INTO v_cr_id
  FROM public.crm_cliente_representadas
  WHERE cliente_id = v_cliente_id AND representada_id = v_rep_id;

  IF v_cr_id IS NULL THEN
    INSERT INTO public.crm_cliente_representadas (user_id, cliente_id, representada_id)
    VALUES (p_user_id, v_cliente_id, v_rep_id)
    ON CONFLICT (cliente_id, representada_id) DO UPDATE SET representada_id = EXCLUDED.representada_id
    RETURNING id INTO v_cr_id;
  END IF;

  -- Status do mês do pedido = "comprou" (não mexe em motivo/observações já preenchidos)
  v_mes_ref := date_trunc('month', p_data)::date;
  INSERT INTO public.crm_status_mensal (user_id, cliente_representada_id, mes_ref, status)
  VALUES (p_user_id, v_cr_id, v_mes_ref, 'comprou')
  ON CONFLICT (cliente_representada_id, mes_ref) DO UPDATE SET status = 'comprou', updated_at = now();

  -- Histórico de compras: a "Última compra" do CRM é sempre a data mais recente aqui.
  INSERT INTO public.crm_compras (user_id, cliente_representada_id, data_compra)
  VALUES (p_user_id, v_cr_id, p_data)
  ON CONFLICT (cliente_representada_id, data_compra) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger: toda vez que um pedido é criado ou tem cliente/data alterados
CREATE OR REPLACE FUNCTION public.crm_sync_pedido_enviado_trigger() RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
  v_nome_cliente text;
BEGIN
  v_user_id := COALESCE(NEW.created_by, auth.uid());
  SELECT nome INTO v_nome_cliente FROM public.clientes WHERE id = NEW.cliente_id;
  PERFORM public.crm_sync_pedido(v_user_id, v_nome_cliente, NEW.data, 'globo');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_crm_sync_pedido_enviado ON public.pedidos_enviados;
CREATE TRIGGER trg_crm_sync_pedido_enviado
  AFTER INSERT OR UPDATE OF cliente_id, data ON public.pedidos_enviados
  FOR EACH ROW EXECUTE FUNCTION public.crm_sync_pedido_enviado_trigger();

-- Importação retroativa: traz todo o histórico de Pedidos Enviados já
-- existente para o CRM de uma vez. Chamada manualmente (botão na tela de
-- Configurações do CRM), restrita a administradores. Pode ser rodada de novo
-- sem problema (idempotente — não duplica nada).
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
    SELECT c.nome AS cliente_nome, p.data AS data
    FROM public.pedidos_enviados p
    JOIN public.clientes c ON c.id = p.cliente_id
  LOOP
    PERFORM public.crm_sync_pedido(v_user_id, r.cliente_nome, r.data, 'globo');
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.crm_backfill_pedidos_globo() TO authenticated;
