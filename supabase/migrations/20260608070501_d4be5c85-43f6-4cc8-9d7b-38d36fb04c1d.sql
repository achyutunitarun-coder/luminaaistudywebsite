DROP POLICY IF EXISTS "Scoped realtime subscriptions" ON realtime.messages;

CREATE POLICY "Scoped realtime subscriptions"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() IN ('leaderboard-realtime', 'live-leaderboard-updates')
  OR (
    realtime.topic() LIKE 'squad-%'
    AND EXISTS (
      SELECT 1 FROM public.squad_members sm
      WHERE sm.user_id = auth.uid()
        AND sm.squad_id::text = substring(realtime.topic() from 7)
    )
  )
  OR realtime.topic() = ('user-' || auth.uid()::text)
  OR realtime.topic() LIKE ('user-' || auth.uid()::text || '-%')
);