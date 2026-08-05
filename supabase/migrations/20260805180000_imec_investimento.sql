-- Módulo de Investimento do BI IMEC: cada NF faturada gera (ou não) um valor de
-- investimento, calculado a partir da diferença entre o preço de custo do
-- distribuidor parceiro e o preço final repassado ao cliente, por produto
-- (mesma lógica da planilha "CALCULO INVESTIMENTO" usada hoje pela Ingrid).
-- A conta em si nunca aparece na tela — só o valor final por NF.

-- ===================== Tabela de preços (editável) =====================
-- Referência de custo/preço final por produto (EAN). A Ingrid pode editar a
-- qualquer momento pela própria tela do BI IMEC.
CREATE TABLE public.imec_investimento_precos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ean text NOT NULL,
  produto text NOT NULL,
  preco_custo numeric(14,4) NOT NULL DEFAULT 0,
  preco_final numeric(14,4) NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX imec_investimento_precos_ean_idx ON public.imec_investimento_precos (ean);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imec_investimento_precos TO authenticated;
GRANT ALL ON public.imec_investimento_precos TO service_role;
ALTER TABLE public.imec_investimento_precos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "imec_investimento_precos_select" ON public.imec_investimento_precos
  FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "imec_investimento_precos_insert" ON public.imec_investimento_precos
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor') OR public.has_role(auth.uid(),'representante'));
CREATE POLICY "imec_investimento_precos_update" ON public.imec_investimento_precos
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor') OR public.has_role(auth.uid(),'representante'))
  WITH CHECK (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor') OR public.has_role(auth.uid(),'representante'));
CREATE POLICY "imec_investimento_precos_delete" ON public.imec_investimento_precos
  FOR DELETE TO authenticated USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor') OR public.has_role(auth.uid(),'representante'));
CREATE TRIGGER imec_investimento_precos_touch BEFORE UPDATE ON public.imec_investimento_precos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Carga inicial a partir da planilha "CALCULO INVESTIMENTO" (preço custo =
-- Distr. Parceiro, preço final = Preço final ao cliente). Editável depois.
INSERT INTO public.imec_investimento_precos (ean, produto, preco_custo, preco_final) VALUES
  ('7898179710775', 'ALCOOL ETÍLICO 70 % FR 50 ML', 1.802, 1.8),
  ('7898179711048', 'ALUMIMEC 60 mg/ml (Hidróxido de Alumínio) FR 100 ML', 3.8, 3.8),
  ('7898179711291', 'ALUMIMEC 60 mg/ml (Hidróxido de Alumínio) FR 150 ML', 4.99, 4.99),
  ('7898179711307', 'ALUMIMEC 60 mg/ml (Hidróxido de Alumínio) FR 240 ML', 7.5, 7.5),
  ('7898179710065', 'DORMEC 100 MG C/ 200 COMP', 9, 7.995),
  ('7898179710041', 'DORMEC 100 MG C/ 500 COMP', 22.5, 20),
  ('7898179711314', 'GASTRIMEC 100ml (Hidróxido de Magnésio 80 mg) Leite de magnésio', 3.39, 3.39),
  ('7898179711024', 'GASTRIMEC COMPOSTO 100ml (Hidr. Alum. + Hidr.Magnésio)', 4.301, 4.3),
  ('7898179711277', 'GASTRIVAL COMPOSTO 240ml (Hidr. Alum. + Hidr.Magnésio+Simeticona)', 8.4915, 8),
  ('7898179710515', 'GASIMEC (SIMETICONA) 75 MG 15 ML/ML', 1.7, 1.7),
  ('7898179711123', 'ÓLEO MINERAL 100% FR 100 ML LARANJA', 4.5, 4.5),
  ('7898179711093', 'ÓLEO MINERAL TRADICIONAL 100% FR 100 ML', 4.5, 4.5),
  ('7898964832057', 'CLORETO DE MAGNÉSIO + OXIDO DE MAGNÉSIO P.A.', 6.54, 5.5),
  ('7898964832156', 'COMPLEXO B Comprimidos Fr. c/60 comp', 3.88, 3.3),
  ('7898964832101', 'IMECÁLCIO 1250 500 UI c/60 comp.', 10.19, 7.5),
  ('7898964832118', 'IMECÁLCIO 500/200 UI D3 Fr. c/60 comp', 10.1915, 7.5),
  ('7898964832132', 'IMECÁLCIO 600/200 UI D3 Fr. c/60 comp', 10.1915, 7.5),
  ('7898964832125', 'IMECÁLCIO 500/400 UI D3 Fr. c/60 comp', 10.19, 7.5),
  ('7898964832149', 'IMECÁLCIO 600/400 UI D3 Fr. c/60 comp', 10.19, 7.5),
  ('7898964832071', 'IMECVIT-C GOTAS 20 ML', 2.16, 1.809),
  ('7898964832194', 'IMECVIT-C 500mg c/ 20 comprimidos', 4.416, 3.588),
  ('7898964832163', 'IMEGOV 25 STRIPS C/ 6 UND', 36.62, 32),
  ('7898964832033', 'VITAMINA D3 1.000 UI Fr.c/30 comp', 4.0715, 3.3),
  ('7898964832033', 'VITAMINA D3 2.000 UI Fr. c/30 comp', 4.29, 3.3);
-- Nota: as duas últimas linhas vieram da planilha com o MESMO EAN (provável
-- erro de digitação na planilha original — os dois produtos são diferentes:
-- 1.000 UI e 2.000 UI). O cálculo já foi feito de forma que isso não gera
-- investimento duplicado, mas o ideal é a Ingrid corrigir o EAN certo de um
-- dos dois na tela de preços assim que souber qual é.

-- ===================== Acompanhamento por NF =====================
-- Só entra aqui a NF que realmente gera investimento (> 0). Guarda o
-- controle manual de status (cobrança/pagamento) por cima do valor calculado.
CREATE TABLE public.imec_investimento_nf (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_fiscal_id uuid NOT NULL UNIQUE REFERENCES public.imec_notas_fiscais(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'cobrado', 'pago')),
  data_cobranca date,
  data_pagamento date,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imec_investimento_nf TO authenticated;
GRANT ALL ON public.imec_investimento_nf TO service_role;
ALTER TABLE public.imec_investimento_nf ENABLE ROW LEVEL SECURITY;
CREATE POLICY "imec_investimento_nf_select" ON public.imec_investimento_nf
  FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "imec_investimento_nf_insert" ON public.imec_investimento_nf
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor') OR public.has_role(auth.uid(),'representante'));
CREATE POLICY "imec_investimento_nf_update" ON public.imec_investimento_nf
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor') OR public.has_role(auth.uid(),'representante'))
  WITH CHECK (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor') OR public.has_role(auth.uid(),'representante'));
CREATE POLICY "imec_investimento_nf_delete" ON public.imec_investimento_nf
  FOR DELETE TO authenticated USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor') OR public.has_role(auth.uid(),'representante'));
CREATE TRIGGER imec_investimento_nf_touch BEFORE UPDATE ON public.imec_investimento_nf
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===================== Cálculo (invisível na tela) =====================
-- Soma, por NF, quantidade x (preço custo - preço final) de cada item cujo
-- EAN bate com a tabela de preços ativa. Se houver preços duplicados para o
-- mesmo EAN (dado de origem com erro), usa sempre o mais recentemente
-- editado, para nunca contar o investimento em dobro.
CREATE OR REPLACE FUNCTION public.imec_calc_investimento_nf(p_nota_fiscal_id uuid) RETURNS numeric AS $$
  SELECT COALESCE(SUM(it.quantidade * (p.preco_custo - p.preco_final)), 0)
  FROM public.imec_itens_nf it
  JOIN LATERAL (
    SELECT pr.preco_custo, pr.preco_final
    FROM public.imec_investimento_precos pr
    WHERE pr.ativo AND trim(pr.ean) = trim(it.ean)
    ORDER BY pr.updated_at DESC
    LIMIT 1
  ) p ON true
  WHERE it.nota_fiscal_id = p_nota_fiscal_id;
$$ LANGUAGE sql STABLE SET search_path = public;

-- ===================== Acompanhamento automático =====================
-- Toda vez que os itens de uma NF são lançados/alterados, verifica se ela
-- passou a gerar investimento (> 0). Só cria o acompanhamento automático
-- para NFs dos últimos 2 meses (as mais antigas podem ser trazidas de volta
-- manualmente pela tela, se a Ingrid quiser).
CREATE OR REPLACE FUNCTION public.imec_investimento_autotrack_trigger() RETURNS TRIGGER AS $$
DECLARE
  v_nf_id uuid;
  v_data date;
BEGIN
  v_nf_id := COALESCE(NEW.nota_fiscal_id, OLD.nota_fiscal_id);
  SELECT data INTO v_data FROM public.imec_notas_fiscais WHERE id = v_nf_id;
  IF v_data IS NULL OR v_data < (current_date - interval '2 months')::date THEN
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

DROP TRIGGER IF EXISTS trg_imec_investimento_autotrack ON public.imec_itens_nf;
CREATE TRIGGER trg_imec_investimento_autotrack
  AFTER INSERT OR UPDATE OF ean, quantidade ON public.imec_itens_nf
  FOR EACH ROW EXECUTE FUNCTION public.imec_investimento_autotrack_trigger();

-- RPC: reavalia as NFs dos últimos 2 meses que ainda não estão acompanhadas
-- (usado tanto na carga inicial quanto no botão "Atualizar lista" da tela,
-- útil depois de editar a tabela de preços). Idempotente.
CREATE OR REPLACE FUNCTION public.imec_investimento_recheck_recentes() RETURNS integer AS $$
DECLARE
  v_count integer := 0;
  r RECORD;
BEGIN
  FOR r IN
    SELECT nf.id
    FROM public.imec_notas_fiscais nf
    WHERE nf.data >= (current_date - interval '2 months')::date
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

GRANT EXECUTE ON FUNCTION public.imec_investimento_recheck_recentes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.imec_calc_investimento_nf(uuid) TO authenticated;

-- Carga inicial: traz de uma vez as NFs dos últimos 2 meses que já geram
-- investimento (com base nos preços cadastrados acima).
SELECT public.imec_investimento_recheck_recentes();

NOTIFY pgrst, 'reload schema';
