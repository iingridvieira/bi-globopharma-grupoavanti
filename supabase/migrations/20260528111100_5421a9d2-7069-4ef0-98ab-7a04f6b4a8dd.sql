
-- Fix INSERT policy on mapas-vendas: restrict to admin/representante
DROP POLICY IF EXISTS "auth upload mapas" ON storage.objects;
CREATE POLICY "auth upload mapas" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'mapas-vendas'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'representante'::app_role))
);

-- Add UPDATE policy mirroring DELETE
CREATE POLICY "auth update mapas" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'mapas-vendas'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'representante'::app_role))
)
WITH CHECK (
  bucket_id = 'mapas-vendas'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'representante'::app_role))
);

-- Restrict SELECT (listing) on the public bucket to authenticated users only.
-- Public file URLs continue to work because the bucket is marked public.
DROP POLICY IF EXISTS "auth read mapas storage" ON storage.objects;
CREATE POLICY "auth read mapas storage" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'mapas-vendas');

-- Lock down SECURITY DEFINER helpers so they aren't directly callable by clients
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
