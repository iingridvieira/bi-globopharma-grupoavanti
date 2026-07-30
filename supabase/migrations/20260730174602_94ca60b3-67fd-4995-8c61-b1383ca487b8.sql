REVOKE EXECUTE ON FUNCTION public.crm_sync_pedido(uuid, text, date, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crm_sync_pedido_enviado_trigger() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crm_backfill_pedidos_globo() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_backfill_pedidos_globo() TO authenticated;