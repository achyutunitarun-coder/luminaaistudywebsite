CREATE TABLE public.lumina_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled session',
  conversation_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  project_files jsonb NOT NULL DEFAULT '{}'::jsonb,
  agent_logs jsonb NOT NULL DEFAULT '[]'::jsonb,
  architecture_decisions jsonb NOT NULL DEFAULT '[]'::jsonb,
  task_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lumina_sessions TO authenticated;
GRANT ALL ON public.lumina_sessions TO service_role;

ALTER TABLE public.lumina_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own lumina sessions"
ON public.lumina_sessions FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX lumina_sessions_user_updated_idx ON public.lumina_sessions (user_id, updated_at DESC);

CREATE TRIGGER lumina_sessions_updated_at
BEFORE UPDATE ON public.lumina_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();