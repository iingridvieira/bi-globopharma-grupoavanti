
-- App role enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'representante', 'viewer');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "admin read all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Trigger auto-create profile and default role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email), NEW.email);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Clientes
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read clientes" ON public.clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin/repr manage clientes" ON public.clientes FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'representante')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'representante'));

-- Metas mensais
CREATE TABLE public.metas_mensais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
  ano INT NOT NULL,
  mes INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  pendencia_inicial NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, ano, mes)
);
ALTER TABLE public.metas_mensais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read metas" ON public.metas_mensais FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin/repr manage metas" ON public.metas_mensais FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'representante')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'representante'));

-- Pedidos enviados
CREATE TABLE public.pedidos_enviados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
  valor NUMERIC(14,2) NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pedidos_enviados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read pedidos" ON public.pedidos_enviados FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin/repr manage pedidos" ON public.pedidos_enviados FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'representante')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'representante'));

-- Notas fiscais
CREATE TABLE public.notas_fiscais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL,
  numero TEXT NOT NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
  valor NUMERIC(14,2) NOT NULL,
  desconto NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read nfs" ON public.notas_fiscais FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin/repr manage nfs" ON public.notas_fiscais FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'representante')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'representante'));

-- Itens NF
CREATE TABLE public.itens_nf (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_fiscal_id UUID REFERENCES public.notas_fiscais(id) ON DELETE CASCADE NOT NULL,
  codigo_produto TEXT,
  produto TEXT NOT NULL,
  quantidade NUMERIC(14,3) NOT NULL DEFAULT 0,
  valor_unitario NUMERIC(14,4) NOT NULL DEFAULT 0,
  valor_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  desconto NUMERIC(14,2) NOT NULL DEFAULT 0
);
ALTER TABLE public.itens_nf ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read itens" ON public.itens_nf FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin/repr manage itens" ON public.itens_nf FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'representante')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'representante'));

-- Sell In / Sell Out (registros mensais por cliente)
CREATE TABLE public.sell_in (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
  ano INT NOT NULL,
  mes INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, ano, mes)
);
ALTER TABLE public.sell_in ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read sellin" ON public.sell_in FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin/repr manage sellin" ON public.sell_in FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'representante')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'representante'));

CREATE TABLE public.sell_out (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
  ano INT NOT NULL,
  mes INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, ano, mes)
);
ALTER TABLE public.sell_out ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read sellout" ON public.sell_out FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin/repr manage sellout" ON public.sell_out FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'representante')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'representante'));

-- Mapas de vendas (arquivos)
CREATE TABLE public.mapas_vendas_arquivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
  nome_arquivo TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  tamanho_bytes BIGINT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.mapas_vendas_arquivos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read mapas" ON public.mapas_vendas_arquivos FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin/repr manage mapas" ON public.mapas_vendas_arquivos FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'representante')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'representante'));

-- Storage bucket for mapas de vendas (public for shareable links)
INSERT INTO storage.buckets (id, name, public) VALUES ('mapas-vendas', 'mapas-vendas', true) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "public read mapas storage" ON storage.objects FOR SELECT USING (bucket_id = 'mapas-vendas');
CREATE POLICY "auth upload mapas" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'mapas-vendas');
CREATE POLICY "auth delete mapas" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'mapas-vendas' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'representante')));

-- Seed clientes Sell Out
INSERT INTO public.clientes (nome) VALUES
  ('ANDORINHA'), ('BANDEIRANTES'), ('CAMPEÃ'), ('CG MEDICAMENTOS'),
  ('DF DISTRIBUIDORA'), ('DISMAP'), ('FARMA CONDE'), ('IMPACTA MED'),
  ('JK MEDICAMENTOS'), ('MAXIFARMA'), ('MEDSOL'), ('MILFARMA'),
  ('NAVARRO INTER'), ('NAVARRO SP'), ('NUCLEO')
ON CONFLICT (nome) DO NOTHING;

CREATE INDEX idx_pedidos_data ON public.pedidos_enviados(data);
CREATE INDEX idx_nfs_data ON public.notas_fiscais(data);
CREATE INDEX idx_metas_per ON public.metas_mensais(ano, mes);
CREATE INDEX idx_sellin_per ON public.sell_in(ano, mes);
CREATE INDEX idx_sellout_per ON public.sell_out(ano, mes);
