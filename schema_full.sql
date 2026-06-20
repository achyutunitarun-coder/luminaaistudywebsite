-- Migration: 20260306080304_c1d51353-bdfa-4fbe-bca3-1016c10d2fb6.sql
-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  coins INTEGER NOT NULL DEFAULT 0,
  streak_days INTEGER NOT NULL DEFAULT 0,
  last_study_date DATE,
  study_mode TEXT DEFAULT 'exam_preparation',
  difficulty TEXT DEFAULT 'adaptive',
  learning_style TEXT DEFAULT 'deep_explanation',
  gamification_mode TEXT DEFAULT 'solo',
  theme TEXT DEFAULT 'dark',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Chats
CREATE TABLE public.chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Chat',
  chat_type TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own chats" ON public.chats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own chats" ON public.chats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own chats" ON public.chats FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own chats" ON public.chats FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_chats_updated_at BEFORE UPDATE ON public.chats FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Chat messages
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own chat messages" ON public.chat_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.chats WHERE chats.id = chat_messages.chat_id AND chats.user_id = auth.uid())
);
CREATE POLICY "Users can insert own chat messages" ON public.chat_messages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.chats WHERE chats.id = chat_messages.chat_id AND chats.user_id = auth.uid())
);

-- Tests
CREATE TABLE public.tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT,
  syllabus TEXT,
  total_questions INTEGER NOT NULL DEFAULT 0,
  correct_answers INTEGER NOT NULL DEFAULT 0,
  score NUMERIC(5,2),
  status TEXT NOT NULL DEFAULT 'pending',
  questions JSONB,
  answers JSONB,
  analysis JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own tests" ON public.tests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tests" ON public.tests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tests" ON public.tests FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_tests_updated_at BEFORE UPDATE ON public.tests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Flashcard decks
CREATE TABLE public.flashcard_decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT,
  source TEXT,
  card_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.flashcard_decks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own decks" ON public.flashcard_decks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own decks" ON public.flashcard_decks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own decks" ON public.flashcard_decks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own decks" ON public.flashcard_decks FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_flashcard_decks_updated_at BEFORE UPDATE ON public.flashcard_decks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Flashcards
CREATE TABLE public.flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL REFERENCES public.flashcard_decks(id) ON DELETE CASCADE,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  difficulty INTEGER NOT NULL DEFAULT 0,
  next_review TIMESTAMPTZ DEFAULT now(),
  review_count INTEGER NOT NULL DEFAULT 0,
  ease_factor NUMERIC(4,2) NOT NULL DEFAULT 2.50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own flashcards" ON public.flashcards FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.flashcard_decks WHERE flashcard_decks.id = flashcards.deck_id AND flashcard_decks.user_id = auth.uid())
);
CREATE POLICY "Users can insert own flashcards" ON public.flashcards FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.flashcard_decks WHERE flashcard_decks.id = flashcards.deck_id AND flashcard_decks.user_id = auth.uid())
);
CREATE POLICY "Users can update own flashcards" ON public.flashcards FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.flashcard_decks WHERE flashcard_decks.id = flashcards.deck_id AND flashcard_decks.user_id = auth.uid())
);

-- Daily quests
CREATE TABLE public.daily_quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quest_type TEXT NOT NULL,
  description TEXT NOT NULL,
  target INTEGER NOT NULL DEFAULT 1,
  progress INTEGER NOT NULL DEFAULT 0,
  xp_reward INTEGER NOT NULL DEFAULT 10,
  coin_reward INTEGER NOT NULL DEFAULT 5,
  completed BOOLEAN NOT NULL DEFAULT false,
  quest_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_quests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own quests" ON public.daily_quests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own quests" ON public.daily_quests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own quests" ON public.daily_quests FOR UPDATE USING (auth.uid() = user_id);

-- Achievements
CREATE TABLE public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_name TEXT NOT NULL,
  badge_icon TEXT,
  description TEXT,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own achievements" ON public.achievements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own achievements" ON public.achievements FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Migration: 20260306080305_add_onboarding.sql
-- Add onboarding_completed column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- Migration: 20260307053621_cbf11a40-471c-4c0a-bb3f-6d60dbe79eac.sql
-- Study plans table
CREATE TABLE public.study_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  exam_date DATE NOT NULL,
  subjects JSONB NOT NULL DEFAULT '[]',
  daily_hours NUMERIC NOT NULL DEFAULT 2,
  plan_data JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.study_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own plans" ON public.study_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own plans" ON public.study_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own plans" ON public.study_plans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own plans" ON public.study_plans FOR DELETE USING (auth.uid() = user_id);

-- Mistakes table
CREATE TABLE public.mistakes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  topic TEXT NOT NULL,
  subject TEXT,
  mistake_type TEXT NOT NULL DEFAULT 'conceptual',
  question TEXT,
  user_answer TEXT,
  correct_answer TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.mistakes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own mistakes" ON public.mistakes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own mistakes" ON public.mistakes FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Study sessions table
CREATE TABLE public.study_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  tools_used JSONB DEFAULT '[]',
  tests_taken INTEGER NOT NULL DEFAULT 0,
  test_scores JSONB DEFAULT '[]',
  notes_generated INTEGER NOT NULL DEFAULT 0,
  flashcards_reviewed INTEGER NOT NULL DEFAULT 0,
  doubts_solved INTEGER NOT NULL DEFAULT 0,
  analysis JSONB,
  status TEXT NOT NULL DEFAULT 'active'
);
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own sessions" ON public.study_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sessions" ON public.study_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON public.study_sessions FOR UPDATE USING (auth.uid() = user_id);

-- Add total_study_minutes to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_study_minutes INTEGER NOT NULL DEFAULT 0;

-- Migration: 20260307152721_4b1ea84c-884d-4040-9406-789066f82b9a.sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS extra_preferences text DEFAULT NULL;

-- Migration: 20260307155326_e7f72800-f9ed-4492-8563-d42514d8dec0.sql
UPDATE study_sessions SET status = 'completed', ended_at = now(), duration_minutes = 0 WHERE status = 'active';
UPDATE study_sessions SET duration_minutes = 0;

-- Migration: 20260308073544_02fe62be-4f79-465a-afe0-f0096cf17679.sql
UPDATE study_sessions SET duration_minutes = 0;
UPDATE profiles SET total_study_minutes = 0;

-- Migration: 20260308074642_c10b65ce-c496-4745-b134-461e9b3d517e.sql
CREATE OR REPLACE FUNCTION public.increment_study_minutes(p_user_id uuid, p_minutes integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET total_study_minutes = total_study_minutes + p_minutes
  WHERE user_id = p_user_id;
END;
$$;

-- Migration: 20260312101310_a3895a67-3dfb-48ac-aa7a-6c49d397fac4.sql
CREATE TABLE public.transcription_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'processing',
  result jsonb,
  error text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.transcription_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own jobs" ON public.transcription_jobs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Anon can insert jobs" ON public.transcription_jobs
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Service can update jobs" ON public.transcription_jobs
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Migration: 20260312131619_56196f0a-9237-4c1c-98b3-480bf897d7c7.sql
CREATE TABLE public.saved_lectures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Untitled Lecture',
  transcript_text text,
  notes text,
  podcast_script text,
  source_type text DEFAULT 'audio',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_lectures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own lectures" ON public.saved_lectures FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own lectures" ON public.saved_lectures FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own lectures" ON public.saved_lectures FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own lectures" ON public.saved_lectures FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_saved_lectures_updated_at BEFORE UPDATE ON public.saved_lectures FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Migration: 20260326124233_cc094c90-6531-4f92-a0c4-0edbc5e32c6f.sql
CREATE TABLE public.usage_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  feature text NOT NULL,
  usage_count integer NOT NULL DEFAULT 0,
  period_start date NOT NULL DEFAULT CURRENT_DATE,
  period_type text NOT NULL DEFAULT 'daily',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, feature, period_start, period_type)
);

ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage" ON public.usage_tracking FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own usage" ON public.usage_tracking FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own usage" ON public.usage_tracking FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  subscription_id text,
  status text NOT NULL DEFAULT 'inactive',
  plan text NOT NULL DEFAULT 'basic',
  current_period_end timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription" ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own subscription" ON public.subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.increment_usage(p_user_id uuid, p_feature text, p_period_type text DEFAULT 'daily')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_period_start date;
  v_count integer;
