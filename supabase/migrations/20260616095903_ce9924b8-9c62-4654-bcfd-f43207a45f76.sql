
-- 1. daily_quests: drop client write policies; writes only via service role/edge function
DROP POLICY IF EXISTS "Users can insert their own daily quests" ON public.daily_quests;
DROP POLICY IF EXISTS "Users can update their own daily quests" ON public.daily_quests;
DROP POLICY IF EXISTS "Users insert own daily quests" ON public.daily_quests;
DROP POLICY IF EXISTS "Users update own daily quests" ON public.daily_quests;
DROP POLICY IF EXISTS "daily_quests_insert" ON public.daily_quests;
DROP POLICY IF EXISTS "daily_quests_update" ON public.daily_quests;

COMMENT ON TABLE public.daily_quests IS
  'Quest progress and rewards are managed exclusively by service-role edge functions and SECURITY DEFINER RPCs. Client INSERT/UPDATE is intentionally disallowed to prevent self-awarded XP/coins. Reads are scoped to the owning user.';

-- 2. game_sessions: drop client INSERT, writes only via service role
DROP POLICY IF EXISTS "Users can insert their own game sessions" ON public.game_sessions;
DROP POLICY IF EXISTS "Users insert own game sessions" ON public.game_sessions;
DROP POLICY IF EXISTS "game_sessions_insert" ON public.game_sessions;

COMMENT ON TABLE public.game_sessions IS
  'Game session results (including xp_earned and coins_earned) are recorded only by service-role edge functions after server-side validation. Client INSERT/UPDATE/DELETE is intentionally disallowed; rewards must flow through award_xp_coins(). Reads are scoped to the owning user.';

-- 3. weekly_stats: drop client write policies
DROP POLICY IF EXISTS "Users can insert their own weekly stats" ON public.weekly_stats;
DROP POLICY IF EXISTS "Users can update their own weekly stats" ON public.weekly_stats;
DROP POLICY IF EXISTS "Users insert own weekly stats" ON public.weekly_stats;
DROP POLICY IF EXISTS "Users update own weekly stats" ON public.weekly_stats;
DROP POLICY IF EXISTS "weekly_stats_insert" ON public.weekly_stats;
DROP POLICY IF EXISTS "weekly_stats_update" ON public.weekly_stats;

COMMENT ON TABLE public.weekly_stats IS
  'Weekly aggregated statistics (including xp_earned) are maintained exclusively by service-role edge functions and SECURITY DEFINER functions. Client INSERT/UPDATE is intentionally disallowed to prevent inflating XP. Reads are scoped to the owning user.';

-- 4. Storage: tighten exam-pack-html UPDATE USING to verify pack ownership
DROP POLICY IF EXISTS "Users update own pack html" ON storage.objects;

CREATE POLICY "Users update own pack html"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'exam-pack-html'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1 FROM public.user_unlocked_packs u
    WHERE u.user_id = auth.uid()
      AND u.payment_status = 'completed'
      AND (u.pack_id)::text = (storage.foldername(objects.name))[2]
  )
)
WITH CHECK (
  bucket_id = 'exam-pack-html'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1 FROM public.user_unlocked_packs u
    WHERE u.user_id = auth.uid()
      AND u.payment_status = 'completed'
      AND (u.pack_id)::text = (storage.foldername(objects.name))[2]
  )
);
