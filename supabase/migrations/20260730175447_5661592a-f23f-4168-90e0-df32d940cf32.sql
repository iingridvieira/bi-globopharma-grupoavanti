
-- Helper: usuário possui algum perfil de acesso atribuído
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

-- 1) crm_representadas: escrita restrita a admin/editor
DROP POLICY IF EXISTS "crm_representadas insert authenticated" ON public.crm_representadas;
DROP POLICY IF EXISTS "crm_representadas update authenticated" ON public.crm_representadas;
DROP POLICY IF EXISTS "crm_representadas delete authenticated" ON public.crm_representadas;
DROP POLICY IF EXISTS "crm_representadas select" ON public.crm_representadas;

CREATE POLICY "crm_representadas select" ON public.crm_representadas
  FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "crm_representadas insert admin/editor" ON public.crm_representadas
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));
CREATE POLICY "crm_representadas update admin/editor" ON public.crm_representadas
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));
CREATE POLICY "crm_representadas delete admin/editor" ON public.crm_representadas
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));

-- 2) Leitura de dados de negócio exige perfil atribuído
DO $$
DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'clientes','notas_fiscais','itens_nf','sell_in','sell_out','metas_mensais',
    'pendencias','pendencias_produtos','pendencias_anteriores_produtos','positivacao',
    'pedidos_enviados','pedido_itens','descricoes_sell_in','conta_corrente_arquivos',
    'mapas_vendas_arquivos','nf_entregas','nf_entregas_importacoes','metas_globo',
    'consolidado_overrides'
  ] LOOP
    FOR p IN
      SELECT policyname FROM pg_policies
      WHERE schemaname='public' AND tablename=t AND cmd='SELECT' AND qual='true'
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()))',
      t || '_select_provisioned', t);
  END LOOP;
END $$;

-- 3) Storage: leitura apenas de arquivos registrados no sistema, por usuário provisionado
DROP POLICY IF EXISTS "auth read conta-corrente storage" ON storage.objects;
DROP POLICY IF EXISTS "auth read mapas storage" ON storage.objects;

CREATE POLICY "read conta-corrente registered files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'conta-corrente'
    AND public.has_any_role(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.conta_corrente_arquivos a WHERE a.storage_path = storage.objects.name
    )
  );

CREATE POLICY "read mapas registered files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'mapas-vendas'
    AND public.has_any_role(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.mapas_vendas_arquivos a WHERE a.storage_path = storage.objects.name
    )
  );