BEGIN
  IF p_period_type = 'weekly' THEN
    v_period_start := date_trunc('week', CURRENT_DATE)::date;
  ELSE
    v_period_start := CURRENT_DATE;
  END IF;

  INSERT INTO usage_tracking (user_id, feature, usage_count, period_start, period_type)
  VALUES (p_user_id, p_feature, 1, v_period_start, p_period_type)
  ON CONFLICT (user_id, feature, period_start, period_type)
  DO UPDATE SET usage_count = usage_tracking.usage_count + 1, updated_at = now()
  RETURNING usage_count INTO v_count;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_usage_count(p_user_id uuid, p_feature text, p_period_type text DEFAULT 'daily')
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_period_start date;
  v_count integer;
BEGIN
  IF p_period_type = 'weekly' THEN
    v_period_start := date_trunc('week', CURRENT_DATE)::date;
  ELSE
    v_period_start := CURRENT_DATE;
  END IF;

  SELECT usage_count INTO v_count
  FROM usage_tracking
  WHERE user_id = p_user_id AND feature = p_feature AND period_start = v_period_start AND period_type = p_period_type;

  RETURN COALESCE(v_count, 0);
END;
$$;

-- Migration: 20260328062308_c3c18458-3e4b-4c2e-9b89-24b5172cd7af.sql
-- 1. Fix profiles: restrict SELECT to own profile only
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 2. Fix transcription_jobs: remove overly permissive policies
DROP POLICY IF EXISTS "Service can update jobs" ON public.transcription_jobs;
DROP POLICY IF EXISTS "Anon can insert jobs" ON public.transcription_jobs;

-- Recreate with proper restrictions
CREATE POLICY "Authenticated users can insert own jobs"
  ON public.transcription_jobs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update own jobs"
  ON public.transcription_jobs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Add missing DELETE policies
CREATE POLICY "Users can delete own tests"
  ON public.tests FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own flashcards"
  ON public.flashcards FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM flashcard_decks
    WHERE flashcard_decks.id = flashcards.deck_id
    AND flashcard_decks.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own mistakes"
  ON public.mistakes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own achievements"
  ON public.achievements FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own quests"
  ON public.daily_quests FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON public.study_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transcription_jobs"
  ON public.transcription_jobs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own usage"
  ON public.usage_tracking FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Migration: 20260328062404_005feeb6-c74f-4417-95f7-b5643d043bcc.sql
-- 1. Subscriptions: remove user INSERT, only service role should manage
DROP POLICY IF EXISTS "Users can insert own subscription" ON public.subscriptions;

-- 2. Achievements: remove public INSERT, only service role should award
DROP POLICY IF EXISTS "Users can insert own achievements" ON public.achievements;

-- 3. Usage tracking: remove user write access, only service role functions should manage
DROP POLICY IF EXISTS "Users can insert own usage" ON public.usage_tracking;
DROP POLICY IF EXISTS "Users can update own usage" ON public.usage_tracking;
DROP POLICY IF EXISTS "Users can delete own usage" ON public.usage_tracking;

-- 4. Chat messages: add DELETE policy
CREATE POLICY "Users can delete own chat messages"
  ON public.chat_messages FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM chats
    WHERE chats.id = chat_messages.chat_id
    AND chats.user_id = auth.uid()
  ));

-- 5. Mistakes: add UPDATE policy
CREATE POLICY "Users can update own mistakes"
  ON public.mistakes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- 6. Profiles: fix INSERT to authenticated only
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Migration: 20260329100852_34a08339-7ec5-4225-b4db-9464a6218626.sql
-- Fix all RLS policies: change from public role to authenticated role
-- This prevents anonymous/unauthenticated users from even attempting queries

-- CHATS table
DROP POLICY IF EXISTS "Users can delete own chats" ON public.chats;
DROP POLICY IF EXISTS "Users can insert own chats" ON public.chats;
DROP POLICY IF EXISTS "Users can update own chats" ON public.chats;
DROP POLICY IF EXISTS "Users can view own chats" ON public.chats;

CREATE POLICY "Users can delete own chats" ON public.chats FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own chats" ON public.chats FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own chats" ON public.chats FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own chats" ON public.chats FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- CHAT_MESSAGES table
DROP POLICY IF EXISTS "Users can insert own chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can view own chat messages" ON public.chat_messages;

CREATE POLICY "Users can insert own chat messages" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM chats WHERE chats.id = chat_messages.chat_id AND chats.user_id = auth.uid()));
CREATE POLICY "Users can view own chat messages" ON public.chat_messages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM chats WHERE chats.id = chat_messages.chat_id AND chats.user_id = auth.uid()));

-- ACHIEVEMENTS table
DROP POLICY IF EXISTS "Users can view own achievements" ON public.achievements;
CREATE POLICY "Users can view own achievements" ON public.achievements FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- DAILY_QUESTS table
DROP POLICY IF EXISTS "Users can insert own quests" ON public.daily_quests;
DROP POLICY IF EXISTS "Users can update own quests" ON public.daily_quests;
DROP POLICY IF EXISTS "Users can view own quests" ON public.daily_quests;

CREATE POLICY "Users can insert own quests" ON public.daily_quests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own quests" ON public.daily_quests FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own quests" ON public.daily_quests FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- FLASHCARD_DECKS table
DROP POLICY IF EXISTS "Users can delete own decks" ON public.flashcard_decks;
DROP POLICY IF EXISTS "Users can insert own decks" ON public.flashcard_decks;
DROP POLICY IF EXISTS "Users can update own decks" ON public.flashcard_decks;
DROP POLICY IF EXISTS "Users can view own decks" ON public.flashcard_decks;

CREATE POLICY "Users can delete own decks" ON public.flashcard_decks FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own decks" ON public.flashcard_decks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own decks" ON public.flashcard_decks FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own decks" ON public.flashcard_decks FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- FLASHCARDS table
DROP POLICY IF EXISTS "Users can view own flashcards" ON public.flashcards;
DROP POLICY IF EXISTS "Users can update own flashcards" ON public.flashcards;
DROP POLICY IF EXISTS "Users can insert own flashcards" ON public.flashcards;

CREATE POLICY "Users can view own flashcards" ON public.flashcards FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM flashcard_decks WHERE flashcard_decks.id = flashcards.deck_id AND flashcard_decks.user_id = auth.uid()));
CREATE POLICY "Users can update own flashcards" ON public.flashcards FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM flashcard_decks WHERE flashcard_decks.id = flashcards.deck_id AND flashcard_decks.user_id = auth.uid()));
CREATE POLICY "Users can insert own flashcards" ON public.flashcards FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM flashcard_decks WHERE flashcard_decks.id = flashcards.deck_id AND flashcard_decks.user_id = auth.uid()));

-- MISTAKES table
DROP POLICY IF EXISTS "Users can insert own mistakes" ON public.mistakes;
DROP POLICY IF EXISTS "Users can view own mistakes" ON public.mistakes;

