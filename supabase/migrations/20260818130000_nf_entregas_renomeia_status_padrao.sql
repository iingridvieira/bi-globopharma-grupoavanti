-- O status padrão "Não Coletada" (usado quando ainda não há nenhuma data de
-- entrega/agendamento/previsão) não tem relação nenhuma com a coleta física
-- (essa informação real vem da coluna "status_coleta"/"data_coleta", da
-- planilha). O nome parecido estava confundindo: o painel "Etapas do
-- Processo" mostra corretamente quantas NFs foram fisicamente coletadas, só
-- que o badge antigo "Não Coletada" quer dizer outra coisa (nenhuma data de
-- entrega conhecida ainda). Renomeia para "Sem Previsão", que não colide.
ALTER TABLE public.nf_entregas ALTER COLUMN status SET DEFAULT 'Sem Previsão';
UPDATE public.nf_entregas SET status = 'Sem Previsão' WHERE status = 'Não Coletada';

NOTIFY pgrst, 'reload schema';
