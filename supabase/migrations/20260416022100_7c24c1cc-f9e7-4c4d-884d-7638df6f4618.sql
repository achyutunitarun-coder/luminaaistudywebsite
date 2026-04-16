
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