CREATE POLICY "Users can insert own mistakes" ON public.mistakes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own mistakes" ON public.mistakes FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- PROFILES table
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- STUDY_PLANS table
DROP POLICY IF EXISTS "Users can delete own plans" ON public.study_plans;
DROP POLICY IF EXISTS "Users can insert own plans" ON public.study_plans;
DROP POLICY IF EXISTS "Users can update own plans" ON public.study_plans;
DROP POLICY IF EXISTS "Users can view own plans" ON public.study_plans;

CREATE POLICY "Users can delete own plans" ON public.study_plans FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own plans" ON public.study_plans FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own plans" ON public.study_plans FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own plans" ON public.study_plans FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- STUDY_SESSIONS table
DROP POLICY IF EXISTS "Users can insert own sessions" ON public.study_sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON public.study_sessions;
DROP POLICY IF EXISTS "Users can view own sessions" ON public.study_sessions;

CREATE POLICY "Users can insert own sessions" ON public.study_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON public.study_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own sessions" ON public.study_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- TESTS table
DROP POLICY IF EXISTS "Users can insert own tests" ON public.tests;
DROP POLICY IF EXISTS "Users can update own tests" ON public.tests;
DROP POLICY IF EXISTS "Users can view own tests" ON public.tests;

CREATE POLICY "Users can insert own tests" ON public.tests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tests" ON public.tests FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own tests" ON public.tests FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Migration: 20260329102838_b98e3af9-ba93-4e63-96e2-9efd349b565c.sql
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

-- Migration: 20260329122105_98c26582-3ca5-4465-968c-00166a818478.sql
-- 1. Ensure protect_gamification_columns trigger is attached to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'protect_gamification_on_update' AND tgrelid = 'public.profiles'::regclass
  ) THEN
    CREATE TRIGGER protect_gamification_on_update
      BEFORE UPDATE ON public.profiles
      FOR EACH ROW
      EXECUTE FUNCTION public.protect_gamification_columns();
  END IF;
END $$;

-- 2. Create trigger function to enforce daily_quests reward caps and prevent manipulation
CREATE OR REPLACE FUNCTION public.enforce_quest_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Cap reward values to prevent abuse
  NEW.xp_reward := LEAST(GREATEST(NEW.xp_reward, 0), 50);
  NEW.coin_reward := LEAST(GREATEST(NEW.coin_reward, 0), 25);
  NEW.target := GREATEST(NEW.target, 1);
  
  -- Prevent setting progress >= target or completed = true on INSERT
  IF TG_OP = 'INSERT' THEN
    NEW.progress := 0;
    NEW.completed := false;
  END IF;
  
  -- On UPDATE, prevent setting progress above target
  IF TG_OP = 'UPDATE' THEN
    NEW.progress := LEAST(NEW.progress, NEW.target);
    -- Only allow completed if progress actually reached target
    NEW.completed := (NEW.progress >= NEW.target);
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3. Attach the trigger
DROP TRIGGER IF EXISTS enforce_quest_limits_trigger ON public.daily_quests;
CREATE TRIGGER enforce_quest_limits_trigger
  BEFORE INSERT OR UPDATE ON public.daily_quests
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_quest_limits();

-- Migration: 20260330144601_e71846bf-e9ee-4375-a611-d5452c2be709.sql
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

-- Migration: 20260410112012_d9344296-a964-4433-9d6f-29f8cd861cff.sql
CREATE TABLE public.guided_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  topic text NOT NULL,
  difficulty text DEFAULT 'intermediate',
  steps_completed integer DEFAULT 0,
  total_steps integer DEFAULT 5,
  score numeric DEFAULT 0,
  total_questions integer DEFAULT 0,
  correct_answers integer DEFAULT 0,
  lesson_data jsonb DEFAULT '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.guided_lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own guided lessons"
ON public.guided_lessons FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own guided lessons"
ON public.guided_lessons FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own guided lessons"
ON public.guided_lessons FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own guided lessons"
ON public.guided_lessons FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Migration: 20260416022100_7c24c1cc-f9e7-4c4d-884d-7638df6f4618.sql
CREATE TABLE public.learning_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  subject text,
  topic text,
  subtopic text,
  question_text text NOT NULL,
  question_hash text UNIQUE,
  difficulty_level text DEFAULT 'medium',
  source text DEFAULT 'chat',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.learning_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on learning_questions" ON public.learning_questions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can view own learning questions" ON public.learning_questions FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.learning_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid REFERENCES public.learning_questions(id) ON DELETE CASCADE,
  model_used text,
  answer_text text NOT NULL,
  is_final boolean DEFAULT true,
  quality_score integer,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.learning_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on learning_answers" ON public.learning_answers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can view own learning answers" ON public.learning_answers FOR SELECT TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.learning_questions q WHERE q.id = learning_answers.question_id AND q.user_id = auth.uid()));

CREATE TABLE public.step_by_step_solutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid REFERENCES public.learning_questions(id) ON DELETE CASCADE,
  steps jsonb NOT NULL DEFAULT '[]',
  final_answer text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.step_by_step_solutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on step_by_step_solutions" ON public.step_by_step_solutions FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE public.learning_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid REFERENCES public.learning_questions(id) ON DELETE CASCADE,
  original_answer_id uuid REFERENCES public.learning_answers(id) ON DELETE SET NULL,
  corrected_answer text NOT NULL,
  correction_source text DEFAULT 'user',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.learning_corrections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on learning_corrections" ON public.learning_corrections FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE public.learning_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  question_id uuid REFERENCES public.learning_questions(id) ON DELETE CASCADE,
  was_correct boolean,
  time_taken integer,
  attempts_count integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.learning_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on learning_performance" ON public.learning_performance FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can view own learning performance" ON public.learning_performance FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_learning_questions_hash ON public.learning_questions(question_hash);
CREATE INDEX idx_learning_questions_subject ON public.learning_questions(subject, topic);

