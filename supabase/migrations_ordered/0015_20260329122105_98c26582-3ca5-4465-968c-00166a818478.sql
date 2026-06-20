
-- 1. Ensure protect_gamification_columns trigger is attached to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'protect_gamification_on_update' AND tgrelid = 'public.profiles'::regclass
  ) THEN
    CREATE TRIGGER protect_gamification_on_update
      BEFORE UPDATE ON public.profiles
      FOR EACH ROW
      EXECUTE FUNCTION public.protect_gamification_columns();
  END IF;
END $$;

-- 2. Create trigger function to enforce daily_quests reward caps and prevent manipulation
CREATE OR REPLACE FUNCTION public.enforce_quest_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Cap reward values to prevent abuse
  NEW.xp_reward := LEAST(GREATEST(NEW.xp_reward, 0), 50);
  NEW.coin_reward := LEAST(GREATEST(NEW.coin_reward, 0), 25);
  NEW.target := GREATEST(NEW.target, 1);
  
  -- Prevent setting progress >= target or completed = true on INSERT
  IF TG_OP = 'INSERT' THEN
    NEW.progress := 0;
    NEW.completed := false;
  END IF;
  
  -- On UPDATE, prevent setting progress above target
  IF TG_OP = 'UPDATE' THEN
    NEW.progress := LEAST(NEW.progress, NEW.target);
    -- Only allow completed if progress actually reached target
    NEW.completed := (NEW.progress >= NEW.target);
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3. Attach the trigger
DROP TRIGGER IF EXISTS enforce_quest_limits_trigger ON public.daily_quests;
CREATE TRIGGER enforce_quest_limits_trigger
  BEFORE INSERT OR UPDATE ON public.daily_quests
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_quest_limits();
