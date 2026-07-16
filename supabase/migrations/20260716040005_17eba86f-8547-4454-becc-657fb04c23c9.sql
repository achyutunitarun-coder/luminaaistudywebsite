UPDATE public.lc_model_routing
SET primary_model_id = regexp_replace(primary_model_id, ':free$', ''),
    fallback_model_ids = COALESCE((
      SELECT array_agg(regexp_replace(model_id, ':free$', '') ORDER BY ord)
      FROM unnest(fallback_model_ids) WITH ORDINALITY AS models(model_id, ord)
    ), ARRAY[]::text[])
WHERE primary_model_id LIKE '%:free'
   OR EXISTS (
     SELECT 1
     FROM unnest(fallback_model_ids) AS model_id
     WHERE model_id LIKE '%:free'
   );

DELETE FROM public.lc_model_cooldowns
WHERE model_id LIKE '%:free';