-- Upgrade model routing: reliable free models as primary + paid upgrades as fallback
-- This ensures blocks always have a working model chain

-- Orchestrator: reasoning-heavy planning
UPDATE public.lc_model_routing
SET primary_model_id = 'nvidia/nemotron-3-ultra-550b-a55b:free',
    fallback_model_ids = ARRAY[
      'nvidia/nemotron-3-super-120b-a12b:free',
      'qwen/qwen3-next-80b-a3b-instruct:free',
      'google/gemma-4-31b-it:free',
      'nousresearch/hermes-3-llama-3.1-405b:free'
    ],
    notes = 'Planning: free primary + 4 diverse fallbacks'
WHERE role = 'orchestrator';

-- Content: doc/slide/sheet generation - needs quality writing
UPDATE public.lc_model_routing
SET primary_model_id = 'moonshotai/kimi-k2',
    fallback_model_ids = ARRAY[
      'nvidia/nemotron-3-ultra-550b-a55b:free',
      'nousresearch/hermes-3-llama-3.1-405b:free',
      'qwen/qwen3-next-80b-a3b-instruct:free',
      'google/gemma-4-31b-it:free'
    ],
    notes = 'Content: Kimi K2 primary + diverse free fallbacks'
WHERE role = 'content';

-- Code: website generation
UPDATE public.lc_model_routing
SET primary_model_id = 'qwen/qwen3-coder:free',
    fallback_model_ids = ARRAY[
      'nvidia/nemotron-3-ultra-550b-a55b:free',
      'nvidia/nemotron-3-super-120b-a12b:free',
      'qwen/qwen3-next-80b-a3b-instruct:free'
    ],
    notes = 'Code: Qwen Coder + fallbacks'
WHERE role = 'code';
