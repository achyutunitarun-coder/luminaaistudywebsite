
UPDATE lc_model_routing
SET primary_model_id = 'moonshotai/kimi-k2.6',
    fallback_model_ids = ARRAY['z-ai/glm-4.5-air','nvidia/nemotron-3-super-120b-a12b:free']
WHERE role = 'content';
DELETE FROM lc_model_cooldowns;
