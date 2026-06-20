-- 1. Fix profiles: restrict SELECT to own profile only
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 2. Fix transcription_jobs: remove overly permissive policies
DROP POLICY IF EXISTS "Service can update jobs" ON public.transcription_jobs;
DROP POLICY IF EXISTS "Anon can insert jobs" ON public.transcription_jobs;

-- Recreate with proper restrictions
CREATE POLICY "Authenticated users can insert own jobs"
  ON public.transcription_jobs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update own jobs"
  ON public.transcription_jobs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Add missing DELETE policies
CREATE POLICY "Users can delete own tests"
  ON public.tests FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own flashcards"
  ON public.flashcards FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM flashcard_decks
    WHERE flashcard_decks.id = flashcards.deck_id
    AND flashcard_decks.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own mistakes"
  ON public.mistakes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own achievements"
  ON public.achievements FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own quests"
  ON public.daily_quests FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON public.study_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transcription_jobs"
  ON public.transcription_jobs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own usage"
  ON public.usage_tracking FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);