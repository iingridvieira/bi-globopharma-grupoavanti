
-- 1) Tabela de arquivos de conta corrente
CREATE TABLE public.conta_corrente_arquivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL,
  nome_arquivo text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  tamanho_bytes bigint,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conta_corrente_arquivos TO authenticated;
GRANT ALL ON public.conta_corrente_arquivos TO service_role;

ALTER TABLE public.conta_corrente_arquivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read conta_corrente_arquivos"
  ON public.conta_corrente_arquivos
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "editor manage conta_corrente_arquivos"
  ON public.conta_corrente_arquivos
  FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'email') = 'avantipharma.comercial@gmail.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'avantipharma.comercial@gmail.com');

-- 2) Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('conta-corrente', 'conta-corrente', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "auth read conta-corrente storage"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'conta-corrente');

CREATE POLICY "editor upload conta-corrente"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'conta-corrente' AND (auth.jwt() ->> 'email') = 'avantipharma.comercial@gmail.com');

CREATE POLICY "editor update conta-corrente"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'conta-corrente' AND (auth.jwt() ->> 'email') = 'avantipharma.comercial@gmail.com');

CREATE POLICY "editor delete conta-corrente"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'conta-corrente' AND (auth.jwt() ->> 'email') = 'avantipharma.comercial@gmail.com');

-- 3) Observação por cliente
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS observacao text;
