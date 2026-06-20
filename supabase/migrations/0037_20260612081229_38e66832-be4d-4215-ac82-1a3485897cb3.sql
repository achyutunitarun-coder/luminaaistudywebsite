-- 1) Allow reading shared (null user_id) learning questions
DROP POLICY IF EXISTS "Read shared learning questions" ON public.learning_questions;
CREATE POLICY "Read shared learning questions"
ON public.learning_questions
FOR SELECT
TO authenticated
USING (user_id IS NULL);

-- 2) Tighten storage DELETE policy to also require an active unlock
DROP POLICY IF EXISTS "Users can delete own exam pack files" ON storage.objects;
CREATE POLICY "Users can delete own exam pack files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'exam-pack-html'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1 FROM public.user_unlocked_packs u
    WHERE u.user_id = auth.uid()
      AND u.payment_status = 'completed'
      AND u.pack_id::text = (storage.foldername(name))[2]
  )
);