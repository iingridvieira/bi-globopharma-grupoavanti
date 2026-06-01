
-- 1) Pendência anterior fixa por mês: adicionar ano/mes a pendencias_anteriores_produtos
ALTER TABLE public.pendencias_anteriores_produtos
  ADD COLUMN IF NOT EXISTS ano integer,
  ADD COLUMN IF NOT EXISTS mes integer;

-- Backfill: registros existentes recebem o mês/ano atual
UPDATE public.pendencias_anteriores_produtos
  SET ano = EXTRACT(YEAR FROM now())::int,
      mes = EXTRACT(MONTH FROM now())::int
  WHERE ano IS NULL OR mes IS NULL;

ALTER TABLE public.pendencias_anteriores_produtos
  ALTER COLUMN ano SET NOT NULL,
  ALTER COLUMN mes SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pend_ant_ano_mes ON public.pendencias_anteriores_produtos(ano, mes);
CREATE INDEX IF NOT EXISTS idx_pend_ant_cliente_ano_mes ON public.pendencias_anteriores_produtos(cliente_id, ano, mes);

-- 2) Restringir escrita em positivacao apenas ao e-mail autorizado
DROP POLICY IF EXISTS "authenticated can insert positivacao" ON public.positivacao;
DROP POLICY IF EXISTS "authenticated can update positivacao" ON public.positivacao;
DROP POLICY IF EXISTS "authenticated can delete positivacao" ON public.positivacao;

CREATE POLICY "editor manage positivacao"
ON public.positivacao
FOR ALL
TO authenticated
USING ((auth.jwt() ->> 'email') = 'avantipharma.comercial@gmail.com')
WITH CHECK ((auth.jwt() ->> 'email') = 'avantipharma.comercial@gmail.com');
