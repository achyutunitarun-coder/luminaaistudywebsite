
UPDATE lc_model_routing SET primary_model_id = 'nvidia/nemotron-3-ultra-550b-a55b:free', fallback_model_ids = ARRAY['nvidia/nemotron-3-super-120b-a12b:free','google/gemma-4-31b-it:free'] WHERE role = 'content';
UPDATE lc_model_routing SET fallback_model_ids = ARRAY['nvidia/nemotron-3-super-120b-a12b:free','google/gemma-4-31b-it:free'] WHERE role = 'content';
