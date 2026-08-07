-- Add openrouter/free as the ultimate fallback for every role.
-- openrouter/free auto-routes to the best available free provider, giving us a
-- resilient catch-all when all specific free models are rate-limited or down.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT role FROM public.lc_model_routing LOOP
    UPDATE public.lc_model_routing
    SET fallback_model_ids = array_remove(fallback_model_ids, 'openrouter/free') || ARRAY['openrouter/free'],
        notes = coalesce(notes, '') || ' ultimate:openrouter/free'
    WHERE role = r.role;
  END LOOP;
END $$;