-- Fix: squads table exposed all rows + invite codes via USING(true) SELECT policy
-- Replace with a SECURITY DEFINER lookup function that only returns a squad
-- when the caller provides the exact invite code.

DROP POLICY IF EXISTS "Anyone can lookup by invite code" ON public.squads;

CREATE OR REPLACE FUNCTION public.lookup_squad_by_invite_code(_code text)
RETURNS TABLE(id uuid, name text, invite_code text, created_by uuid, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.name, s.invite_code, s.created_by, s.created_at
  FROM public.squads s
  WHERE s.invite_code = upper(trim(_code))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.lookup_squad_by_invite_code(text) FROM public;
GRANT EXECUTE ON FUNCTION public.lookup_squad_by_invite_code(text) TO authenticated;

-- Fix: squad_activity INSERT policy did not verify squad membership.
DROP POLICY IF EXISTS "Users can insert own activity" ON public.squad_activity;

CREATE POLICY "Members can insert squad activity"
ON public.squad_activity
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.squad_members sm
    WHERE sm.squad_id = squad_activity.squad_id
      AND sm.user_id = auth.uid()
  )
);