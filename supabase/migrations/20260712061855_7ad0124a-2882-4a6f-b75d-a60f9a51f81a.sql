-- Allow authenticated users to read routing config and cooldowns for the dashboard.
GRANT SELECT ON public.lc_model_routing TO authenticated;
GRANT SELECT ON public.lc_model_cooldowns TO authenticated;
GRANT ALL ON public.lc_model_routing TO service_role;
GRANT ALL ON public.lc_model_cooldowns TO service_role;

ALTER TABLE public.lc_model_routing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lc_model_cooldowns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lc_model_routing read" ON public.lc_model_routing;
CREATE POLICY "lc_model_routing read"
  ON public.lc_model_routing
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "lc_model_cooldowns read" ON public.lc_model_cooldowns;
CREATE POLICY "lc_model_cooldowns read"
  ON public.lc_model_cooldowns
  FOR SELECT
  TO authenticated
  USING (true);
