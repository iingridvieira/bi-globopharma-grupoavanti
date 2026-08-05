-- Catálogo mestre de produtos do BI IMEC, a partir das Fichas Técnicas
-- (FARMA e SUP) enviadas pela Ingrid: código interno, nome oficial e EAN por
-- produto. Serve de referência para "traduzir" a descrição solta que vem no
-- arquivo de faturamento (que não tem EAN nem código) em dados confiáveis,
-- usados tanto na tela de Notas Fiscais quanto no cálculo de investimento.

CREATE TABLE public.imec_produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_interno text NOT NULL,
  produto text NOT NULL,
  ean text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX imec_produtos_ean_idx ON public.imec_produtos (ean);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imec_produtos TO authenticated;
GRANT ALL ON public.imec_produtos TO service_role;
ALTER TABLE public.imec_produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "imec_produtos_select" ON public.imec_produtos
  FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "imec_produtos_insert" ON public.imec_produtos
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor') OR public.has_role(auth.uid(),'representante'));
CREATE POLICY "imec_produtos_update" ON public.imec_produtos
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor') OR public.has_role(auth.uid(),'representante'))
  WITH CHECK (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor') OR public.has_role(auth.uid(),'representante'));
CREATE POLICY "imec_produtos_delete" ON public.imec_produtos
  FOR DELETE TO authenticated USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor') OR public.has_role(auth.uid(),'representante'));
CREATE TRIGGER imec_produtos_touch BEFORE UPDATE ON public.imec_produtos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.imec_produtos (codigo_interno, produto, ean) VALUES
  ('0001.000001', 'DORMEC 100 mg', '7898179710065'),
  ('0001.000002', 'DORMEC 100 mg', '7898179710041'),
  ('0001.000005', 'ÓLEO MINERAL 100%', '7898179711093'),
  ('0001.000066', 'LEITE DE MAGNÉSIA GASTRIMEC', '7898179711314'),
  ('0001.000012', 'ALUMIMEC 60 MG/ML', '7898179711048'),
  ('0001.000065', 'ALUMIMEC 60 MG/ML', '7898179711291'),
  ('0001.000064', 'ALUMIMEC 60 MG/ML', '7898179711307'),
  ('0001.000033', 'GASIMEC 75MG/ML', '7898179710515'),
  ('0001.000014', 'GASTRIMEC COMPOSTO', '7898179711024'),
  ('0001.000022', 'ÁLCOOL 70 %', '7898179710775'),
  ('0001.000026', 'GASTRIVAL COMPOSTO', '7898179710768'),
  ('0001.000011', 'ÓLEO MINERAL (Sabor laranja)', '7898179711123'),
  ('0002.00001', 'DORMEC 100 mg', '7898179710102'),
  ('0002.00002', 'DORMEC 100 mg', '7898179710089'),
  ('0002.00011', 'ÓLEO MINERAL 100%', '7898179711185'),
  ('0002.00012', 'ALUMIMEC', '7898179711215'),
  ('0002.00019', 'ALUMIMEC', '7898179711222'),
  ('0002.00018', 'ALUMIMEC', '7898179711239'),
  ('0002.00013', 'GASTRIMEC COMPOSTO', '7898179711260'),
  ('0002.00017', 'GASTRIVAL COMPOSTO', '7898179711284'),
  ('0002.00021', 'GASTRIVAL COMPOSTO', '7898179711277'),
  ('0001.000013', 'IMECALCIO 1250', '7898964832101'),
  ('0001.000005', 'IMECALCIO D3 500/200', '7898964832118'),
  ('0001.000012', 'IMECALCIO D3 500/400', '7898964832125'),
  ('0001.000006', 'IMECALCIO D3 600/200', '7898964832132'),
  ('0001.000014', 'IMECALCIO D3 600/400', '7898964832149'),
  ('0001.000002', 'IMECVIT C Gotas', '7898964832071'),
  ('0001.000024', 'IMECVIT C 500 MG C 20 COMPRIMIDOS', '7898964832194'),
  ('0001.000017', 'VITAMINA D3 1000 UI COMP.', '7898964832033'),
  ('0001.000018', 'VITAMINA D3 2000 UI COMP.', '7898964832040'),
  ('0001.000009', 'COMPLEXO B Comprimidos', '7898964832156'),
  ('0001.000010', 'CLORETO DE MAGNÉSIO + OXIDO DE MAGNÉSIO P.A.', '7898964832057'),
  ('0001.000015', 'IMEGOV', '7898964832163');
-- Nota: "codigo_interno" se repete entre FARMA e SUP (são sequências
-- numéricas separadas por linha de produto) — não é uma chave única global,
-- só identifica o produto dentro da sua própria linha.

-- Corrige o EAN da "VITAMINA D3 2.000 UI" na tabela de preços de
-- investimento (tinha vindo da planilha original com o mesmo EAN da
-- "1.000 UI" por um erro de digitação — a ficha técnica confirma que o EAN
-- correto é 7898964832040).
UPDATE public.imec_investimento_precos
SET ean = '7898964832040'
WHERE produto = 'VITAMINA D3 2.000 UI Fr.c/30 comp' AND ean = '7898964832033';

-- ===================== Enriquecimento automático dos itens de NF =====================
-- O arquivo de faturamento não traz EAN nem código interno, só a descrição do
-- produto. Ao lançar um item de NF, tenta achar o produto correspondente no
-- catálogo (pelo nome, ignorando maiúsculas/acentos/espaços) e já preenche o
-- EAN e o código interno automaticamente.
CREATE OR REPLACE FUNCTION public.imec_match_produto(p_descricao text)
RETURNS TABLE(codigo_interno text, ean text) AS $$
  SELECT pr.codigo_interno, pr.ean
  FROM public.imec_produtos pr
  WHERE pr.ativo AND public.imec_normalize_produto(pr.produto) = public.imec_normalize_produto(p_descricao)
  ORDER BY pr.updated_at DESC
  LIMIT 1;
$$ LANGUAGE sql STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.imec_enrich_item_nf_trigger() RETURNS TRIGGER AS $$
DECLARE
  v_match RECORD;
BEGIN
  IF NEW.ean IS NULL OR NEW.codigo_produto IS NULL THEN
    SELECT * INTO v_match FROM public.imec_match_produto(NEW.produto);
    IF v_match.ean IS NOT NULL THEN
      NEW.ean := COALESCE(NEW.ean, v_match.ean);
      NEW.codigo_produto := COALESCE(NEW.codigo_produto, v_match.codigo_interno);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_imec_enrich_item_nf ON public.imec_itens_nf;
CREATE TRIGGER trg_imec_enrich_item_nf
  BEFORE INSERT ON public.imec_itens_nf
  FOR EACH ROW EXECUTE FUNCTION public.imec_enrich_item_nf_trigger();

GRANT EXECUTE ON FUNCTION public.imec_match_produto(text) TO authenticated;

-- Carga única: preenche EAN/código interno dos itens de NF já lançados que
-- ainda estão sem essa informação.
UPDATE public.imec_itens_nf it
SET
  ean = COALESCE(it.ean, m.ean),
  codigo_produto = COALESCE(it.codigo_produto, m.codigo_interno)
FROM public.imec_match_produto(it.produto) m
WHERE it.ean IS NULL OR it.codigo_produto IS NULL;

-- Reavalia as NFs recentes agora que muitos itens passaram a ter EAN.
SELECT public.imec_investimento_recheck_recentes();

NOTIFY pgrst, 'reload schema';
