ALTER TABLE public.imec_investimento_nf DROP CONSTRAINT IF EXISTS imec_investimento_nf_status_check;
UPDATE public.imec_investimento_nf SET status = 'programado' WHERE status = 'cobrado';
ALTER TABLE public.imec_investimento_nf
  ADD CONSTRAINT imec_investimento_nf_status_check
  CHECK (status IN ('pendente', 'programado', 'pago', 'nao_aplicado'));

CREATE OR REPLACE FUNCTION public.imec_investimento_autotrack_trigger() RETURNS TRIGGER AS $$
DECLARE
  v_nf_id uuid;
  v_data date;
BEGIN
  v_nf_id := COALESCE(NEW.nota_fiscal_id, OLD.nota_fiscal_id);
  SELECT data INTO v_data FROM public.imec_notas_fiscais WHERE id = v_nf_id;
  IF v_data IS NULL OR v_data < (current_date - interval '5 months')::date THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF public.imec_calc_investimento_nf(v_nf_id) > 0 THEN
    INSERT INTO public.imec_investimento_nf (nota_fiscal_id, status)
    VALUES (v_nf_id, 'pendente')
    ON CONFLICT (nota_fiscal_id) DO NOTHING;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.imec_investimento_recheck_recentes() RETURNS integer AS $$
DECLARE
  v_count integer := 0;
  r RECORD;
BEGIN
  FOR r IN
    SELECT nf.id
    FROM public.imec_notas_fiscais nf
    WHERE nf.data >= (current_date - interval '5 months')::date
      AND NOT EXISTS (SELECT 1 FROM public.imec_investimento_nf t WHERE t.nota_fiscal_id = nf.id)
  LOOP
    IF public.imec_calc_investimento_nf(r.id) > 0 THEN
      INSERT INTO public.imec_investimento_nf (nota_fiscal_id, status)
      VALUES (r.id, 'pendente')
      ON CONFLICT (nota_fiscal_id) DO NOTHING;
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

SELECT public.imec_investimento_recheck_recentes();

NOTIFY pgrst, 'reload schema';