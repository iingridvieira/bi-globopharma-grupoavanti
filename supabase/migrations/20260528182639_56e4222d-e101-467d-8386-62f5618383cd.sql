
-- Ressincroniza sell_in a partir de notas_fiscais (fonte da verdade)
DELETE FROM public.sell_in;
INSERT INTO public.sell_in (cliente_id, ano, mes, valor)
SELECT cliente_id,
       EXTRACT(YEAR FROM data)::int AS ano,
       EXTRACT(MONTH FROM data)::int AS mes,
       SUM(valor)::numeric AS valor
FROM public.notas_fiscais
GROUP BY cliente_id, EXTRACT(YEAR FROM data)::int, EXTRACT(MONTH FROM data)::int;

-- Garante unique constraint para upserts futuros
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sell_in_cliente_ano_mes_key'
  ) THEN
    ALTER TABLE public.sell_in
      ADD CONSTRAINT sell_in_cliente_ano_mes_key UNIQUE (cliente_id, ano, mes);
  END IF;
END $$;
