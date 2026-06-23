-- Hide parent_email from students by replacing the broad SELECT policy with column-level grants.
-- Students can read id, student_id, access_code, linked_at but NOT parent_email.
REVOKE ALL ON public.parent_links FROM anon, authenticated, PUBLIC;
GRANT INSERT, UPDATE, DELETE ON public.parent_links TO authenticated;
GRANT SELECT (id, student_id, access_code, linked_at) ON public.parent_links TO authenticated;
GRANT ALL ON public.parent_links TO service_role;