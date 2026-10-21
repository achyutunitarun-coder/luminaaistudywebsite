-- concept_nodes is a global curriculum reference table with no per-user rows.
-- No client code reads it; edge functions access it with service role.
-- Remove the tautological authenticated-wide read policy (default-deny restores protection).
DROP POLICY IF EXISTS "Anyone can view concepts" ON public.concept_nodes;