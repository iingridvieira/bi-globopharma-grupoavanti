CREATE TYPE public.crm_cliente_status AS ENUM ('comprou', 'negociacao', 'nao_comprou', 'inativo');

CREATE OR REPLACE FUNCTION public.crm_touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

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
CREATE POLICY "crm_representadas insert authenticated" ON public.crm_representadas FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "crm_representadas update authenticated" ON public.crm_representadas FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "crm_representadas delete authenticated" ON public.crm_representadas FOR DELETE TO authenticated
  USING (true);

INSERT INTO public.crm_representadas (nome, slug, ordem) VALUES
  ('Globo', 'globo', 1),
  ('Multi', 'multi', 2),
  ('Imec/Nutivit', 'imec-nutivit', 3),
  ('Copapharma', 'copapharma', 4),
  ('Supermedy', 'supermedy', 5);

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

CREATE POLICY "crm logos read authenticated" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'crm-representada-logos');
CREATE POLICY "crm logos insert authenticated" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'crm-representada-logos');
CREATE POLICY "crm logos update authenticated" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'crm-representada-logos')
  WITH CHECK (bucket_id = 'crm-representada-logos');
CREATE POLICY "crm logos delete authenticated" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'crm-representada-logos');

CREATE OR REPLACE FUNCTION public.crm_sync_pedido(
  p_user_id uuid,
  p_cliente_nome text,
  p_data date,
  p_representada_slug text DEFAULT 'globo'
) RETURNS void AS $$
DECLARE
  v_rep_id uuid;
  v_cliente_id uuid;
  v_cr_id uuid;
  v_mes_ref date;
BEGIN
  IF p_user_id IS NULL OR p_cliente_nome IS NULL OR p_data IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO v_rep_id FROM public.crm_representadas WHERE slug = p_representada_slug;
  IF v_rep_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO v_cliente_id
  FROM public.crm_clientes
  WHERE user_id = p_user_id AND lower(trim(nome)) = lower(trim(p_cliente_nome))
  LIMIT 1;

  IF v_cliente_id IS NULL THEN
    INSERT INTO public.crm_clientes (user_id, nome)
    VALUES (p_user_id, p_cliente_nome)
    ON CONFLICT (user_id, nome) DO UPDATE SET nome = EXCLUDED.nome
    RETURNING id INTO v_cliente_id;
  END IF;

  SELECT id INTO v_cr_id
  FROM public.crm_cliente_representadas
  WHERE cliente_id = v_cliente_id AND representada_id = v_rep_id;

  IF v_cr_id IS NULL THEN
    INSERT INTO public.crm_cliente_representadas (user_id, cliente_id, representada_id)
    VALUES (p_user_id, v_cliente_id, v_rep_id)
    ON CONFLICT (cliente_id, representada_id) DO UPDATE SET representada_id = EXCLUDED.representada_id
    RETURNING id INTO v_cr_id;
  END IF;

  v_mes_ref := date_trunc('month', p_data)::date;
  INSERT INTO public.crm_status_mensal (user_id, cliente_representada_id, mes_ref, status)
  VALUES (p_user_id, v_cr_id, v_mes_ref, 'comprou')
  ON CONFLICT (cliente_representada_id, mes_ref) DO UPDATE SET status = 'comprou', updated_at = now();

  INSERT INTO public.crm_compras (user_id, cliente_representada_id, data_compra)
  VALUES (p_user_id, v_cr_id, p_data)
  ON CONFLICT (cliente_representada_id, data_compra) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.crm_sync_pedido_enviado_trigger() RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
  v_nome_cliente text;
BEGIN
  v_user_id := COALESCE(NEW.created_by, auth.uid());
  SELECT nome INTO v_nome_cliente FROM public.clientes WHERE id = NEW.cliente_id;
  PERFORM public.crm_sync_pedido(v_user_id, v_nome_cliente, NEW.data, 'globo');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_crm_sync_pedido_enviado ON public.pedidos_enviados;
CREATE TRIGGER trg_crm_sync_pedido_enviado
  AFTER INSERT OR UPDATE OF cliente_id, data ON public.pedidos_enviados
  FOR EACH ROW EXECUTE FUNCTION public.crm_sync_pedido_enviado_trigger();

CREATE OR REPLACE FUNCTION public.crm_backfill_pedidos_globo() RETURNS integer AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_count integer := 0;
  r RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'É preciso estar logado para importar o histórico do BI.';
  END IF;

  FOR r IN
    SELECT c.nome AS cliente_nome, p.data AS data
    FROM public.pedidos_enviados p
    JOIN public.clientes c ON c.id = p.cliente_id
  LOOP
    PERFORM public.crm_sync_pedido(v_user_id, r.cliente_nome, r.data, 'globo');
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.crm_backfill_pedidos_globo() TO authenticated;