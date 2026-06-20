
-- Resources table for persistent AI-generated study materials
CREATE TABLE public.resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  curriculum text NOT NULL,
  subject text NOT NULL,
  topic text NOT NULL,
  resource_type text NOT NULL DEFAULT 'notes',
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  quality_score integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, curriculum, subject, topic, resource_type)
);

ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own resources" ON public.resources FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own resources" ON public.resources FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own resources" ON public.resources FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own resources" ON public.resources FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Leaderboard entries table
CREATE TABLE public.leaderboard_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  display_name text NOT NULL DEFAULT 'Anonymous',
  avatar_url text,
  xp integer NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 1,
  period text NOT NULL DEFAULT 'all_time',
  period_start date NOT NULL DEFAULT CURRENT_DATE,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, period, period_start)
);

ALTER TABLE public.leaderboard_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view leaderboard" ON public.leaderboard_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own entries" ON public.leaderboard_entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own entries" ON public.leaderboard_entries FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Game sessions for tracking game mode progress
CREATE TABLE public.game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  game_mode text NOT NULL,
  score integer NOT NULL DEFAULT 0,
  xp_earned integer NOT NULL DEFAULT 0,
  coins_earned integer NOT NULL DEFAULT 0,
  data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own game sessions" ON public.game_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own game sessions" ON public.game_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Enable realtime for leaderboard
ALTER PUBLICATION supabase_realtime ADD TABLE public.leaderboard_entries;

-- Function to sync leaderboard from profile
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
