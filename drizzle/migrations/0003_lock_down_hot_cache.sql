-- Lock down hot_cache: the AI answer cache is served exclusively by server-side
-- edge functions (service role, which bypasses RLS). No client reads it.
DROP POLICY IF EXISTS "Anyone authenticated reads hot cache" ON public.hot_cache;

REVOKE ALL ON public.hot_cache FROM anon, authenticated;

-- Explicit grants for the service role used by edge functions.
GRANT SELECT, INSERT, UPDATE ON public.hot_cache TO service_role;

COMMENT ON TABLE public.hot_cache IS 'Server-side AI answer cache. Accessed only by edge functions via service role; no client RLS access.';