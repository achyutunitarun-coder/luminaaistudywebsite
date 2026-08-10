-- Replace dead orchestrator/content primary models with fast, live models.
-- The former 550B Nemotron alias is retired (404). Routing planner work to a
-- fast first model so Lumina Computer planning returns well under 30s, with
-- the live 120B Nemotron as a quality fallback.

UPDATE public.lc_model_routing
SET primary_model_id = 'google/gemma-4-26b-a4b-it:free',
    fallback_model_ids = ARRAY[
      'nvidia/nemotron-3-super-120b-a12b:free',
      'openai/gpt-oss-20b:free',
      'google/gemma-4-31b-it:free',
      'openrouter/free'
    ],
    notes = 'Planning: fast live primary + diverse fallbacks'
WHERE role = 'orchestrator';

UPDATE public.lc_model_routing
SET primary_model_id = 'google/gemma-4-26b-a4b-it:free',
    fallback_model_ids = ARRAY[
      'nvidia/nemotron-3-super-120b-a12b:free',
      'google/gemma-4-31b-it:free'
    ],
    notes = 'Content: fast live primary + free fallbacks'
WHERE role = 'content';

UPDATE public.lc_model_routing
SET primary_model_id = 'cohere/north-mini-code:free',
    fallback_model_ids = ARRAY[
      'nvidia/nemotron-3-super-120b-a12b:free',
      'openai/gpt-oss-20b:free'
    ],
    notes = 'Code: North Mini Code + live fallbacks'
WHERE role = 'code';