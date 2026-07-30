-- Módulo CRM (Carteira de Clientes por Representada), integrado como submódulo do
-- BI Avanti Pharma. Todas as tabelas usam o prefixo "crm_" para não colidir com
-- nada que já existe no BI Globo Pharma (que já possui suas próprias tabelas
-- "clientes" e "user_roles" com estrutura diferente). Nenhuma tabela existente é
-- alterada por esta migration.

CREATE TYPE public.crm_cliente_status AS ENUM ('comprou', 'negociacao', 'nao_comprou', 'inativo');

CREATE OR REPLACE FUNCTION public.crm_touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Representadas do CRM (lista compartilhada)
CREATE TABLE public.crm_representadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  slug text NOT NULL UNIQUE,
  ordem int NOT NULL DEFAULT 0,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_representadas TO authenticated;
GRANT ALL ON public.crm_representadas TO service_role;
ALTER TABLE public.crm_representadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_representadas select" ON public.crm_representadas FOR SELECT TO authenticated USING (true);
CREATE POLICY "crm_representadas insert admin" ON public.crm_representadas FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "crm_representadas update admin" ON public.crm_representadas FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "crm_representadas delete admin" ON public.crm_representadas FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.crm_representadas (nome, slug, ordem) VALUES
  ('Globo', 'globo', 1),
  ('Multi', 'multi', 2),
  ('Imec/Nutivit', 'imec-nutivit', 3),
  ('Copapharma', 'copapharma', 4),
  ('Supermedy', 'supermedy', 5);

-- Clientes do CRM (cadastro único por usuário, distinto dos "clientes" do BI Globo Pharma)
CREATE TABLE public.crm_clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, nome)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_clientes TO authenticated;
GRANT ALL ON public.crm_clientes TO service_role;
ALTER TABLE public.crm_clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_clientes select own" ON public.crm_clientes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "crm_clientes insert own" ON public.crm_clientes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "crm_clientes update own" ON public.crm_clientes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "crm_clientes delete own" ON public.crm_clientes FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_crm_clientes_updated_at BEFORE UPDATE ON public.crm_clientes
  FOR EACH ROW EXECUTE FUNCTION public.crm_touch_updated_at();

-- Cliente <-> Representada (vínculo)
CREATE TABLE public.crm_cliente_representadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cliente_id uuid NOT NULL REFERENCES public.crm_clientes(id) ON DELETE CASCADE,
  representada_id uuid NOT NULL REFERENCES public.crm_representadas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, representada_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_cliente_representadas TO authenticated;
GRANT ALL ON public.crm_cliente_representadas TO service_role;
ALTER TABLE public.crm_cliente_representadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_cr select own" ON public.crm_cliente_representadas FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "crm_cr insert own" ON public.crm_cliente_representadas FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "crm_cr update own" ON public.crm_cliente_representadas FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "crm_cr delete own" ON public.crm_cliente_representadas FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Status mensal por vínculo cliente<->representada
CREATE TABLE public.crm_status_mensal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cliente_representada_id uuid NOT NULL REFERENCES public.crm_cliente_representadas(id) ON DELETE CASCADE,
  mes_ref date NOT NULL,
  status public.crm_cliente_status NOT NULL DEFAULT 'nao_comprou',
  motivo_nao_compra text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cliente_representada_id, mes_ref)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_status_mensal TO authenticated;
GRANT ALL ON public.crm_status_mensal TO service_role;
ALTER TABLE public.crm_status_mensal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_sm select own" ON public.crm_status_mensal FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "crm_sm insert own" ON public.crm_status_mensal FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "crm_sm update own" ON public.crm_status_mensal FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "crm_sm delete own" ON public.crm_status_mensal FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_crm_sm_updated_at BEFORE UPDATE ON public.crm_status_mensal
  FOR EACH ROW EXECUTE FUNCTION public.crm_touch_updated_at();

CREATE INDEX idx_crm_sm_cr_mes ON public.crm_status_mensal (cliente_representada_id, mes_ref);
CREATE INDEX idx_crm_cr_user ON public.crm_cliente_representadas (user_id);
CREATE INDEX idx_crm_cr_representada ON public.crm_cliente_representadas (representada_id);

-- Histórico de compras (permite "última compra" global e futuras análises de frequência)
CREATE TABLE public.crm_compras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cliente_representada_id uuid NOT NULL REFERENCES public.crm_cliente_representadas(id) ON DELETE CASCADE,
  data_compra date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cliente_representada_id, data_compra)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_compras TO authenticated;
GRANT ALL ON public.crm_compras TO service_role;
ALTER TABLE public.crm_compras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_compras select own" ON public.crm_compras FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "crm_compras insert own" ON public.crm_compras FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "crm_compras update own" ON public.crm_compras FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "crm_compras delete own" ON public.crm_compras FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_crm_compras_cr_data ON public.crm_compras (cliente_representada_id, data_compra DESC);

-- Storage bucket para logos das representadas do CRM (privado; leitura via signed URL)
INSERT INTO storage.buckets (id, name, public) VALUES ('crm-representada-logos', 'crm-representada-logos', false)
  ON CONFLICT (id) DO NOTHING;
CREATE POLICY "crm logos read authenticated" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'crm-representada-logos');
CREATE POLICY "crm logos insert admin" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'crm-representada-logos' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "crm logos update admin" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'crm-representada-logos' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'crm-representada-logos' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "crm logos delete admin" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'crm-representada-logos' AND public.has_role(auth.uid(), 'admin'));
