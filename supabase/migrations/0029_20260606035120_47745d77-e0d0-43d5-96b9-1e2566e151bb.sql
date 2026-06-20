
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
