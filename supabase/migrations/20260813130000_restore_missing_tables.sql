-- Restore tables that were lost when intermediate old-style migrations were
-- reverted during the migration reconciliation (AGENTS.md). These tables are
-- referenced by deployed edge functions but no longer exist in the live DB:
--   learning_questions / learning_answers / learning_performance  -> ingest-learning-data
--   lumina_task_history                                            -> task-history
--   chat_artifacts                                                 -> generate-html-artifact
--   user_connections                                               -> connector-oauth / connector-proxy
--   crisis_sessions / safety_events / hot_cache                    -> _shared/preflight
--   learning_interactions / learning_feedback / data_access_audit  -> learning-pipeline
--   lumina_session_files                                           -> _shared/artifact-store
-- Schemas below mirror the original definitions in migrations_old/ where they
-- existed; lumina_task_history + lumina_session_files were never migrated, so
-- they are reconstructed from their only consumer.

-- ── learning_questions / learning_answers / learning_performance ──
CREATE TABLE IF NOT EXISTS public.learning_questions (
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
CREATE INDEX IF NOT EXISTS idx_learning_questions_hash ON public.learning_questions(question_hash);
CREATE INDEX IF NOT EXISTS idx_learning_questions_subject ON public.learning_questions(subject, topic);
ALTER TABLE public.learning_questions ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='learning_questions' AND policyname='Service role full access on learning_questions') THEN
    CREATE POLICY "Service role full access on learning_questions" ON public.learning_questions FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='learning_questions' AND policyname='Users can view own learning questions') THEN
    CREATE POLICY "Users can view own learning questions" ON public.learning_questions FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.learning_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid REFERENCES public.learning_questions(id) ON DELETE CASCADE,
  model_used text,
  answer_text text NOT NULL,
  is_final boolean DEFAULT true,
  quality_score integer,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.learning_answers ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='learning_answers' AND policyname='Service role full access on learning_answers') THEN
    CREATE POLICY "Service role full access on learning_answers" ON public.learning_answers FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='learning_answers' AND policyname='Users can view own learning answers') THEN
    CREATE POLICY "Users can view own learning answers" ON public.learning_answers FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.learning_questions q WHERE q.id = learning_answers.question_id AND q.user_id = auth.uid()));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.learning_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  question_id uuid REFERENCES public.learning_questions(id) ON DELETE CASCADE,
  was_correct boolean,
  time_taken integer,
  attempts_count integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.learning_performance ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='learning_performance' AND policyname='Service role full access on learning_performance') THEN
    CREATE POLICY "Service role full access on learning_performance" ON public.learning_performance FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='learning_performance' AND policyname='Users can view own learning performance') THEN
    CREATE POLICY "Users can view own learning performance" ON public.learning_performance FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── chat_artifacts ──
CREATE TABLE IF NOT EXISTS public.chat_artifacts (
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
CREATE INDEX IF NOT EXISTS idx_chat_artifacts_chat ON public.chat_artifacts(chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_artifacts_user ON public.chat_artifacts(user_id, created_at DESC);
ALTER TABLE public.chat_artifacts ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='chat_artifacts' AND policyname='Users view own artifacts') THEN
    CREATE POLICY "Users view own artifacts" ON public.chat_artifacts FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='chat_artifacts' AND policyname='Users insert own artifacts') THEN
    CREATE POLICY "Users insert own artifacts" ON public.chat_artifacts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='chat_artifacts' AND policyname='Users delete own artifacts') THEN
    CREATE POLICY "Users delete own artifacts" ON public.chat_artifacts FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='chat_artifacts' AND policyname='Service role full access artifacts') THEN
    CREATE POLICY "Service role full access artifacts" ON public.chat_artifacts FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── user_connections ──
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
ALTER TABLE public.user_connections ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_connections' AND policyname='users read own connections') THEN
    CREATE POLICY "users read own connections" ON public.user_connections FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_connections' AND policyname='users delete own connections') THEN
    CREATE POLICY "users delete own connections" ON public.user_connections FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='user_connections_touch_updated_at') THEN
    CREATE TRIGGER user_connections_touch_updated_at
      BEFORE UPDATE ON public.user_connections
      FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END $$;

-- ── crisis_sessions / safety_events / hot_cache ──
CREATE TABLE IF NOT EXISTS public.crisis_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL,
  state text NOT NULL,
  initiated_at timestamptz NOT NULL DEFAULT now(),
  last_updated timestamptz NOT NULL DEFAULT now(),
  notes text
);
ALTER TABLE public.crisis_sessions ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='crisis_sessions' AND policyname='Users manage own crisis session') THEN
    CREATE POLICY "Users manage own crisis session" ON public.crisis_sessions FOR ALL TO authenticated
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.safety_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  feature text,
  timestamp timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS safety_events_user_idx ON public.safety_events(user_id, timestamp DESC);
ALTER TABLE public.safety_events ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='safety_events' AND policyname='Users view own safety events') THEN
    CREATE POLICY "Users view own safety events" ON public.safety_events FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.hot_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash text UNIQUE NOT NULL,
  canonical_query text NOT NULL,
  feature text NOT NULL,
  board text NOT NULL DEFAULT 'all',
  answer text NOT NULL,
  hit_count integer NOT NULL DEFAULT 0,
  generated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hot_cache_lookup ON public.hot_cache(query_hash, feature);
