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