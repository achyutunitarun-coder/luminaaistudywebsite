
-- 1) Lock down email_send_log and suppressed_emails: revoke any anon/authenticated grants; add restrictive deny policy.
REVOKE ALL ON public.email_send_log FROM anon, authenticated;
REVOKE ALL ON public.suppressed_emails FROM anon, authenticated;

DROP POLICY IF EXISTS "Deny client access to email_send_log" ON public.email_send_log;
CREATE POLICY "Deny client access to email_send_log" ON public.email_send_log
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Deny client access to suppressed_emails" ON public.suppressed_emails;
CREATE POLICY "Deny client access to suppressed_emails" ON public.suppressed_emails
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

COMMENT ON TABLE public.email_send_log IS 'Service-role only. Client roles (anon, authenticated) are denied via RESTRICTIVE RLS policy and revoked grants.';
COMMENT ON TABLE public.suppressed_emails IS 'Service-role only. Client roles (anon, authenticated) are denied via RESTRICTIVE RLS policy and revoked grants.';

-- 2) profiles: defense-in-depth column-level REVOKE on gamification columns (in addition to existing trigger).
REVOKE UPDATE (xp, coins, level, streak_days, last_study_date, total_study_minutes)
  ON public.profiles FROM authenticated, anon;

-- 3) Storage: exam-pack-html should be writable only by service role. Remove authenticated INSERT/UPDATE policies.
DROP POLICY IF EXISTS "Users upload own pack html" ON storage.objects;
DROP POLICY IF EXISTS "Users update own pack html" ON storage.objects;
