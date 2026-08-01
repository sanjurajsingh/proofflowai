
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Proofs publicly viewable" ON storage.objects;
CREATE POLICY "Proofs viewable when authenticated or path known" ON storage.objects FOR SELECT USING (
  bucket_id = 'proofs' AND (
    auth.uid() IS NOT NULL
  )
);
