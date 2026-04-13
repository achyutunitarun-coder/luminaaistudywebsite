
-- User memory and context (the brain of Lumina)
CREATE TABLE public.user_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  memory_type text NOT NULL,
  key text NOT NULL,
  value text NOT NULL,
  confidence float DEFAULT 1.0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  expires_at timestamptz
);
CREATE UNIQUE INDEX idx_user_memory_user_key ON public.user_memory(user_id, key);

-- User goals and exam targets
CREATE TABLE public.user_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  exam text NOT NULL,
  exam_date date NOT NULL,
  target_score int,
  max_score int,
  curriculum text,
  created_at timestamptz DEFAULT now()
);

-- Daily readiness snapshots
CREATE TABLE public.readiness_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL,
  score float NOT NULL,
  projected_score float,
  components jsonb,
  UNIQUE(user_id, date)
);

-- All test attempts and answers
CREATE TABLE public.test_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  test_id uuid,
  subject text,
  curriculum text,
  topic text,
  score float,
  max_score float,
  time_taken_seconds int,
  started_at timestamptz,
  completed_at timestamptz DEFAULT now()
);

-- Individual question responses
CREATE TABLE public.question_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  attempt_id uuid REFERENCES public.test_attempts(id) ON DELETE CASCADE,
  question_id text,
  question_text text,
  correct_answer text,
  student_answer text,
  is_correct boolean,
  time_spent_seconds int,
  subject text,
  topic text,
  concept text,
  difficulty text,
  created_at timestamptz DEFAULT now()
);

-- Mistake DNA tags
CREATE TABLE public.mistake_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  response_id uuid REFERENCES public.question_responses(id) ON DELETE CASCADE,
  subject text,
  topic text,
  concept text,
  error_type text,
  ai_explanation text,
  created_at timestamptz DEFAULT now()
);

-- Spaced repetition cards
CREATE TABLE public.flashcard_srs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  flashcard_id uuid,
  front text NOT NULL,
  back text NOT NULL,
  subject text,
  topic text,
  source text DEFAULT 'generated',
  ease_factor float DEFAULT 2.5,
  interval_days int DEFAULT 1,
  repetitions int DEFAULT 0,
  due_date date DEFAULT CURRENT_DATE,
  last_reviewed timestamptz,
  created_at timestamptz DEFAULT now()
);

-- SRS review log
CREATE TABLE public.srs_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  card_id uuid REFERENCES public.flashcard_srs(id) ON DELETE CASCADE,
  rating int,
  reviewed_at timestamptz DEFAULT now()
);

-- Study squads
CREATE TABLE public.squads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  invite_code text UNIQUE DEFAULT substr(md5(random()::text), 0, 8),
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.squad_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id uuid REFERENCES public.squads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  display_name text,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(squad_id, user_id)
);

CREATE TABLE public.squad_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id uuid REFERENCES public.squads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  activity_type text,
  xp_earned int DEFAULT 0,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Concept maps
CREATE TABLE public.concept_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curriculum text,
  subject text,
  chapter text,
  concept text,
  parent_concept text,
  description text,
  difficulty int DEFAULT 1
);

CREATE TABLE public.user_concept_mastery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  concept_id uuid REFERENCES public.concept_nodes(id) ON DELETE CASCADE,
  mastery_pct float DEFAULT 0,
  last_tested timestamptz,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, concept_id)
);

-- Parent access
CREATE TABLE public.parent_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  parent_email text,
  access_code text UNIQUE DEFAULT substr(md5(random()::text), 0, 10),
  linked_at timestamptz
);

-- Weekly evolution
CREATE TABLE public.weekly_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  week_start date,
  study_minutes int DEFAULT 0,
  tests_taken int DEFAULT 0,
  avg_score float,
  xp_earned int DEFAULT 0,
  topics_covered text[],
  UNIQUE(user_id, week_start)
);

