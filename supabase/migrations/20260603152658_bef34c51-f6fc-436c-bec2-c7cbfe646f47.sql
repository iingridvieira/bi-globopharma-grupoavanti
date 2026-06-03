
-- Grant editor role to the existing editor user
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'editor'::public.app_role
FROM auth.users u
WHERE lower(u.email) = 'avantipharma.comercial@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Replace email-based policies with role-based ones
DROP POLICY IF EXISTS "editor write pendencias" ON public.pendencias;
CREATE POLICY "editor write pendencias" ON public.pendencias
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'editor'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'editor'::public.app_role));

DROP POLICY IF EXISTS "editor write pendencias_produtos" ON public.pendencias_produtos;
CREATE POLICY "editor write pendencias_produtos" ON public.pendencias_produtos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'editor'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'editor'::public.app_role));

DROP POLICY IF EXISTS "editor write pendencias_anteriores_produtos" ON public.pendencias_anteriores_produtos;
CREATE POLICY "editor write pendencias_anteriores_produtos" ON public.pendencias_anteriores_produtos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'editor'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'editor'::public.app_role));

DROP POLICY IF EXISTS "editor manage metas_globo" ON public.metas_globo;
CREATE POLICY "editor manage metas_globo" ON public.metas_globo
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'editor'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'editor'::public.app_role));

DROP POLICY IF EXISTS "editor manage mapas arquivos" ON public.mapas_vendas_arquivos;
CREATE POLICY "editor manage mapas arquivos" ON public.mapas_vendas_arquivos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'editor'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'editor'::public.app_role));

DROP POLICY IF EXISTS "editor manage conta_corrente_arquivos" ON public.conta_corrente_arquivos;
CREATE POLICY "editor manage conta_corrente_arquivos" ON public.conta_corrente_arquivos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'editor'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'editor'::public.app_role));

DROP POLICY IF EXISTS "editor manage positivacao" ON public.positivacao;
CREATE POLICY "editor manage positivacao" ON public.positivacao
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'editor'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'editor'::public.app_role));

-- Storage policies
DROP POLICY IF EXISTS "editor delete conta-corrente" ON storage.objects;
CREATE POLICY "editor delete conta-corrente" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'conta-corrente' AND public.has_role(auth.uid(), 'editor'::public.app_role));

DROP POLICY IF EXISTS "editor delete mapas" ON storage.objects;
CREATE POLICY "editor delete mapas" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'mapas-vendas' AND public.has_role(auth.uid(), 'editor'::public.app_role));

DROP POLICY IF EXISTS "editor update conta-corrente" ON storage.objects;
CREATE POLICY "editor update conta-corrente" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'conta-corrente' AND public.has_role(auth.uid(), 'editor'::public.app_role))
  WITH CHECK (bucket_id = 'conta-corrente' AND public.has_role(auth.uid(), 'editor'::public.app_role));

DROP POLICY IF EXISTS "editor update mapas" ON storage.objects;
CREATE POLICY "editor update mapas" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'mapas-vendas' AND public.has_role(auth.uid(), 'editor'::public.app_role))
  WITH CHECK (bucket_id = 'mapas-vendas' AND public.has_role(auth.uid(), 'editor'::public.app_role));

DROP POLICY IF EXISTS "editor upload conta-corrente" ON storage.objects;
CREATE POLICY "editor upload conta-corrente" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'conta-corrente' AND public.has_role(auth.uid(), 'editor'::public.app_role));

DROP POLICY IF EXISTS "editor upload mapas" ON storage.objects;
CREATE POLICY "editor upload mapas" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'mapas-vendas' AND public.has_role(auth.uid(), 'editor'::public.app_role));
