-- Improve orchestrator routing by adding a paid fallback to prevent all_candidates_failed
UPDATE public.lc_model_routing
SET fallback_model_ids = ARRAY['nvidia/nemotron-3-super-120b-a12b:free', 'anthropic/claude-3-haiku', 'google/gemini-flash-1.5']
WHERE role = 'orchestrator';

-- Also ensure content role has a wide enough fallback chain
UPDATE public.lc_model_routing
SET fallback_model_ids = ARRAY['z-ai/glm-4.5-air', 'nvidia/nemotron-3-super-120b-a12b:free', 'anthropic/claude-3-haiku']
WHERE role = 'content';
