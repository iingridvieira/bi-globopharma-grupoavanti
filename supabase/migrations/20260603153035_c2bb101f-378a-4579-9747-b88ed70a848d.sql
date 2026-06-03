
-- Tabela principal de entregas (1 por NF, chaveada por número)
CREATE TABLE public.nf_entregas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  data_entrega date,
  data_agendamento date,
  previsao_entrega date,
  status text NOT NULL DEFAULT 'Não Coletada',
  transportadora text,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

CREATE INDEX nf_entregas_numero_idx ON public.nf_entregas (numero);
CREATE INDEX nf_entregas_status_idx ON public.nf_entregas (status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nf_entregas TO authenticated;
GRANT ALL ON public.nf_entregas TO service_role;

ALTER TABLE public.nf_entregas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read nf_entregas" ON public.nf_entregas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "editor manage nf_entregas" ON public.nf_entregas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'editor'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'editor'::public.app_role));

CREATE TRIGGER trg_nf_entregas_touch
  BEFORE UPDATE ON public.nf_entregas
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Log de importações
CREATE TABLE public.nf_entregas_importacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arquivo text,
  total_linhas integer NOT NULL DEFAULT 0,
  novas integer NOT NULL DEFAULT 0,
  atualizadas integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

GRANT SELECT, INSERT ON public.nf_entregas_importacoes TO authenticated;
GRANT ALL ON public.nf_entregas_importacoes TO service_role;

ALTER TABLE public.nf_entregas_importacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read nf_entregas_importacoes" ON public.nf_entregas_importacoes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "editor insert nf_entregas_importacoes" ON public.nf_entregas_importacoes
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'editor'::public.app_role));
