CREATE TABLE public.saved_lectures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Untitled Lecture',
  transcript_text text,
  notes text,
  podcast_script text,
  source_type text DEFAULT 'audio',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_lectures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own lectures" ON public.saved_lectures FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own lectures" ON public.saved_lectures FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own lectures" ON public.saved_lectures FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own lectures" ON public.saved_lectures FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_saved_lectures_updated_at BEFORE UPDATE ON public.saved_lectures FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();