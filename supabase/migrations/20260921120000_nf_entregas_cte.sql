-- O modelo atual da planilha de entregas traz o NÚMERO do CTE (coluna "CTE")
-- em vez da data de emissão do CTE (coluna "DATA EMISSÃO CTE", que deixou de
-- existir). Sem esta coluna a etapa "Expedida" da linha do tempo nunca
-- acenderia para NFs importadas no modelo novo. "data_emissao_cte" continua
-- existindo (planilhas antigas e NFs já importadas).
ALTER TABLE public.nf_entregas
  ADD COLUMN IF NOT EXISTS cte text;

NOTIFY pgrst, 'reload schema';
