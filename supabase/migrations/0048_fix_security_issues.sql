-- Fix security issues flagged by Supabase linter

-- 1. CRITICAL: Restrict profiles UPDATE to only allow specific fields (not gamification fields)
-- Drop the overly permissive update policy
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Create a new policy that only allows updating display_name and avatar_url
-- Users should NOT be able to directly update xp, level, coins, streak_days, etc.
CREATE POLICY "Users can update own profile display fields"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    -- Only allow updating these specific fields
    AND (
      -- Ensure gamification fields are not being changed
      -- by checking they match the current values
      xp = (SELECT xp FROM public.profiles WHERE user_id = auth.uid())
      AND level = (SELECT level FROM public.profiles WHERE user_id = auth.uid())
      AND coins = (SELECT coins FROM public.profiles WHERE user_id = auth.uid())
      AND streak_days = (SELECT streak_days FROM public.profiles WHERE user_id = auth.uid())
    )
  );

-- 2. WARNING: Add RLS to email_send_log table
ALTER TABLE IF EXISTS public.email_send_log ENABLE ROW LEVEL SECURITY;

-- Only allow users to see their own email logs
DROP POLICY IF EXISTS "Users can view own email logs" ON public.email_send_log;
CREATE POLICY "Users can view own email logs"
  ON public.email_send_log
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 3. WARNING: Add RLS to suppressed_emails table
ALTER TABLE IF EXISTS public.suppressed_emails ENABLE ROW LEVEL SECURITY;

-- Only allow users to see their own suppressed emails
DROP POLICY IF EXISTS "Users can view own suppressed emails" ON public.suppressed_emails;
CREATE POLICY "Users can view own suppressed emails"
  ON public.suppressed_emails
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 4. WARNING: Fix exam-pack-html storage bucket - restrict uploads to authenticated users only
-- The existing policies already check auth.uid(), but let's make sure INSERT is also restricted
DROP POLICY IF EXISTS "Users can upload exam pack html" ON storage.objects;
CREATE POLICY "Users can upload exam pack html"
  ON storage.objects
  FOR INSERT
  TO authenticated
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
