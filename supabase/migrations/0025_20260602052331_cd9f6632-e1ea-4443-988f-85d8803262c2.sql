
-- 1) Stop users from self-granting paid exam pack unlocks.
-- Remove authenticated INSERT/UPDATE policies; only service_role (via webhook) should write.
DROP POLICY IF EXISTS "Users insert own unlocks" ON public.user_unlocked_packs;
DROP POLICY IF EXISTS "Users update own unlocks" ON public.user_unlocked_packs;

-- 2) Tighten realtime.messages so subscribers are scoped by topic.
-- Replace the permissive USING(true) policy with one that only allows:
--   * public leaderboard topics
--   * squad-<uuid> topics where the user is a member of that squad
--   * user-scoped topics ending with the caller's uid
DROP POLICY IF EXISTS "Authenticated users can receive realtime" ON realtime.messages;

CREATE POLICY "Scoped realtime subscriptions"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- public leaderboard channels (intentional broadcast)
  realtime.topic() IN ('leaderboard-realtime', 'live-leaderboard-updates')
  -- squad channels: topic looks like 'squad-<uuid>' and caller is a member
  OR (
    realtime.topic() LIKE 'squad-%'
    AND EXISTS (
      SELECT 1 FROM public.squad_members sm
      WHERE sm.user_id = auth.uid()
        AND sm.squad_id::text = substring(realtime.topic() from 7)
    )
  )
  -- user-scoped channels: topic ends with the caller's uid
  OR realtime.topic() LIKE ('%' || auth.uid()::text)
);
