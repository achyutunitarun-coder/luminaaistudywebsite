-- Promote content role to the strong free model so slide/sheet blocks output
-- high-quality, structured JSON. The weak gemma-4-26b primary produced thin prose
-- markdown that SlideCanvas could not render; nemotron-3-super-120b + response_format
-- json_object yields clean slide/sheet JSON. gemma models remain as fast fallbacks.
UPDATE public.lc_model_routing
SET primary_model_id = 'nvidia/nemotron-3-super-120b-a12b:free',
    fallback_model_ids = ARRAY[
      'google/gemma-4-31b-it:free',
      'google/gemma-4-26b-a4b-it:free'
    ],
    notes = 'Content: strong free primary + fast fallbacks'
WHERE role = 'content';