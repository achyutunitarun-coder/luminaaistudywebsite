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