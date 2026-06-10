-- Nome de usuário nos perfis
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_idx ON public.profiles (lower(username)) WHERE username IS NOT NULL;

UPDATE public.profiles SET username = 'Ingrid Vieira' WHERE id = '94c8f931-1647-40ea-abc3-41a64766ec65';
UPDATE public.profiles SET username = 'Alexandre Colella' WHERE id = 'fd762be9-394c-42f3-a38b-300c8d869867';
UPDATE public.profiles SET username = 'Eduardo Ule' WHERE id = '3b1f6611-eb4d-42e2-aa3b-b5f20fa5999d';

-- Função para mapear nome de usuário -> e-mail (login por nome)
CREATE OR REPLACE FUNCTION public.get_email_for_username(_username text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM public.profiles
  WHERE lower(username) = lower(trim(_username))
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.get_email_for_username(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_email_for_username(text) TO anon, authenticated;

-- Solicitações de acesso (sem criação automática de usuário)
CREATE TABLE public.access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL CHECK (char_length(nome) BETWEEN 2 AND 200),
  email text NOT NULL CHECK (char_length(email) BETWEEN 5 AND 255),
  telefone text CHECK (telefone IS NULL OR char_length(telefone) <= 40),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','rejeitado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.access_requests TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.access_requests TO authenticated;
GRANT ALL ON public.access_requests TO service_role;
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Qualquer pessoa pode solicitar acesso" ON public.access_requests FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admins podem ver solicitacoes" ON public.access_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins podem atualizar solicitacoes" ON public.access_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins podem excluir solicitacoes" ON public.access_requests FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER access_requests_touch BEFORE UPDATE ON public.access_requests FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();