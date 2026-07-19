
-- Create a SECURITY DEFINER function to safely award XP, coins, update level and streak
CREATE OR REPLACE FUNCTION public.award_xp_coins(
  p_user_id uuid,
  p_xp integer,
  p_coins integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_new_xp integer;
  v_new_coins integer;
  v_new_level integer;
  v_new_streak integer;
  v_today date := CURRENT_DATE;
  v_yesterday date := CURRENT_DATE - 1;
  v_leveled_up boolean := false;
BEGIN
  -- Validate inputs
  IF p_xp < 0 OR p_xp > 500 THEN
    RAISE EXCEPTION 'Invalid XP value';
  END IF;
  IF p_coins < 0 OR p_coins > 100 THEN
    RAISE EXCEPTION 'Invalid coins value';
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  v_new_xp := v_profile.xp + p_xp;
  v_new_coins := v_profile.coins + p_coins;
  v_new_level := GREATEST(1, (v_new_xp / 100) + 1);
  v_leveled_up := v_new_level > v_profile.level;

  -- Streak logic
  v_new_streak := v_profile.streak_days;
  IF v_profile.last_study_date IS NULL THEN
    v_new_streak := 1;
  ELSIF v_profile.last_study_date = v_yesterday THEN
    v_new_streak := v_new_streak + 1;
  ELSIF v_profile.last_study_date < v_yesterday THEN
    v_new_streak := 1;
  END IF;
  -- If last_study_date = today, streak stays the same

  UPDATE profiles SET
    xp = v_new_xp,
    coins = v_new_coins,
    level = v_new_level,
    streak_days = v_new_streak,
    last_study_date = v_today,
    updated_at = now()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'xp', v_new_xp,
    'coins', v_new_coins,
    'level', v_new_level,
    'streak_days', v_new_streak,
    'leveled_up', v_leveled_up
  );
END;
$$;

-- Now restrict the profiles UPDATE policy to only allow safe column updates
-- Drop old policy and create a restricted one
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can update own profile" ON profiles
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create a trigger to prevent direct manipulation of gamification columns
CREATE OR REPLACE FUNCTION public.protect_gamification_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If called from a security definer context (like award_xp_coins), allow
  -- Check if the caller is a regular user by checking current_setting
  -- We use a simple approach: if xp/coins/level/streak changed, revert them
  -- unless the session variable is set
  IF current_setting('app.bypass_gamification_guard', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- Prevent direct changes to gamification columns
  NEW.xp := OLD.xp;
  NEW.coins := OLD.coins;
  NEW.level := OLD.level;
  NEW.streak_days := OLD.streak_days;
  NEW.last_study_date := OLD.last_study_date;
  NEW.total_study_minutes := OLD.total_study_minutes;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_gamification_columns_trigger
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION protect_gamification_columns();

-- Update award_xp_coins to set the bypass variable
CREATE OR REPLACE FUNCTION public.award_xp_coins(
  p_user_id uuid,
  p_xp integer,
  p_coins integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_new_xp integer;
  v_new_coins integer;
  v_new_level integer;
  v_new_streak integer;
  v_today date := CURRENT_DATE;
  v_yesterday date := CURRENT_DATE - 1;
  v_leveled_up boolean := false;
BEGIN
  -- Validate inputs
  IF p_xp < 0 OR p_xp > 500 THEN
    RAISE EXCEPTION 'Invalid XP value';
  END IF;
  IF p_coins < 0 OR p_coins > 100 THEN
    RAISE EXCEPTION 'Invalid coins value';
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  v_new_xp := v_profile.xp + p_xp;
  v_new_coins := v_profile.coins + p_coins;
  v_new_level := GREATEST(1, (v_new_xp / 100) + 1);
  v_leveled_up := v_new_level > v_profile.level;

  -- Streak logic
  v_new_streak := v_profile.streak_days;
  IF v_profile.last_study_date IS NULL THEN
    v_new_streak := 1;
  ELSIF v_profile.last_study_date = v_yesterday THEN
    v_new_streak := v_new_streak + 1;
  ELSIF v_profile.last_study_date < v_yesterday THEN
    v_new_streak := 1;
  END IF;

  -- Set bypass to allow gamification column updates
  PERFORM set_config('app.bypass_gamification_guard', 'true', true);

  UPDATE profiles SET
    xp = v_new_xp,
    coins = v_new_coins,
    level = v_new_level,
    streak_days = v_new_streak,
    last_study_date = v_today,
    updated_at = now()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'xp', v_new_xp,
    'coins', v_new_coins,
    'level', v_new_level,
    'streak_days', v_new_streak,
    'leveled_up', v_leveled_up
  );
END;
$$;

-- Also update increment_study_minutes to bypass the guard
CREATE OR REPLACE FUNCTION public.increment_study_minutes(p_user_id uuid, p_minutes integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.bypass_gamification_guard', 'true', true);
  UPDATE profiles
  SET total_study_minutes = total_study_minutes + p_minutes
  WHERE user_id = p_user_id;
END;
$$;