-- Enable RLS on all tables
ALTER TABLE public.user_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.readiness_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mistake_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcard_srs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.srs_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concept_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_concept_mastery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_stats ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_memory
CREATE POLICY "Users can select own memory" ON public.user_memory FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own memory" ON public.user_memory FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own memory" ON public.user_memory FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own memory" ON public.user_memory FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- RLS policies for user_goals
CREATE POLICY "Users can select own goals" ON public.user_goals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own goals" ON public.user_goals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goals" ON public.user_goals FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own goals" ON public.user_goals FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- RLS policies for readiness_history
CREATE POLICY "Users can select own readiness" ON public.readiness_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own readiness" ON public.readiness_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own readiness" ON public.readiness_history FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own readiness" ON public.readiness_history FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- RLS policies for test_attempts
CREATE POLICY "Users can select own attempts" ON public.test_attempts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own attempts" ON public.test_attempts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own attempts" ON public.test_attempts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own attempts" ON public.test_attempts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- RLS policies for question_responses
CREATE POLICY "Users can select own responses" ON public.question_responses FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own responses" ON public.question_responses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own responses" ON public.question_responses FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own responses" ON public.question_responses FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- RLS policies for mistake_tags
CREATE POLICY "Users can select own tags" ON public.mistake_tags FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tags" ON public.mistake_tags FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tags" ON public.mistake_tags FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tags" ON public.mistake_tags FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- RLS policies for flashcard_srs
CREATE POLICY "Users can select own srs" ON public.flashcard_srs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own srs" ON public.flashcard_srs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own srs" ON public.flashcard_srs FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own srs" ON public.flashcard_srs FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- RLS policies for srs_reviews
CREATE POLICY "Users can select own reviews" ON public.srs_reviews FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reviews" ON public.srs_reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- RLS policies for squads (members can view)
CREATE POLICY "Members can view squads" ON public.squads FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.squad_members WHERE squad_members.squad_id = squads.id AND squad_members.user_id = auth.uid())
  OR created_by = auth.uid()
);
CREATE POLICY "Users can create squads" ON public.squads FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creators can update squads" ON public.squads FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Creators can delete squads" ON public.squads FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- Allow looking up squads by invite code for joining
CREATE POLICY "Anyone can lookup by invite code" ON public.squads FOR SELECT TO authenticated USING (true);

-- RLS policies for squad_members
CREATE POLICY "Members can view squad members" ON public.squad_members FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.squad_members sm WHERE sm.squad_id = squad_members.squad_id AND sm.user_id = auth.uid())
);
CREATE POLICY "Users can join squads" ON public.squad_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave squads" ON public.squad_members FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- RLS policies for squad_activity
CREATE POLICY "Members can view activity" ON public.squad_activity FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.squad_members WHERE squad_members.squad_id = squad_activity.squad_id AND squad_members.user_id = auth.uid())
);
CREATE POLICY "Users can insert own activity" ON public.squad_activity FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- RLS policies for concept_nodes (public read)
CREATE POLICY "Anyone can view concepts" ON public.concept_nodes FOR SELECT TO authenticated USING (true);

-- RLS policies for user_concept_mastery
CREATE POLICY "Users can select own mastery" ON public.user_concept_mastery FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own mastery" ON public.user_concept_mastery FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own mastery" ON public.user_concept_mastery FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- RLS policies for parent_links
CREATE POLICY "Students can manage own links" ON public.parent_links FOR SELECT TO authenticated USING (auth.uid() = student_id);
CREATE POLICY "Students can create links" ON public.parent_links FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Students can delete links" ON public.parent_links FOR DELETE TO authenticated USING (auth.uid() = student_id);

-- Public read for parent dashboard (no auth needed, access code gated in app)
CREATE POLICY "Public read by access code" ON public.parent_links FOR SELECT TO anon USING (true);

-- RLS policies for weekly_stats
CREATE POLICY "Users can select own stats" ON public.weekly_stats FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own stats" ON public.weekly_stats FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own stats" ON public.weekly_stats FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_test_attempts_user ON public.test_attempts(user_id, completed_at DESC);
CREATE INDEX idx_question_responses_user ON public.question_responses(user_id, created_at DESC);
CREATE INDEX idx_mistake_tags_user ON public.mistake_tags(user_id, created_at DESC);
CREATE INDEX idx_flashcard_srs_due ON public.flashcard_srs(user_id, due_date);
CREATE INDEX idx_squad_activity_squad ON public.squad_activity(squad_id, created_at DESC);
CREATE INDEX idx_concept_nodes_curriculum ON public.concept_nodes(curriculum, subject);
CREATE INDEX idx_weekly_stats_user ON public.weekly_stats(user_id, week_start DESC);

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.flashcard_srs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.squad_activity;
ALTER PUBLICATION supabase_realtime ADD TABLE public.readiness_history;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_memory;
