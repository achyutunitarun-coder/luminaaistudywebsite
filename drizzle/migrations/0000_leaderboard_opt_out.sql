-- DEF-08: leaderboard privacy opt-out.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS leaderboard_opt_out boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.sync_leaderboard(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_today date := CURRENT_DATE;
  v_week_start date := date_trunc('week', CURRENT_DATE)::date;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE user_id = p_user_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Opted-out users: remove any public entries and stop syncing
  IF COALESCE(v_profile.leaderboard_opt_out, false) THEN
    DELETE FROM leaderboard_entries WHERE user_id = p_user_id;
    RETURN;
  END IF;

  -- All-time entry
  INSERT INTO leaderboard_entries (user_id, display_name, avatar_url, xp, level, period, period_start)
  VALUES (p_user_id, COALESCE(v_profile.display_name, 'Student'), v_profile.avatar_url, v_profile.xp, v_profile.level, 'all_time', '2024-01-01')
  ON CONFLICT (user_id, period, period_start)
  DO UPDATE SET xp = v_profile.xp, level = v_profile.level, display_name = COALESCE(v_profile.display_name, 'Student'), avatar_url = v_profile.avatar_url, updated_at = now();

  -- Daily entry
  INSERT INTO leaderboard_entries (user_id, display_name, avatar_url, xp, level, period, period_start)
  VALUES (p_user_id, COALESCE(v_profile.display_name, 'Student'), v_profile.avatar_url, v_profile.xp, v_profile.level, 'daily', v_today)
  ON CONFLICT (user_id, period, period_start)
  DO UPDATE SET xp = v_profile.xp, level = v_profile.level, display_name = COALESCE(v_profile.display_name, 'Student'), avatar_url = v_profile.avatar_url, updated_at = now();

  -- Weekly entry
  INSERT INTO leaderboard_entries (user_id, display_name, avatar_url, xp, level, period, period_start)
  VALUES (p_user_id, COALESCE(v_profile.display_name, 'Student'), v_profile.avatar_url, v_profile.xp, v_profile.level, 'weekly', v_week_start)
  ON CONFLICT (user_id, period, period_start)
  DO UPDATE SET xp = v_profile.xp, level = v_profile.level, display_name = COALESCE(v_profile.display_name, 'Student'), avatar_url = v_profile.avatar_url, updated_at = now();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_leaderboard(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.sync_leaderboard(uuid) TO authenticated, service_role;