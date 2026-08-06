-- Backend/service-role only routines: remove all client access
REVOKE EXECUTE ON FUNCTION public.sync_dodo_entitlement_for_user(uuid, text, text, text, text, timestamptz, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.apply_dodo_credits_for_user(uuid, text, text, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_active_billing_access(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.get_dodo_credit_product(text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM anon, authenticated, public;

GRANT EXECUTE ON FUNCTION public.sync_dodo_entitlement_for_user(uuid, text, text, text, text, timestamptz, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_dodo_credits_for_user(uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_active_billing_access(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_dodo_credit_product(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_queue_dispatch() TO service_role;

-- Signed-in-only routines: drop anonymous access, keep authenticated + service_role
REVOKE EXECUTE ON FUNCTION public.apply_dodo_credits(text, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.spend_user_credits(numeric, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.join_squad_by_invite_code(text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.award_xp_coins(uuid, integer, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.increment_usage(uuid, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_usage_count(uuid, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.increment_study_minutes(uuid, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.sync_leaderboard(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.lookup_squad_by_invite_code(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_parent_link_by_code(text) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.apply_dodo_credits(text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.spend_user_credits(numeric, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.join_squad_by_invite_code(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.award_xp_coins(uuid, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_usage(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_usage_count(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_study_minutes(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_leaderboard(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lookup_squad_by_invite_code(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_parent_link_by_code(text) TO authenticated, service_role;