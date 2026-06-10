DROP POLICY IF EXISTS "Qualquer pessoa pode solicitar acesso" ON public.access_requests;

CREATE POLICY "Qualquer pessoa pode solicitar acesso"
ON public.access_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = 'pendente'
  AND length(nome) BETWEEN 1 AND 200
  AND length(email) BETWEEN 3 AND 320
  AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND (telefone IS NULL OR length(telefone) <= 40)
);