-- Guarda separadamente o status "bruto" que a própria planilha traz pra
-- entrega (ex: "ENTREGUE - ATRASADO") e o detalhe de agendamento (ex:
-- "AGENDAMENTO PELO CLIENTE PARA DIA 10/08/2026"), sem mexer no cálculo
-- automático de status já existente (coluna "status") — esse continua
-- funcionando exatamente como antes. Os campos novos servem só para a
-- visualização em etapas (agendada/coletada/expedida/entregue).
ALTER TABLE public.nf_entregas
  ADD COLUMN IF NOT EXISTS status_entrega_planilha text,
  ADD COLUMN IF NOT EXISTS status_agendamento_detalhe text;

NOTIFY pgrst, 'reload schema';
