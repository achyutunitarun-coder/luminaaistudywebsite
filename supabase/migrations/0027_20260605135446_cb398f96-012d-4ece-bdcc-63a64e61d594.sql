GRANT SELECT, INSERT, UPDATE, DELETE ON public.artifact_jobs TO authenticated;
GRANT ALL ON public.artifact_jobs TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_artifacts TO authenticated;
GRANT ALL ON public.chat_artifacts TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_plans TO authenticated;
GRANT ALL ON public.study_plans TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.flashcard_decks TO authenticated;
GRANT ALL ON public.flashcard_decks TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.flashcards TO authenticated;
GRANT ALL ON public.flashcards TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.guided_lessons TO authenticated;
GRANT ALL ON public.guided_lessons TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_lectures TO authenticated;
GRANT ALL ON public.saved_lectures TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tests TO authenticated;
GRANT ALL ON public.tests TO service_role;