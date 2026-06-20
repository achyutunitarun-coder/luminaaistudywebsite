-- Remove client-side write access to leaderboard_entries; only the sync_leaderboard SECURITY DEFINER RPC writes.
DROP POLICY IF EXISTS "Users can insert own entries" ON public.leaderboard_entries;
DROP POLICY IF EXISTS "Users can update own entries" ON public.leaderboard_entries;

COMMENT ON TABLE public.leaderboard_entries IS 'Writes only via public.sync_leaderboard(uuid) SECURITY DEFINER RPC. No direct client INSERT/UPDATE allowed.';
COMMENT ON TABLE public.achievements IS 'Inserts performed by service role / edge functions only. Clients may read and delete their own rows.';
COMMENT ON TABLE public.usage_tracking IS 'Writes only via public.increment_usage(...) SECURITY DEFINER RPC. Clients may only read their own rows.';
COMMENT ON TABLE public.user_connections IS 'OAuth tokens. Writes performed exclusively by service role in edge functions. Clients may read/delete their own rows.';