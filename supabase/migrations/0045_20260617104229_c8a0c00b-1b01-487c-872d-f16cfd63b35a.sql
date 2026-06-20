
-- daily_quests: remove client INSERT/UPDATE; keep SELECT and DELETE
DROP POLICY IF EXISTS "Users can insert own quests" ON public.daily_quests;
DROP POLICY IF EXISTS "Users can update own quests" ON public.daily_quests;

-- game_sessions: remove client INSERT
DROP POLICY IF EXISTS "Users can insert own game sessions" ON public.game_sessions;

-- weekly_stats: remove client INSERT/UPDATE
DROP POLICY IF EXISTS "Users can insert own stats" ON public.weekly_stats;
DROP POLICY IF EXISTS "Users can update own stats" ON public.weekly_stats;

-- profiles: column-level restriction on gamification fields (defense in depth alongside trigger)
REVOKE UPDATE (xp, coins, level, streak_days, last_study_date, total_study_minutes)
  ON public.profiles FROM authenticated;
REVOKE UPDATE (xp, coins, level, streak_days, last_study_date, total_study_minutes)
  ON public.profiles FROM anon;
