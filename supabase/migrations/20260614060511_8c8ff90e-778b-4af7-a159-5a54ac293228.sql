
-- 1. Tighten storage SELECT to require completed purchase
DROP POLICY IF EXISTS "Users read own pack html" ON storage.objects;
CREATE POLICY "Users read own pack html" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'exam-pack-html'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1 FROM public.user_unlocked_packs u
    WHERE u.user_id = auth.uid()
      AND u.payment_status = 'completed'
      AND (u.pack_id)::text = (storage.foldername(objects.name))[2]
  )
);

-- 2. Revoke column-level SELECT on OAuth tokens from authenticated role.
-- Edge functions use service_role and remain unaffected.
REVOKE SELECT ON public.user_connections FROM authenticated;
GRANT SELECT (
  id, user_id, provider, account_email, account_label,
  scopes, metadata, token_expires_at, created_at, updated_at
) ON public.user_connections TO authenticated;

-- 3. Revoke column-level SELECT on parent_links.access_code from authenticated.
-- Parent lookup is via SECURITY DEFINER function get_parent_link_by_code.
REVOKE SELECT ON public.parent_links FROM authenticated;
GRANT SELECT (id, student_id, parent_email, linked_at) ON public.parent_links TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.parent_links TO authenticated;
