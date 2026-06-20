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