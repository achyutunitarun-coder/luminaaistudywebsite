-- 1. Subscriptions: remove user INSERT, only service role should manage
DROP POLICY IF EXISTS "Users can insert own subscription" ON public.subscriptions;

-- 2. Achievements: remove public INSERT, only service role should award
DROP POLICY IF EXISTS "Users can insert own achievements" ON public.achievements;

-- 3. Usage tracking: remove user write access, only service role functions should manage
DROP POLICY IF EXISTS "Users can insert own usage" ON public.usage_tracking;
DROP POLICY IF EXISTS "Users can update own usage" ON public.usage_tracking;
DROP POLICY IF EXISTS "Users can delete own usage" ON public.usage_tracking;

-- 4. Chat messages: add DELETE policy
CREATE POLICY "Users can delete own chat messages"
  ON public.chat_messages FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM chats
    WHERE chats.id = chat_messages.chat_id
    AND chats.user_id = auth.uid()
  ));

-- 5. Mistakes: add UPDATE policy
CREATE POLICY "Users can update own mistakes"
  ON public.mistakes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- 6. Profiles: fix INSERT to authenticated only
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);