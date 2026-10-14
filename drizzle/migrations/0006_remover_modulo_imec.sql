DROP TRIGGER IF EXISTS trg_imec_enrich_item_nf ON public.imec_itens_nf;
DROP TRIGGER IF EXISTS trg_imec_investimento_autotrack ON public.imec_itens_nf;
DROP TRIGGER IF EXISTS trg_crm_sync_pedido_imec ON public.imec_pedidos_enviados;

DROP FUNCTION IF EXISTS public.imec_calc_investimento_nf(uuid);
DROP FUNCTION IF EXISTS public.imec_enrich_item_nf_trigger();
DROP FUNCTION IF EXISTS public.imec_investimento_autotrack_trigger();
DROP FUNCTION IF EXISTS public.imec_investimento_recheck_recentes();
DROP FUNCTION IF EXISTS public.imec_match_produto(text);
DROP FUNCTION IF EXISTS public.imec_normalize_produto(text);
DROP FUNCTION IF EXISTS public.crm_backfill_pedidos_imec();
DROP FUNCTION IF EXISTS public.crm_sync_pedido_imec_trigger();

COMMENT ON TABLE public.imec_clientes IS 'DEPRECATED: módulo BI IMEC/Nutivit removido do aplicativo; tabela mantida vazia.';
COMMENT ON TABLE public.imec_notas_fiscais IS 'DEPRECATED: módulo BI IMEC/Nutivit removido do aplicativo; tabela mantida vazia.';
COMMENT ON TABLE public.imec_itens_nf IS 'DEPRECATED: módulo BI IMEC/Nutivit removido do aplicativo; tabela mantida vazia.';
COMMENT ON TABLE public.imec_pedidos_enviados IS 'DEPRECATED: módulo BI IMEC/Nutivit removido do aplicativo; tabela mantida vazia.';
COMMENT ON TABLE public.imec_pedido_itens IS 'DEPRECATED: módulo BI IMEC/Nutivit removido do aplicativo; tabela mantida vazia.';
COMMENT ON TABLE public.imec_pendencias_produtos IS 'DEPRECATED: módulo BI IMEC/Nutivit removido do aplicativo; tabela mantida vazia.';
COMMENT ON TABLE public.imec_sell_in IS 'DEPRECATED: módulo BI IMEC/Nutivit removido do aplicativo; tabela mantida vazia.';
COMMENT ON TABLE public.imec_sell_out IS 'DEPRECATED: módulo BI IMEC/Nutivit removido do aplicativo; tabela mantida vazia.';
COMMENT ON TABLE public.imec_metas_mensais IS 'DEPRECATED: módulo BI IMEC/Nutivit removido do aplicativo; tabela mantida vazia.';
COMMENT ON TABLE public.imec_produtos IS 'DEPRECATED: módulo BI IMEC/Nutivit removido do aplicativo; tabela mantida vazia.';
COMMENT ON TABLE public.imec_investimento_nf IS 'DEPRECATED: módulo BI IMEC/Nutivit removido do aplicativo; tabela mantida vazia.';
COMMENT ON TABLE public.imec_investimento_precos IS 'DEPRECATED: módulo BI IMEC/Nutivit removido do aplicativo; tabela mantida vazia.';