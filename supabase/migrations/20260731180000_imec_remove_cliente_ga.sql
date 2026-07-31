-- Remove o cliente "GA" da lista de clientes do BI IMEC (a Ingrid vai usar
-- "GA Comercial" a partir de agora). Antes de apagar, por segurança, qualquer
-- pedido que já tenha sido lançado para "GA" é transferido para "GA Comercial"
-- (assim nenhum pedido existente se perde, mesmo que "GA" já tenha sido usado).
DO $$
DECLARE
  v_ga_id uuid;
  v_ga_comercial_id uuid;
BEGIN
  SELECT id INTO v_ga_id FROM public.imec_clientes WHERE lower(trim(nome)) = 'ga';
  SELECT id INTO v_ga_comercial_id FROM public.imec_clientes WHERE lower(trim(nome)) = 'ga comercial';

  IF v_ga_id IS NOT NULL THEN
    IF v_ga_comercial_id IS NOT NULL THEN
      UPDATE public.imec_pedidos_enviados
      SET cliente_id = v_ga_comercial_id
      WHERE cliente_id = v_ga_id;
    END IF;

    DELETE FROM public.imec_clientes WHERE id = v_ga_id;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
