-- Upgrade model routing: reliable free models as primary + paid upgrades as fallback
-- This ensures blocks always have a working model chain

-- Orchestrator: reasoning-heavy planning
UPDATE public.lc_model_routing
SET primary_model_id = 'nvidia/nemotron-3-ultra-550b-a55b:free',
    fallback_model_ids = ARRAY[
      'nvidia/nemotron-3-super-120b-a12b:free',
      'openai/gpt-oss-20b:free',
      'google/gemma-4-31b-it:free'
    ],
    notes = 'Planning: free primary + diverse fallbacks'
WHERE role = 'orchestrator';

-- Content: doc/slide/sheet generation - needs quality writing
UPDATE public.lc_model_routing
SET primary_model_id = 'nvidia/nemotron-3-ultra-550b-a55b:free',
    fallback_model_ids = ARRAY[
      'nvidia/nemotron-3-super-120b-a12b:free',
      'google/gemma-4-31b-it:free'
    ],
    notes = 'Content: free primary + free fallbacks'
WHERE role = 'content';

-- Code: website generation
UPDATE public.lc_model_routing
SET primary_model_id = 'cohere/north-mini-code:free',
    fallback_model_ids = ARRAY[
      'nvidia/nemotron-3-ultra-550b-a55b:free',
      'nvidia/nemotron-3-super-120b-a12b:free',
      'openai/gpt-oss-20b:free'
    ],
    notes = 'Code: North Mini Code + fallbacks'
WHERE role = 'code';
