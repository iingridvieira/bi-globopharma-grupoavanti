
-- Add razao_social column to notas_fiscais
ALTER TABLE public.notas_fiscais ADD COLUMN IF NOT EXISTS razao_social text;

-- Pendencias table
CREATE TABLE IF NOT EXISTS public.pendencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  ano int NOT NULL,
  mes int NOT NULL CHECK (mes BETWEEN 1 AND 12),
  valor numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, ano, mes)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pendencias TO authenticated;
GRANT ALL ON public.pendencias TO service_role;

ALTER TABLE public.pendencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read pendencias" ON public.pendencias
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "editor write pendencias" ON public.pendencias
  FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'email') = 'avantipharma.comercial@gmail.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'avantipharma.comercial@gmail.com');

CREATE TRIGGER touch_pendencias BEFORE UPDATE ON public.pendencias
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Allow has_role to be executable by client roles
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;

-- Fix storage policies for mapas-vendas: only avantipharma email can write
DROP POLICY IF EXISTS "auth upload mapas" ON storage.objects;
DROP POLICY IF EXISTS "auth update mapas" ON storage.objects;
DROP POLICY IF EXISTS "auth delete mapas" ON storage.objects;

CREATE POLICY "editor upload mapas" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'mapas-vendas' AND (auth.jwt() ->> 'email') = 'avantipharma.comercial@gmail.com');

CREATE POLICY "editor update mapas" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'mapas-vendas' AND (auth.jwt() ->> 'email') = 'avantipharma.comercial@gmail.com')
  WITH CHECK (bucket_id = 'mapas-vendas' AND (auth.jwt() ->> 'email') = 'avantipharma.comercial@gmail.com');

CREATE POLICY "editor delete mapas" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'mapas-vendas' AND (auth.jwt() ->> 'email') = 'avantipharma.comercial@gmail.com');

-- Fix mapas_vendas_arquivos table policy
DROP POLICY IF EXISTS "admin/repr manage mapas" ON public.mapas_vendas_arquivos;

CREATE POLICY "editor manage mapas arquivos" ON public.mapas_vendas_arquivos
  FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'email') = 'avantipharma.comercial@gmail.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'avantipharma.comercial@gmail.com');
