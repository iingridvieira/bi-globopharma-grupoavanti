
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;

DROP POLICY IF EXISTS "public read mapas storage" ON storage.objects;
CREATE POLICY "auth read mapas storage" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'mapas-vendas');
