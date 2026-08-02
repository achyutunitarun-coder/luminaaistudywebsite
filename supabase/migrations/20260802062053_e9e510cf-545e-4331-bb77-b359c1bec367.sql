DROP POLICY IF EXISTS "Users can join squads" ON public.squad_members;

CREATE POLICY "Squad creators can add themselves"
ON public.squad_members
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.squads s
    WHERE s.id = squad_members.squad_id
      AND s.created_by = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.join_squad_by_invite_code(_code text, _display_name text DEFAULT NULL)
RETURNS TABLE(squad_id uuid, squad_name text, already_member boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_squad public.squads%ROWTYPE;
  v_count integer;
  v_exists boolean;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_squad FROM public.squads s
  WHERE s.invite_code = upper(trim(coalesce(_code, ''))) LIMIT 1;

  IF v_squad.id IS NULL THEN
    RAISE EXCEPTION 'invalid_invite_code';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.squad_members m
    WHERE m.squad_id = v_squad.id AND m.user_id = v_user
  ) INTO v_exists;

  IF v_exists THEN
    RETURN QUERY SELECT v_squad.id, v_squad.name, true;
    RETURN;
  END IF;

  SELECT count(*) INTO v_count FROM public.squad_members m WHERE m.squad_id = v_squad.id;
  IF v_count >= 12 THEN
    RAISE EXCEPTION 'squad_full';
  END IF;

  INSERT INTO public.squad_members (squad_id, user_id, display_name)
  VALUES (v_squad.id, v_user, coalesce(nullif(trim(_display_name), ''), 'Student'));

  INSERT INTO public.squad_activity (squad_id, user_id, activity_type, description)
  VALUES (v_squad.id, v_user, 'join',
    coalesce(nullif(trim(_display_name), ''), 'A student') || ' joined the squad');

  RETURN QUERY SELECT v_squad.id, v_squad.name, false;
END;
$$;

REVOKE ALL ON FUNCTION public.join_squad_by_invite_code(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.join_squad_by_invite_code(text, text) TO authenticated;