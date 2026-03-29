
-- Fix all RLS policies: change from public role to authenticated role
-- This prevents anonymous/unauthenticated users from even attempting queries

-- CHATS table
DROP POLICY IF EXISTS "Users can delete own chats" ON public.chats;
DROP POLICY IF EXISTS "Users can insert own chats" ON public.chats;
DROP POLICY IF EXISTS "Users can update own chats" ON public.chats;
DROP POLICY IF EXISTS "Users can view own chats" ON public.chats;

CREATE POLICY "Users can delete own chats" ON public.chats FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own chats" ON public.chats FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own chats" ON public.chats FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own chats" ON public.chats FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- CHAT_MESSAGES table
DROP POLICY IF EXISTS "Users can insert own chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can view own chat messages" ON public.chat_messages;

CREATE POLICY "Users can insert own chat messages" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM chats WHERE chats.id = chat_messages.chat_id AND chats.user_id = auth.uid()));
CREATE POLICY "Users can view own chat messages" ON public.chat_messages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM chats WHERE chats.id = chat_messages.chat_id AND chats.user_id = auth.uid()));

-- ACHIEVEMENTS table
DROP POLICY IF EXISTS "Users can view own achievements" ON public.achievements;
CREATE POLICY "Users can view own achievements" ON public.achievements FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- DAILY_QUESTS table
DROP POLICY IF EXISTS "Users can insert own quests" ON public.daily_quests;
DROP POLICY IF EXISTS "Users can update own quests" ON public.daily_quests;
DROP POLICY IF EXISTS "Users can view own quests" ON public.daily_quests;

CREATE POLICY "Users can insert own quests" ON public.daily_quests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own quests" ON public.daily_quests FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own quests" ON public.daily_quests FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- FLASHCARD_DECKS table
DROP POLICY IF EXISTS "Users can delete own decks" ON public.flashcard_decks;
DROP POLICY IF EXISTS "Users can insert own decks" ON public.flashcard_decks;
DROP POLICY IF EXISTS "Users can update own decks" ON public.flashcard_decks;
DROP POLICY IF EXISTS "Users can view own decks" ON public.flashcard_decks;

CREATE POLICY "Users can delete own decks" ON public.flashcard_decks FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own decks" ON public.flashcard_decks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own decks" ON public.flashcard_decks FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own decks" ON public.flashcard_decks FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- FLASHCARDS table
DROP POLICY IF EXISTS "Users can view own flashcards" ON public.flashcards;
DROP POLICY IF EXISTS "Users can update own flashcards" ON public.flashcards;
DROP POLICY IF EXISTS "Users can insert own flashcards" ON public.flashcards;

CREATE POLICY "Users can view own flashcards" ON public.flashcards FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM flashcard_decks WHERE flashcard_decks.id = flashcards.deck_id AND flashcard_decks.user_id = auth.uid()));
CREATE POLICY "Users can update own flashcards" ON public.flashcards FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM flashcard_decks WHERE flashcard_decks.id = flashcards.deck_id AND flashcard_decks.user_id = auth.uid()));
CREATE POLICY "Users can insert own flashcards" ON public.flashcards FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM flashcard_decks WHERE flashcard_decks.id = flashcards.deck_id AND flashcard_decks.user_id = auth.uid()));

-- MISTAKES table
DROP POLICY IF EXISTS "Users can insert own mistakes" ON public.mistakes;
DROP POLICY IF EXISTS "Users can view own mistakes" ON public.mistakes;

CREATE POLICY "Users can insert own mistakes" ON public.mistakes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own mistakes" ON public.mistakes FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- PROFILES table
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- STUDY_PLANS table
DROP POLICY IF EXISTS "Users can delete own plans" ON public.study_plans;
DROP POLICY IF EXISTS "Users can insert own plans" ON public.study_plans;
DROP POLICY IF EXISTS "Users can update own plans" ON public.study_plans;
DROP POLICY IF EXISTS "Users can view own plans" ON public.study_plans;

CREATE POLICY "Users can delete own plans" ON public.study_plans FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own plans" ON public.study_plans FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own plans" ON public.study_plans FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own plans" ON public.study_plans FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- STUDY_SESSIONS table
DROP POLICY IF EXISTS "Users can insert own sessions" ON public.study_sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON public.study_sessions;
DROP POLICY IF EXISTS "Users can view own sessions" ON public.study_sessions;

CREATE POLICY "Users can insert own sessions" ON public.study_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON public.study_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own sessions" ON public.study_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- TESTS table
DROP POLICY IF EXISTS "Users can insert own tests" ON public.tests;
DROP POLICY IF EXISTS "Users can update own tests" ON public.tests;
DROP POLICY IF EXISTS "Users can view own tests" ON public.tests;

CREATE POLICY "Users can insert own tests" ON public.tests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tests" ON public.tests FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own tests" ON public.tests FOR SELECT TO authenticated USING (auth.uid() = user_id);