CREATE TABLE public.squad_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id uuid REFERENCES public.squads(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  display_name text,
  role text NOT NULL DEFAULT 'user',
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.squad_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view squad messages" ON public.squad_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.squad_members sm WHERE sm.squad_id = squad_messages.squad_id AND sm.user_id = auth.uid()));
CREATE POLICY "Members can insert squad messages" ON public.squad_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.squad_members sm WHERE sm.squad_id = squad_messages.squad_id AND sm.user_id = auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.squad_messages;

-- Migration: 20260418044902_df23ad44-b401-40ca-9ede-0ac2d75aef03.sql
-- 1. CONSENT TABLE: User opt-in for training data collection
CREATE TABLE IF NOT EXISTS public.data_consent (
  user_id UUID PRIMARY KEY,
  training_data_opt_in BOOLEAN NOT NULL DEFAULT true,
  consented_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.data_consent ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own consent select" ON public.data_consent FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users manage own consent insert" ON public.data_consent FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own consent update" ON public.data_consent FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users manage own consent delete" ON public.data_consent FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 2. LEARNING INTERACTIONS: anonymized, session-based, ML-ready
CREATE TABLE IF NOT EXISTS public.learning_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,                      -- random per-session, NOT user identity
  user_id UUID,                                  -- nullable; only kept for user-controlled deletion, NEVER exported
  subject TEXT,
  topic TEXT,
  concepts TEXT[] DEFAULT '{}',
  difficulty TEXT CHECK (difficulty IN ('easy','medium','hard')),
  language TEXT DEFAULT 'en',
  user_input TEXT NOT NULL,                      -- PII-scrubbed
  ai_response TEXT NOT NULL,                     -- PII-scrubbed
  steps JSONB,                                   -- step-by-step solution (optional)
  feedback TEXT CHECK (feedback IN ('positive','negative')),
  understood TEXT CHECK (understood IN ('understood','confusing')),
  user_correction TEXT,
  follow_up BOOLEAN DEFAULT false,
  latency_ms INTEGER,
  model_used TEXT,
  quality_score INTEGER DEFAULT 0,               -- 0-100
  device_type TEXT,                              -- 'mobile'|'desktop'|'tablet' only
  source TEXT DEFAULT 'chat',                    -- 'chat'|'doubt'|'guided'|...
  pii_scrubbed BOOLEAN NOT NULL DEFAULT true,
  exported_at TIMESTAMPTZ,                       -- set when included in a training export
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_learning_interactions_session ON public.learning_interactions(session_id);
CREATE INDEX idx_learning_interactions_subject ON public.learning_interactions(subject);
CREATE INDEX idx_learning_interactions_quality ON public.learning_interactions(quality_score DESC);
CREATE INDEX idx_learning_interactions_user ON public.learning_interactions(user_id) WHERE user_id IS NOT NULL;

ALTER TABLE public.learning_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own interactions" ON public.learning_interactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own interactions" ON public.learning_interactions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Service role full access interactions" ON public.learning_interactions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. FEEDBACK TABLE: thumbs up/down + understood/confusing
CREATE TABLE IF NOT EXISTS public.learning_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_id UUID NOT NULL REFERENCES public.learning_interactions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('thumbs_up','thumbs_down','understood','confusing','correction')),
  correction_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (interaction_id, user_id, feedback_type)
);
ALTER TABLE public.learning_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own feedback" ON public.learning_feedback FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users view own feedback" ON public.learning_feedback FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own feedback" ON public.learning_feedback FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Service role full access feedback" ON public.learning_feedback FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. AUDIT LOG: every read/export of training data is recorded
CREATE TABLE IF NOT EXISTS public.data_access_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,                          -- 'export' | 'read' | 'delete_user_data'
  actor TEXT,                                    -- 'service_role' | user_id
  record_count INTEGER,
  filters JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.data_access_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full audit access" ON public.data_access_audit FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. TRIGGER: auto-update consent updated_at
CREATE TRIGGER update_data_consent_updated_at
BEFORE UPDATE ON public.data_consent
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Quality-feedback trigger: bump interaction quality_score when feedback comes in
CREATE OR REPLACE FUNCTION public.bump_interaction_quality()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.feedback_type = 'thumbs_up' OR NEW.feedback_type = 'understood' THEN
    UPDATE learning_interactions SET quality_score = LEAST(quality_score + 15, 100), feedback = COALESCE(feedback,'positive') WHERE id = NEW.interaction_id;
  ELSIF NEW.feedback_type = 'thumbs_down' OR NEW.feedback_type = 'confusing' THEN
    UPDATE learning_interactions SET quality_score = GREATEST(quality_score - 10, 0), feedback = 'negative' WHERE id = NEW.interaction_id;
  ELSIF NEW.feedback_type = 'correction' THEN
    UPDATE learning_interactions SET quality_score = LEAST(quality_score + 25, 100), user_correction = NEW.correction_text WHERE id = NEW.interaction_id;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER feedback_bumps_quality
AFTER INSERT ON public.learning_feedback
FOR EACH ROW EXECUTE FUNCTION public.bump_interaction_quality();

-- Migration: 20260419033854_313c3ef4-76df-45dc-b176-e85313e0550f.sql
CREATE TABLE public.chat_artifacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  chat_id UUID NOT NULL,
  message_id UUID,
  artifact_type TEXT NOT NULL CHECK (artifact_type IN ('notes','exam')),
  theme TEXT NOT NULL DEFAULT 'academic-dark',
  title TEXT NOT NULL DEFAULT 'Untitled',
  html TEXT NOT NULL,
  model_used TEXT,
  line_count INTEGER NOT NULL DEFAULT 0,
  generation_time_ms INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own artifacts" ON public.chat_artifacts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own artifacts" ON public.chat_artifacts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own artifacts" ON public.chat_artifacts FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Service role full access artifacts" ON public.chat_artifacts FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX idx_chat_artifacts_chat ON public.chat_artifacts(chat_id, created_at DESC);
CREATE INDEX idx_chat_artifacts_user ON public.chat_artifacts(user_id, created_at DESC);

-- Migration: 20260426162547_9d6e38ca-34b2-46c8-a72d-88448bd59dab.sql
ALTER TABLE public.chat_artifacts DROP CONSTRAINT IF EXISTS chat_artifacts_artifact_type_check;
ALTER TABLE public.chat_artifacts ADD CONSTRAINT chat_artifacts_artifact_type_check CHECK (artifact_type = ANY (ARRAY['notes'::text, 'exam'::text, 'slides'::text]));

