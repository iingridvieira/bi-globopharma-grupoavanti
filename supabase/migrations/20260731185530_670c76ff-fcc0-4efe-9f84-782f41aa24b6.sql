-- 1) Storage: logos do CRM
DROP POLICY IF EXISTS "crm logos read authenticated" ON storage.objects;
DROP POLICY IF EXISTS "crm logos insert authenticated" ON storage.objects;
DROP POLICY IF EXISTS "crm logos update authenticated" ON storage.objects;
DROP POLICY IF EXISTS "crm logos delete authenticated" ON storage.objects;

CREATE POLICY "crm logos read provisioned" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'crm-representada-logos' AND public.has_any_role(auth.uid()));

CREATE POLICY "crm logos insert admin/editor" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'crm-representada-logos'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor')));

CREATE POLICY "crm logos update admin/editor" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'crm-representada-logos'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor')))
  WITH CHECK (bucket_id = 'crm-representada-logos'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor')));

CREATE POLICY "crm logos delete admin/editor" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'crm-representada-logos'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor')));

-- 2) IMEC: leitura apenas para usuários provisionados
DROP POLICY IF EXISTS "imec_clientes select" ON public.imec_clientes;
CREATE POLICY "imec_clientes select provisioned" ON public.imec_clientes
  FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));

DROP POLICY IF EXISTS "imec_pedidos select" ON public.imec_pedidos_enviados;
CREATE POLICY "imec_pedidos select provisioned" ON public.imec_pedidos_enviados
  FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));

DROP POLICY IF EXISTS "imec_itens select" ON public.imec_pedido_itens;
CREATE POLICY "imec_itens select provisioned" ON public.imec_pedido_itens
  FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));

-- 3) itens_nf: escritas explícitas por operação
DROP POLICY IF EXISTS "admin/repr manage itens" ON public.itens_nf;

CREATE POLICY "itens_nf insert authorized" ON public.itens_nf
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'editor')
    OR public.has_role(auth.uid(), 'representante'));

CREATE POLICY "itens_nf update authorized" ON public.itens_nf
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'editor')
    OR public.has_role(auth.uid(), 'representante'))
  WITH CHECK (public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'editor')
    OR public.has_role(auth.uid(), 'representante'));

CREATE POLICY "itens_nf delete authorized" ON public.itens_nf
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'editor')
    OR public.has_role(auth.uid(), 'representante'));