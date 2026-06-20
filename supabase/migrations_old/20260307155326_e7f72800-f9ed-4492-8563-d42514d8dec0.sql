UPDATE study_sessions SET status = 'completed', ended_at = now(), duration_minutes = 0 WHERE status = 'active';
UPDATE study_sessions SET duration_minutes = 0;