-- Migration: 20260502035809_3feb8f37-e86e-4577-a348-c766b237b602.sql
CREATE TABLE IF NOT EXISTS public.artifact_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  chat_id UUID REFERENCES public.chats(id) ON DELETE SET NULL,
  prompt TEXT NOT NULL,
  topic TEXT NOT NULL,
  artifact_type TEXT NOT NULL CHECK (artifact_type IN ('notes', 'exam', 'slides', 'code')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  html TEXT,
  error_message TEXT,
  model_used TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.artifact_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own artifact jobs" ON public.artifact_jobs;
CREATE POLICY "Users can view their own artifact jobs"
ON public.artifact_jobs FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own artifact jobs" ON public.artifact_jobs;
CREATE POLICY "Users can create their own artifact jobs"
ON public.artifact_jobs FOR INSERT
WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS artifact_type TEXT,
  ADD COLUMN IF NOT EXISTS artifact_html TEXT,
  ADD COLUMN IF NOT EXISTS topic TEXT,
  ADD COLUMN IF NOT EXISTS credits_used NUMERIC,
  ADD COLUMN IF NOT EXISTS new_balance NUMERIC;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_messages_message_type_check'
  ) THEN
    ALTER TABLE public.chat_messages
      ADD CONSTRAINT chat_messages_message_type_check
      CHECK (message_type IN ('text', 'artifact', 'error', 'insufficient_credits'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_messages_artifact_type_check'
  ) THEN
    ALTER TABLE public.chat_messages
      ADD CONSTRAINT chat_messages_artifact_type_check
      CHECK (artifact_type IS NULL OR artifact_type IN ('notes', 'exam', 'slides', 'code'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_artifact_jobs_user_created ON public.artifact_jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_artifact_jobs_status_created ON public.artifact_jobs(status, created_at ASC);

DROP TRIGGER IF EXISTS update_artifact_jobs_updated_at ON public.artifact_jobs;
CREATE TRIGGER update_artifact_jobs_updated_at
BEFORE UPDATE ON public.artifact_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migration: 20260504062357_ec837ab2-ba51-4afc-a697-5bc039ff3c8d.sql
create table if not exists public.user_credit_balances (
  user_id uuid primary key,
  balance numeric(12,2) not null default 5,
  plan text not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  payment_id text,
  product_id text not null,
  product_name text not null,
  credits numeric(12,2) not null,
  source text not null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (payment_id)
);

alter table public.user_credit_balances enable row level security;
alter table public.credit_transactions enable row level security;

drop policy if exists "Users can view own credit balance" on public.user_credit_balances;
create policy "Users can view own credit balance"
on public.user_credit_balances
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can view own credit transactions" on public.credit_transactions;
create policy "Users can view own credit transactions"
on public.credit_transactions
for select
to authenticated
using (auth.uid() = user_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_user_credit_balances_updated_at on public.user_credit_balances;
create trigger touch_user_credit_balances_updated_at
before update on public.user_credit_balances
for each row execute function public.touch_updated_at();

create or replace function public.get_dodo_credit_product(_product_id text)
returns table(product_name text, credits numeric, product_type text, plan_tier text)
language sql
stable
security definer
set search_path = public
as $$
  select p.product_name, p.credits, p.product_type, p.plan_tier
  from (values
    ('pdt_0NdcF1gd6Z5PBeFx8gbiE'::text, 'Starter'::text, 30::numeric, 'pack'::text, 'free'::text),
    ('pdt_0NdcF1o3DQYEdtVQBA8MG'::text, 'Standard'::text, 100::numeric, 'pack'::text, 'free'::text),
    ('pdt_0NdcF1rKPidZVQ4vdzt5u'::text, 'Power'::text, 300::numeric, 'pack'::text, 'free'::text),
    ('pdt_0NdcF1ua83g4FRUO1LhKt'::text, 'Mega'::text, 800::numeric, 'pack'::text, 'free'::text),
    ('pdt_0NbKNHJ5nK556qajM5MKa'::text, 'Ultimate'::text, 40::numeric, 'subscription'::text, 'ultimate'::text),
    ('pdt_0Nbybrhl2M0GdzScdoAwb'::text, 'PRO+'::text, 150::numeric, 'subscription'::text, 'pro_plus'::text)
  ) as p(product_id, product_name, credits, product_type, plan_tier)
  where p.product_id = _product_id;
$$;

create or replace function public.apply_dodo_credits_for_user(
  _user_id uuid,
  _product_id text,
  _payment_id text default null,
  _source text default 'webhook'
)
returns table(applied boolean, balance numeric, credits_added numeric, product_name text, plan text, duplicate boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product record;
  v_payment_id text;
  v_balance numeric;
  v_plan text;
begin
  if _user_id is null then
    raise exception 'missing_user';
  end if;

  select * into v_product from public.get_dodo_credit_product(_product_id) limit 1;
  if v_product.product_name is null then
    raise exception 'unknown_product';
  end if;

  v_payment_id := nullif(trim(coalesce(_payment_id, '')), '');
  if v_payment_id is null then
    v_payment_id := coalesce(_source, 'credit') || ':' || _user_id::text || ':' || _product_id || ':' || to_char(now(), 'YYYYMMDDHH24MISSMS');
  end if;

  insert into public.user_credit_balances (user_id, balance, plan)
  values (_user_id, 5, 'free')
  on conflict (user_id) do nothing;

  if exists (select 1 from public.credit_transactions where payment_id = v_payment_id) then
    select b.balance, b.plan into v_balance, v_plan
    from public.user_credit_balances b where b.user_id = _user_id;
    return query select false, coalesce(v_balance, 0), 0::numeric, v_product.product_name, coalesce(v_plan, 'free'), true;
    return;
  end if;

  v_plan := case when v_product.product_type = 'subscription' then v_product.plan_tier else null end;

  update public.user_credit_balances
  set balance = balance + v_product.credits,
      plan = coalesce(v_plan, plan)
  where user_id = _user_id
  returning user_credit_balances.balance, user_credit_balances.plan into v_balance, v_plan;

  insert into public.credit_transactions (user_id, payment_id, product_id, product_name, credits, source, action, metadata)
  values (_user_id, v_payment_id, _product_id, v_product.product_name, v_product.credits, coalesce(_source, 'webhook'), 'Added ' || v_product.credits::text || ' credits', jsonb_build_object('product_type', v_product.product_type));

  return query select true, v_balance, v_product.credits, v_product.product_name, v_plan, false;
end;
$$;

create or replace function public.apply_dodo_credits(
  _product_id text,
  _payment_id text default null,
  _source text default 'return_url'
)
returns table(applied boolean, balance numeric, credits_added numeric, product_name text, plan text, duplicate boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  return query select * from public.apply_dodo_credits_for_user(auth.uid(), _product_id, _payment_id, _source);
end;
$$;

create or replace function public.spend_user_credits(_amount numeric, _action text default 'spend')
returns table(success boolean, balance numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_balance numeric;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;
  if _amount <= 0 or _amount > 1000 then
    raise exception 'invalid_amount';
  end if;

  insert into public.user_credit_balances (user_id, balance, plan)
  values (v_user_id, 5, 'free')
  on conflict (user_id) do nothing;

  select b.balance into v_balance
  from public.user_credit_balances b
  where b.user_id = v_user_id
  for update;

  if coalesce(v_balance, 0) < _amount then
    return query select false, coalesce(v_balance, 0);
    return;
  end if;

  update public.user_credit_balances
  set balance = balance - _amount
  where user_id = v_user_id
  returning user_credit_balances.balance into v_balance;

  insert into public.credit_transactions (user_id, payment_id, product_id, product_name, credits, source, action)
  values (v_user_id, null, 'spend', coalesce(_action, 'spend'), -_amount, 'spend', coalesce(_action, 'spend'));

  return query select true, v_balance;
end;
$$;

revoke execute on function public.apply_dodo_credits_for_user(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.apply_dodo_credits_for_user(uuid,text,text,text) to service_role;
grant execute on function public.apply_dodo_credits(text,text,text) to authenticated;
grant execute on function public.spend_user_credits(numeric,text) to authenticated;

-- Migration: 20260504062425_495be6c1-3c19-4846-8f22-e788962e3cdd.sql
revoke execute on function public.get_dodo_credit_product(text) from public, anon;
revoke execute on function public.apply_dodo_credits(text,text,text) from public, anon;
revoke execute on function public.apply_dodo_credits_for_user(uuid,text,text,text) from public, anon, authenticated;
revoke execute on function public.spend_user_credits(numeric,text) from public, anon;

grant execute on function public.get_dodo_credit_product(text) to authenticated, service_role;
grant execute on function public.apply_dodo_credits(text,text,text) to authenticated;
grant execute on function public.apply_dodo_credits_for_user(uuid,text,text,text) to service_role;
grant execute on function public.spend_user_credits(numeric,text) to authenticated;

-- Migration: 20260601044811_39ed7356-c7c1-4a11-b8dc-aec6db3cbbe2.sql
-- 1. parent_links: remove permissive anon read; add a SECURITY DEFINER lookup-by-code function
DROP POLICY IF EXISTS "Public read by access code" ON public.parent_links;

CREATE OR REPLACE FUNCTION public.get_parent_link_by_code(_code text)
RETURNS TABLE(id uuid, student_id uuid, parent_email text, access_code text, linked_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, student_id, parent_email, access_code, linked_at
  FROM public.parent_links
  WHERE access_code = _code
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_parent_link_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_parent_link_by_code(text) TO anon, authenticated;

-- 2. storage delete policy for exam-pack-html
DROP POLICY IF EXISTS "Users can delete own exam pack files" ON storage.objects;
CREATE POLICY "Users can delete own exam pack files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'exam-pack-html' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- 3. Restrict realtime postgres_changes to authenticated only
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'realtime' AND tablename = 'messages') THEN
    EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can receive realtime" ON realtime.messages';
    EXECUTE 'CREATE POLICY "Authenticated users can receive realtime" ON realtime.messages FOR SELECT TO authenticated USING (true)';
  END IF;
END $$;

-- 4. Revoke EXECUTE on internal SECURITY DEFINER helpers from anon/authenticated where appropriate
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.protect_gamification_columns() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.bump_interaction_quality() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_quest_limits() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_study_minutes(uuid, integer) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_leaderboard(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_dodo_credits_for_user(uuid, text, text, text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_dodo_credit_product(text) FROM anon, PUBLIC;

-- Migration: 20260602052331_cd9f6632-e1ea-4443-988f-85d8803262c2.sql
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

-- Migration: 20260602053409_78ab28cc-97fe-4bb9-a3d1-dd450b4dbbb6.sql
REVOKE EXECUTE ON FUNCTION public.apply_dodo_credits(text, text, text) FROM authenticated, anon, public;

-- Migration: 20260605135446_cb398f96-012d-4ece-bdcc-63a64e61d594.sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.artifact_jobs TO authenticated;
GRANT ALL ON public.artifact_jobs TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_artifacts TO authenticated;
GRANT ALL ON public.chat_artifacts TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_plans TO authenticated;
GRANT ALL ON public.study_plans TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.flashcard_decks TO authenticated;
GRANT ALL ON public.flashcard_decks TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.flashcards TO authenticated;
GRANT ALL ON public.flashcards TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.guided_lessons TO authenticated;
GRANT ALL ON public.guided_lessons TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_lectures TO authenticated;
GRANT ALL ON public.saved_lectures TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tests TO authenticated;
GRANT ALL ON public.tests TO service_role;

-- Migration: 20260606033456_02200699-f573-4916-a703-b1e5f3405517.sql
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

-- Migration: 20260606035120_47745d77-e0d0-43d5-96b9-1e2566e151bb.sql
-- thread_summaries
CREATE TABLE public.thread_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL,
  user_id uuid NOT NULL,
  summary_text text NOT NULL,
  messages_covered integer NOT NULL,
  token_count integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX thread_summaries_thread_idx ON public.thread_summaries(thread_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.thread_summaries TO authenticated;
GRANT ALL ON public.thread_summaries TO service_role;
ALTER TABLE public.thread_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own thread summaries" ON public.thread_summaries FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- hot_cache
CREATE TABLE public.hot_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash text UNIQUE NOT NULL,
  canonical_query text NOT NULL,
  feature text NOT NULL,
  board text NOT NULL DEFAULT 'all',
  answer text NOT NULL,
  hit_count integer NOT NULL DEFAULT 0,
  generated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX hot_cache_lookup ON public.hot_cache(query_hash, feature);
GRANT SELECT ON public.hot_cache TO authenticated;
GRANT ALL ON public.hot_cache TO service_role;
ALTER TABLE public.hot_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated reads hot cache" ON public.hot_cache FOR SELECT TO authenticated USING (true);

-- crisis_sessions
CREATE TABLE public.crisis_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL,
  state text NOT NULL,
  initiated_at timestamptz NOT NULL DEFAULT now(),
  last_updated timestamptz NOT NULL DEFAULT now(),
  notes text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crisis_sessions TO authenticated;
GRANT ALL ON public.crisis_sessions TO service_role;
ALTER TABLE public.crisis_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own crisis session" ON public.crisis_sessions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- safety_events
CREATE TABLE public.safety_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  feature text,
  timestamp timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX safety_events_user_idx ON public.safety_events(user_id, timestamp DESC);
GRANT SELECT ON public.safety_events TO authenticated;
GRANT ALL ON public.safety_events TO service_role;
ALTER TABLE public.safety_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own safety events" ON public.safety_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Migration: 20260608070501_d4be5c85-43f6-4cc8-9d7b-38d36fb04c1d.sql
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

-- Migration: 20260608071100_f9f342c6-4db3-47fe-b4ae-8e52feb31e47.sql
UPDATE public.crisis_sessions SET state='resolved', last_updated=now() WHERE state NOT IN ('resolved','escalated');

-- Migration: 20260608073214_b94442ea-ed31-4e94-8f8c-103481b91e28.sql
CREATE TABLE IF NOT EXISTS public.user_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google','notion')),
  account_email text,
  account_label text,
  scopes text[] DEFAULT '{}'::text[],
  access_token text NOT NULL,
  refresh_token text,
  token_expires_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_connections TO authenticated;
GRANT ALL ON public.user_connections TO service_role;

ALTER TABLE public.user_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own connections"
  ON public.user_connections FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users delete own connections"
  ON public.user_connections FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Inserts and updates go through edge functions (service_role) so tokens
-- are never written directly from the client.

CREATE TRIGGER user_connections_touch_updated_at
  BEFORE UPDATE ON public.user_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Migration: 20260608080300_324c7726-d50d-4b40-8578-7d63191bd587.sql
CREATE OR REPLACE FUNCTION public.sync_dodo_entitlement_for_user(
  _user_id uuid,
  _product_id text,
  _payment_id text DEFAULT NULL,
  _subscription_id text DEFAULT NULL,
  _status text DEFAULT 'active',
  _current_period_end timestamptz DEFAULT NULL,
  _source text DEFAULT 'webhook'
)
RETURNS TABLE(applied boolean, balance numeric, credits_added numeric, product_name text, plan text, duplicate boolean, subscription_active boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product record;
  v_payment_id text;
  v_balance numeric;
  v_plan text;
  v_duplicate boolean := false;
  v_is_active boolean;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'missing_user';
  END IF;

  SELECT * INTO v_product FROM public.get_dodo_credit_product(_product_id) LIMIT 1;
  IF v_product.product_name IS NULL THEN
    RAISE EXCEPTION 'unknown_product';
  END IF;

  v_is_active := lower(coalesce(_status, 'active')) IN (
    'active', 'paid', 'succeeded', 'success', 'completed', 'approved', 'renewed', 'on_trial'
  );

  v_payment_id := nullif(trim(coalesce(_payment_id, '')), '');
  IF v_payment_id IS NULL THEN
    v_payment_id := coalesce(nullif(trim(_subscription_id), ''), coalesce(_source, 'dodo'))
      || ':' || _user_id::text || ':' || _product_id || ':' || to_char(now(), 'YYYYMMDDHH24MISSMS');
  END IF;

  INSERT INTO public.user_credit_balances (user_id, balance, plan)
  VALUES (_user_id, 5, 'free')
  ON CONFLICT (user_id) DO NOTHING;

  IF v_product.product_type = 'subscription' THEN
    v_plan := CASE WHEN v_is_active THEN v_product.plan_tier ELSE 'basic' END;

    INSERT INTO public.subscriptions (user_id, subscription_id, status, plan, current_period_end, updated_at)
    VALUES (
      _user_id,
      nullif(trim(coalesce(_subscription_id, v_payment_id)), ''),
      CASE WHEN v_is_active THEN 'active' ELSE 'inactive' END,
      v_plan,
      _current_period_end,
      now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      subscription_id = coalesce(excluded.subscription_id, public.subscriptions.subscription_id),
      status = excluded.status,
      plan = excluded.plan,
      current_period_end = coalesce(excluded.current_period_end, public.subscriptions.current_period_end),
      updated_at = now();

    IF v_is_active THEN
      UPDATE public.user_credit_balances
      SET plan = v_product.plan_tier
      WHERE user_id = _user_id;
    END IF;
  ELSE
    SELECT b.plan INTO v_plan FROM public.user_credit_balances b WHERE b.user_id = _user_id;
  END IF;

  IF NOT v_is_active THEN
    SELECT b.balance, b.plan INTO v_balance, v_plan
    FROM public.user_credit_balances b WHERE b.user_id = _user_id;
    RETURN QUERY SELECT false, coalesce(v_balance, 0), 0::numeric, v_product.product_name, coalesce(v_plan, 'free'), false, false;
    RETURN;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.credit_transactions WHERE payment_id = v_payment_id) INTO v_duplicate;

  IF NOT v_duplicate THEN
    UPDATE public.user_credit_balances
    SET balance = balance + v_product.credits,
        plan = CASE WHEN v_product.product_type = 'subscription' THEN v_product.plan_tier ELSE plan END
    WHERE user_id = _user_id
    RETURNING user_credit_balances.balance, user_credit_balances.plan INTO v_balance, v_plan;

    INSERT INTO public.credit_transactions (user_id, payment_id, product_id, product_name, credits, source, action, metadata)
    VALUES (
      _user_id,
      v_payment_id,
      _product_id,
      v_product.product_name,
      v_product.credits,
      coalesce(_source, 'webhook'),
      'Added ' || v_product.credits::text || ' credits',
      jsonb_build_object('product_type', v_product.product_type, 'subscription_id', _subscription_id)
    );
  ELSE
    SELECT b.balance, b.plan INTO v_balance, v_plan
    FROM public.user_credit_balances b WHERE b.user_id = _user_id;
  END IF;

  RETURN QUERY SELECT (NOT v_duplicate), coalesce(v_balance, 0), CASE WHEN v_duplicate THEN 0::numeric ELSE v_product.credits END, v_product.product_name, coalesce(v_plan, 'free'), v_duplicate, (v_product.product_type = 'subscription' AND v_is_active);
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_dodo_credits_for_user(
  _user_id uuid,
  _product_id text,
  _payment_id text DEFAULT NULL,
  _source text DEFAULT 'webhook'
)
RETURNS TABLE(applied boolean, balance numeric, credits_added numeric, product_name text, plan text, duplicate boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT s.applied, s.balance, s.credits_added, s.product_name, s.plan, s.duplicate
  FROM public.sync_dodo_entitlement_for_user(
    _user_id,
    _product_id,
    _payment_id,
    NULL,
    'active',
    NULL,
    _source
  ) AS s;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_dodo_entitlement_for_user(uuid,text,text,text,text,timestamptz,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_dodo_entitlement_for_user(uuid,text,text,text,text,timestamptz,text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.apply_dodo_credits_for_user(uuid,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_dodo_credits_for_user(uuid,text,text,text) TO service_role;

-- Migration: 20260608101040_bdd57e8a-cf8d-4dad-903a-9c6d260a8391.sql
ALTER POLICY "Users can create their own artifact jobs" ON public.artifact_jobs TO authenticated;
ALTER POLICY "Users can view their own artifact jobs" ON public.artifact_jobs TO authenticated;

-- Migration: 20260608104348_9f31b823-8541-4070-b734-ef0922a7f9d7.sql
CREATE POLICY "Users insert own safety events" ON public.safety_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Migration: 20260610071905_04aaa840-f5d8-4b5b-8714-dcc8850f08fc.sql
DROP POLICY IF EXISTS "Users upload own pack html" ON storage.objects;
CREATE POLICY "Users upload own pack html" ON storage.objects
FOR INSERT TO authenticated
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

DROP POLICY IF EXISTS "Users update own pack html" ON storage.objects;
CREATE POLICY "Users update own pack html" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'exam-pack-html'
  AND (auth.uid())::text = (storage.foldername(name))[1]
)
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

-- Migration: 20260612081229_38e66832-be4d-4215-ac82-1a3485897cb3.sql
-- 1) Allow reading shared (null user_id) learning questions
DROP POLICY IF EXISTS "Read shared learning questions" ON public.learning_questions;
CREATE POLICY "Read shared learning questions"
ON public.learning_questions
FOR SELECT
TO authenticated
USING (user_id IS NULL);

-- 2) Tighten storage DELETE policy to also require an active unlock
DROP POLICY IF EXISTS "Users can delete own exam pack files" ON storage.objects;
CREATE POLICY "Users can delete own exam pack files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'exam-pack-html'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1 FROM public.user_unlocked_packs u
    WHERE u.user_id = auth.uid()
      AND u.payment_status = 'completed'
      AND u.pack_id::text = (storage.foldername(name))[2]
  )
);

-- Migration: 20260612101155_2b46da8b-907e-4136-b806-5126ee2bcb56.sql
CREATE OR REPLACE FUNCTION public.get_dodo_credit_product(_product_id text)
 RETURNS TABLE(product_name text, credits numeric, product_type text, plan_tier text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.product_name, p.credits, p.product_type, p.plan_tier
  from (values
    ('pdt_0NdcF1gd6Z5PBeFx8gbiE'::text, 'Starter'::text, 30::numeric, 'pack'::text, 'free'::text),
    ('pdt_0NdcF1o3DQYEdtVQBA8MG'::text, 'Standard'::text, 100::numeric, 'pack'::text, 'free'::text),
    ('pdt_0NdcF1rKPidZVQ4vdzt5u'::text, 'Power'::text, 300::numeric, 'pack'::text, 'free'::text),
    ('pdt_0NdcF1ua83g4FRUO1LhKt'::text, 'Mega'::text, 800::numeric, 'pack'::text, 'free'::text),
    ('pdt_0NbKNHJ5nK556qajM5MKa'::text, 'Ultimate'::text, 40::numeric, 'subscription'::text, 'ultimate'::text),
    ('pdt_0Nbybrhl2M0GdzScdoAwb'::text, 'PRO+'::text, 150::numeric, 'subscription'::text, 'pro_plus'::text),
    ('pdt_0NgrUZL3QLR2Xmw2PQgRR'::text, 'MEGA'::text, 300::numeric, 'subscription'::text, 'pro_plus'::text),
    ('pdt_0NgrZWBT2Irz439pIp6Xn'::text, 'POWER+'::text, 500::numeric, 'subscription'::text, 'pro_plus'::text)
  ) as p(product_id, product_name, credits, product_type, plan_tier)
  where p.product_id = _product_id;
$function$;

-- Migration: 20260614104241_email_infra.sql
-- Email infrastructure
-- Creates the queue system, send log, send state, suppression, and unsubscribe
-- tables used by both auth and transactional emails.

-- Extensions required for queue processing
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    CREATE EXTENSION pg_cron;
  END IF;
END $$;
CREATE EXTENSION IF NOT EXISTS supabase_vault;
CREATE EXTENSION IF NOT EXISTS pgmq;

-- Create email queues (auth = high priority, transactional = normal)
-- Wrapped in DO blocks to handle "queue already exists" errors idempotently.
DO $$ BEGIN PERFORM pgmq.create('auth_emails'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.create('transactional_emails'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Dead-letter queues for messages that exceed max retries
DO $$ BEGIN PERFORM pgmq.create('auth_emails_dlq'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.create('transactional_emails_dlq'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Email send log table (audit trail for all send attempts)
-- UPDATE is allowed for the service role so the suppression edge function
-- can update a log record's status when a bounce/complaint/unsubscribe occurs.
CREATE TABLE IF NOT EXISTS public.email_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT,
  template_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'suppressed', 'failed', 'bounced', 'complained', 'dlq')),
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Supabase no longer grants public-schema access to service_role by default;
-- emit the grant explicitly so edge functions can reach the table via PostgREST.
GRANT ALL ON public.email_send_log TO service_role;

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read send log"
    ON public.email_send_log FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert send log"
    ON public.email_send_log FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can update send log"
    ON public.email_send_log FOR UPDATE
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_send_log_created ON public.email_send_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_send_log_recipient ON public.email_send_log(recipient_email);

-- Backfill: add message_id column to existing tables that predate this migration
DO $$ BEGIN
  ALTER TABLE public.email_send_log ADD COLUMN message_id TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_send_log_message ON public.email_send_log(message_id);

-- Prevent duplicate sends: only one 'sent' row per message_id.
-- If VT expires and another worker picks up the same message, the pre-send
-- check catches it. This index is a DB-level safety net for race conditions.
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_send_log_message_sent_unique
  ON public.email_send_log(message_id) WHERE status = 'sent';

-- Backfill: update status CHECK constraint for existing tables that predate new statuses
DO $$ BEGIN
  ALTER TABLE public.email_send_log DROP CONSTRAINT IF EXISTS email_send_log_status_check;
  ALTER TABLE public.email_send_log ADD CONSTRAINT email_send_log_status_check
    CHECK (status IN ('pending', 'sent', 'suppressed', 'failed', 'bounced', 'complained', 'dlq'));
END $$;

-- Rate-limit state and queue config (single row, tracks Retry-After cooldown + throughput settings)
CREATE TABLE IF NOT EXISTS public.email_send_state (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  retry_after_until TIMESTAMPTZ,
  batch_size INTEGER NOT NULL DEFAULT 10,
  send_delay_ms INTEGER NOT NULL DEFAULT 200,
  auth_email_ttl_minutes INTEGER NOT NULL DEFAULT 15,
  transactional_email_ttl_minutes INTEGER NOT NULL DEFAULT 60,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.email_send_state (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Backfill: add config columns to existing tables that predate this migration
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN batch_size INTEGER NOT NULL DEFAULT 10;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN send_delay_ms INTEGER NOT NULL DEFAULT 200;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN auth_email_ttl_minutes INTEGER NOT NULL DEFAULT 15;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN transactional_email_ttl_minutes INTEGER NOT NULL DEFAULT 60;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

GRANT ALL ON public.email_send_state TO service_role;

ALTER TABLE public.email_send_state ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can manage send state"
    ON public.email_send_state FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RPC wrappers so Edge Functions can interact with pgmq via supabase.rpc()
-- (PostgREST only exposes functions in the public schema; pgmq functions are in the pgmq schema)
-- All wrappers auto-create the queue on undefined_table (42P01) so emails
-- are never lost if the queue was dropped (extension upgrade, restore, etc.).
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name TEXT, payload JSONB)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name TEXT, batch_size INT, vt INT)
RETURNS TABLE(msg_id BIGINT, read_ct INT, message JSONB)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name TEXT, message_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(
  source_queue TEXT, dlq_name TEXT, message_id BIGINT, payload JSONB
)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN
    PERFORM pgmq.create(dlq_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN
    PERFORM pgmq.delete(source_queue, message_id);
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  RETURN new_id;
END;
$$;

-- Restrict queue RPC wrappers to service_role only (SECURITY DEFINER runs as owner,
-- so without this any authenticated user could manipulate the email queues)
REVOKE EXECUTE ON FUNCTION public.enqueue_email(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_email(TEXT, JSONB) TO service_role;

REVOKE EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.delete_email(TEXT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_email(TEXT, BIGINT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.move_to_dlq(TEXT, TEXT, BIGINT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(TEXT, TEXT, BIGINT, JSONB) TO service_role;

-- Suppressed emails table (tracks unsubscribes, bounces, complaints)
-- Append-only: no DELETE or UPDATE policies to prevent bypassing suppression.
CREATE TABLE IF NOT EXISTS public.suppressed_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('unsubscribe', 'bounce', 'complaint')),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email)
);

GRANT ALL ON public.suppressed_emails TO service_role;

ALTER TABLE public.suppressed_emails ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read suppressed emails"
    ON public.suppressed_emails FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert suppressed emails"
    ON public.suppressed_emails FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_suppressed_emails_email ON public.suppressed_emails(email);

-- Email unsubscribe tokens table (one token per email address for unsubscribe links)
-- No DELETE policy to prevent removing tokens. UPDATE allowed only to mark tokens as used.
CREATE TABLE IF NOT EXISTS public.email_unsubscribe_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ
);

GRANT ALL ON public.email_unsubscribe_tokens TO service_role;

ALTER TABLE public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read tokens"
    ON public.email_unsubscribe_tokens FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert tokens"
    ON public.email_unsubscribe_tokens FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can mark tokens as used"
    ON public.email_unsubscribe_tokens FOR UPDATE
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_unsubscribe_tokens_token ON public.email_unsubscribe_tokens(token);

-- ============================================================
-- POST-MIGRATION STEPS (applied dynamically by setup_email_infra)
-- These steps contain project-specific secrets and URLs and
-- cannot be expressed as static SQL. They are applied via the
-- Supabase Management API (ExecuteSQL) each time the tool runs.
-- ============================================================
--
-- 1. VAULT SECRET
--    Stores (or updates) the Supabase service_role key in
--    vault as 'email_queue_service_role_key'.
--    Uses vault.create_secret / vault.update_secret (upsert).
--    To revert: DELETE FROM vault.secrets WHERE name = 'email_queue_service_role_key';
--
-- 2. CRON JOB (pg_cron)
--    Creates job 'process-email-queue' with a 5-second interval.
--    The job checks:
--      a) rate-limit cooldown (email_send_state.retry_after_until)
--      b) whether auth_emails or transactional_emails queues have messages
--    If conditions are met, it calls the process-email-queue Edge Function
--    via net.http_post using the vault-stored service_role key.
--    To revert: SELECT cron.unschedule('process-email-queue');

-- Migration: 20260615063328_b450b63e-99d3-44f2-9f3d-2c0157d6d602.sql
SELECT 1;

-- Migration: 20260615063347_3ac5731a-a34e-4b0d-80df-0e68c71e303e.sql
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;

-- Migration: 20260615063406_96630180-249a-43c5-a605-2c65a530f604.sql
DROP POLICY IF EXISTS "Block client writes to user_unlocked_packs" ON public.user_unlocked_packs;
CREATE POLICY "Block client writes to user_unlocked_packs" ON public.user_unlocked_packs AS RESTRICTIVE FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);

-- Migration: 20260616093928_cd47e417-b4e2-40f7-8924-3ab2c68074a9.sql
-- Remove client-side write access to leaderboard_entries; only the sync_leaderboard SECURITY DEFINER RPC writes.
DROP POLICY IF EXISTS "Users can insert own entries" ON public.leaderboard_entries;
DROP POLICY IF EXISTS "Users can update own entries" ON public.leaderboard_entries;

COMMENT ON TABLE public.leaderboard_entries IS 'Writes only via public.sync_leaderboard(uuid) SECURITY DEFINER RPC. No direct client INSERT/UPDATE allowed.';
COMMENT ON TABLE public.achievements IS 'Inserts performed by service role / edge functions only. Clients may read and delete their own rows.';
COMMENT ON TABLE public.usage_tracking IS 'Writes only via public.increment_usage(...) SECURITY DEFINER RPC. Clients may only read their own rows.';
COMMENT ON TABLE public.user_connections IS 'OAuth tokens. Writes performed exclusively by service role in edge functions. Clients may read/delete their own rows.';

-- Migration: 20260616095903_ce9924b8-9c62-4654-bcfd-f43207a45f76.sql
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

-- Migration: 20260617104229_c8a0c00b-1b01-487c-872d-f16cfd63b35a.sql
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

-- Migration: 20260619065343_603ea78e-cd13-4a2a-93a7-2ebe1d2c4c4a.sql
-- Remove direct client read access to OAuth tokens; all reads go through edge functions with service role.
DROP POLICY IF EXISTS "users read own connections" ON public.user_connections;
REVOKE SELECT ON public.user_connections FROM authenticated, anon;

-- Prevent students from reading their own access_code column directly; lookups must use get_parent_link_by_code().
REVOKE SELECT (access_code) ON public.parent_links FROM authenticated, anon;