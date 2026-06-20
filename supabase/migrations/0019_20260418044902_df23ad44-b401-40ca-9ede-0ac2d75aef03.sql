
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
