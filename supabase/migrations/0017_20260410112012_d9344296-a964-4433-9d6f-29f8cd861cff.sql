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