ALTER TABLE public.hot_cache ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='hot_cache' AND policyname='Anyone authenticated reads hot cache') THEN
    CREATE POLICY "Anyone authenticated reads hot cache" ON public.hot_cache FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- ── learning_interactions / learning_feedback / data_access_audit ──
CREATE TABLE IF NOT EXISTS public.learning_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  user_id UUID,
  subject TEXT,
  topic TEXT,
  concepts TEXT[] DEFAULT '{}',
  difficulty TEXT CHECK (difficulty IN ('easy','medium','hard')),
  language TEXT DEFAULT 'en',
  user_input TEXT NOT NULL,
  ai_response TEXT NOT NULL,
  steps JSONB,
  feedback TEXT CHECK (feedback IN ('positive','negative')),
  understood TEXT CHECK (understood IN ('understood','confusing')),
  user_correction TEXT,
  follow_up BOOLEAN DEFAULT false,
  latency_ms INTEGER,
  model_used TEXT,
  quality_score INTEGER DEFAULT 0,
  device_type TEXT,
  source TEXT DEFAULT 'chat',
  pii_scrubbed BOOLEAN NOT NULL DEFAULT true,
  exported_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_learning_interactions_session ON public.learning_interactions(session_id);
CREATE INDEX IF NOT EXISTS idx_learning_interactions_subject ON public.learning_interactions(subject);
CREATE INDEX IF NOT EXISTS idx_learning_interactions_quality ON public.learning_interactions(quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_learning_interactions_user ON public.learning_interactions(user_id) WHERE user_id IS NOT NULL;
ALTER TABLE public.learning_interactions ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='learning_interactions' AND policyname='Users view own interactions') THEN
    CREATE POLICY "Users view own interactions" ON public.learning_interactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='learning_interactions' AND policyname='Users delete own interactions') THEN
    CREATE POLICY "Users delete own interactions" ON public.learning_interactions FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='learning_interactions' AND policyname='Service role full access interactions') THEN
    CREATE POLICY "Service role full access interactions" ON public.learning_interactions FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

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
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='learning_feedback' AND policyname='Users insert own feedback') THEN
    CREATE POLICY "Users insert own feedback" ON public.learning_feedback FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='learning_feedback' AND policyname='Users view own feedback') THEN
    CREATE POLICY "Users view own feedback" ON public.learning_feedback FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='learning_feedback' AND policyname='Users delete own feedback') THEN
    CREATE POLICY "Users delete own feedback" ON public.learning_feedback FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='learning_feedback' AND policyname='Service role full access feedback') THEN
    CREATE POLICY "Service role full access feedback" ON public.learning_feedback FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='feedback_bumps_quality') THEN
    CREATE OR REPLACE FUNCTION public.bump_interaction_quality()
    RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $bump$
    BEGIN
      IF NEW.feedback_type = 'thumbs_up' OR NEW.feedback_type = 'understood' THEN
        UPDATE learning_interactions SET quality_score = LEAST(quality_score + 15, 100), feedback = COALESCE(feedback,'positive') WHERE id = NEW.interaction_id;
      ELSIF NEW.feedback_type = 'thumbs_down' OR NEW.feedback_type = 'confusing' THEN
        UPDATE learning_interactions SET quality_score = GREATEST(quality_score - 10, 0), feedback = 'negative' WHERE id = NEW.interaction_id;
      ELSIF NEW.feedback_type = 'correction' THEN
        UPDATE learning_interactions SET quality_score = LEAST(quality_score + 25, 100), user_correction = NEW.correction_text WHERE id = NEW.interaction_id;
      END IF;
      RETURN NEW;
    END; $bump$;
    CREATE TRIGGER feedback_bumps_quality
      AFTER INSERT ON public.learning_feedback
      FOR EACH ROW EXECUTE FUNCTION public.bump_interaction_quality();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.data_access_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  actor TEXT,
  record_count INTEGER,
  filters JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.data_access_audit ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='data_access_audit' AND policyname='Service role full audit access') THEN
    CREATE POLICY "Service role full audit access" ON public.data_access_audit FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── lumina_task_history (reconstructed from task-history consumer) ──
CREATE TABLE IF NOT EXISTS public.lumina_task_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  request text,
  status text DEFAULT 'started',
  step_count integer DEFAULT 0,
  model_used text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lumina_task_history_user ON public.lumina_task_history(user_id, created_at DESC);
ALTER TABLE public.lumina_task_history ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='lumina_task_history' AND policyname='Users view own task history') THEN
    CREATE POLICY "Users view own task history" ON public.lumina_task_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='lumina_task_history' AND policyname='Users delete own task history') THEN
    CREATE POLICY "Users delete own task history" ON public.lumina_task_history FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='lumina_task_history' AND policyname='Service role full access task history') THEN
    CREATE POLICY "Service role full access task history" ON public.lumina_task_history FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── lumina_session_files (reconstructed from artifact-store consumer) ──
CREATE TABLE IF NOT EXISTS public.lumina_session_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  name text NOT NULL,
  file_type text,
  size bigint,
  content text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_session_files_session ON public.lumina_session_files(session_id);
ALTER TABLE public.lumina_session_files ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='lumina_session_files' AND policyname='Service role full access session files') THEN
    CREATE POLICY "Service role full access session files" ON public.lumina_session_files FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;