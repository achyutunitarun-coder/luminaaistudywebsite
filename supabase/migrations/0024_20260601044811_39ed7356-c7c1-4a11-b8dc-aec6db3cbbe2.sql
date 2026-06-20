-- 1. parent_links: remove permissive anon read; add a SECURITY DEFINER lookup-by-code function
DROP POLICY IF EXISTS "Public read by access code" ON public.parent_links;

CREATE OR REPLACE FUNCTION public.get_parent_link_by_code(_code text)
RETURNS TABLE(id uuid, student_id uuid, parent_email text, access_code text, linked_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, student_id, parent_email, access_code, linked_at
  FROM public.parent_links
  WHERE access_code = _code
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_parent_link_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_parent_link_by_code(text) TO anon, authenticated;

-- 2. storage delete policy for exam-pack-html
DROP POLICY IF EXISTS "Users can delete own exam pack files" ON storage.objects;
CREATE POLICY "Users can delete own exam pack files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'exam-pack-html' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- 3. Restrict realtime postgres_changes to authenticated only
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'realtime' AND tablename = 'messages') THEN
    EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can receive realtime" ON realtime.messages';
    EXECUTE 'CREATE POLICY "Authenticated users can receive realtime" ON realtime.messages FOR SELECT TO authenticated USING (true)';
  END IF;
END $$;

-- 4. Revoke EXECUTE on internal SECURITY DEFINER helpers from anon/authenticated where appropriate
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.protect_gamification_columns() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.bump_interaction_quality() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_quest_limits() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_study_minutes(uuid, integer) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_leaderboard(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_dodo_credits_for_user(uuid, text, text, text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_dodo_credit_product(text) FROM anon, PUBLIC;