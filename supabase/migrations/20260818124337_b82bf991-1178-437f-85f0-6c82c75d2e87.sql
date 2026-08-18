-- A planilha de entregas atual traz muito mais informação do que o sistema
-- lia até agora: status de COLETA e de ENTREGA já vêm prontos e mais
-- precisos (distinguem "no prazo" de "com atraso"), além de datas de
-- coleta/CTE e responsáveis (vendedor/canal/gerente de contas). Antes o
-- sistema ignorava tudo isso e recalculava um status mais grosseiro a
-- partir só da presença de datas.
ALTER TABLE public.nf_entregas
  ADD COLUMN IF NOT EXISTS status_coleta text,
  ADD COLUMN IF NOT EXISTS data_coleta date,
  ADD COLUMN IF NOT EXISTS previsao_coleta date,
  ADD COLUMN IF NOT EXISTS data_emissao_cte date,
  ADD COLUMN IF NOT EXISTS previsao_entrega_inicial date,
  ADD COLUMN IF NOT EXISTS vendedor text,
  ADD COLUMN IF NOT EXISTS canal text,
  ADD COLUMN IF NOT EXISTS gerente_contas text;

NOTIFY pgrst, 'reload schema';