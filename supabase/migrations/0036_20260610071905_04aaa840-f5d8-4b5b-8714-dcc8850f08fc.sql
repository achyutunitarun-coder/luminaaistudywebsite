DROP POLICY IF EXISTS "Users upload own pack html" ON storage.objects;
CREATE POLICY "Users upload own pack html" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'exam-pack-html'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1 FROM public.user_unlocked_packs u
    WHERE u.user_id = auth.uid()
      AND u.payment_status = 'completed'
      AND u.pack_id::text = (storage.foldername(name))[2]
  )
);

DROP POLICY IF EXISTS "Users update own pack html" ON storage.objects;
CREATE POLICY "Users update own pack html" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'exam-pack-html'
  AND (auth.uid())::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'exam-pack-html'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1 FROM public.user_unlocked_packs u
    WHERE u.user_id = auth.uid()
      AND u.payment_status = 'completed'
      AND u.pack_id::text = (storage.foldername(name))[2]
  )
);