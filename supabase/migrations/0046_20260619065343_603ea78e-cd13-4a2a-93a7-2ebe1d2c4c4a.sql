
-- Remove direct client read access to OAuth tokens; all reads go through edge functions with service role.
DROP POLICY IF EXISTS "users read own connections" ON public.user_connections;
REVOKE SELECT ON public.user_connections FROM authenticated, anon;

-- Prevent students from reading their own access_code column directly; lookups must use get_parent_link_by_code().
REVOKE SELECT (access_code) ON public.parent_links FROM authenticated, anon;
