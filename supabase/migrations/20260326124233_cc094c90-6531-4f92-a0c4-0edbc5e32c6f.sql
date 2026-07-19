
CREATE TABLE public.usage_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  feature text NOT NULL,
  usage_count integer NOT NULL DEFAULT 0,
  period_start date NOT NULL DEFAULT CURRENT_DATE,
  period_type text NOT NULL DEFAULT 'daily',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, feature, period_start, period_type)
);

ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage" ON public.usage_tracking FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own usage" ON public.usage_tracking FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own usage" ON public.usage_tracking FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  subscription_id text,
  status text NOT NULL DEFAULT 'inactive',
  plan text NOT NULL DEFAULT 'basic',
  current_period_end timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription" ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own subscription" ON public.subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.increment_usage(p_user_id uuid, p_feature text, p_period_type text DEFAULT 'daily')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_period_start date;
  v_count integer;
BEGIN
  IF p_period_type = 'weekly' THEN
    v_period_start := date_trunc('week', CURRENT_DATE)::date;
  ELSE
    v_period_start := CURRENT_DATE;
  END IF;

  INSERT INTO usage_tracking (user_id, feature, usage_count, period_start, period_type)
  VALUES (p_user_id, p_feature, 1, v_period_start, p_period_type)
  ON CONFLICT (user_id, feature, period_start, period_type)
  DO UPDATE SET usage_count = usage_tracking.usage_count + 1, updated_at = now()
  RETURNING usage_count INTO v_count;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_usage_count(p_user_id uuid, p_feature text, p_period_type text DEFAULT 'daily')
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_period_start date;
  v_count integer;
BEGIN
  IF p_period_type = 'weekly' THEN
    v_period_start := date_trunc('week', CURRENT_DATE)::date;
  ELSE
    v_period_start := CURRENT_DATE;
  END IF;

  SELECT usage_count INTO v_count
  FROM usage_tracking
  WHERE user_id = p_user_id AND feature = p_feature AND period_start = v_period_start AND period_type = p_period_type;

  RETURN COALESCE(v_count, 0);
END;
$$;
