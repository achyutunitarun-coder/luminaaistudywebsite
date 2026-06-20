CREATE OR REPLACE FUNCTION public.sync_dodo_entitlement_for_user(
  _user_id uuid,
  _product_id text,
  _payment_id text DEFAULT NULL,
  _subscription_id text DEFAULT NULL,
  _status text DEFAULT 'active',
  _current_period_end timestamptz DEFAULT NULL,
  _source text DEFAULT 'webhook'
)
RETURNS TABLE(applied boolean, balance numeric, credits_added numeric, product_name text, plan text, duplicate boolean, subscription_active boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product record;
  v_payment_id text;
  v_balance numeric;
  v_plan text;
  v_duplicate boolean := false;
  v_is_active boolean;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'missing_user';
  END IF;

  SELECT * INTO v_product FROM public.get_dodo_credit_product(_product_id) LIMIT 1;
  IF v_product.product_name IS NULL THEN
    RAISE EXCEPTION 'unknown_product';
  END IF;

  v_is_active := lower(coalesce(_status, 'active')) IN (
    'active', 'paid', 'succeeded', 'success', 'completed', 'approved', 'renewed', 'on_trial'
  );

  v_payment_id := nullif(trim(coalesce(_payment_id, '')), '');
  IF v_payment_id IS NULL THEN
    v_payment_id := coalesce(nullif(trim(_subscription_id), ''), coalesce(_source, 'dodo'))
      || ':' || _user_id::text || ':' || _product_id || ':' || to_char(now(), 'YYYYMMDDHH24MISSMS');
  END IF;

  INSERT INTO public.user_credit_balances (user_id, balance, plan)
  VALUES (_user_id, 5, 'free')
  ON CONFLICT (user_id) DO NOTHING;

  IF v_product.product_type = 'subscription' THEN
    v_plan := CASE WHEN v_is_active THEN v_product.plan_tier ELSE 'basic' END;

    INSERT INTO public.subscriptions (user_id, subscription_id, status, plan, current_period_end, updated_at)
    VALUES (
      _user_id,
      nullif(trim(coalesce(_subscription_id, v_payment_id)), ''),
      CASE WHEN v_is_active THEN 'active' ELSE 'inactive' END,
      v_plan,
      _current_period_end,
      now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      subscription_id = coalesce(excluded.subscription_id, public.subscriptions.subscription_id),
      status = excluded.status,
      plan = excluded.plan,
      current_period_end = coalesce(excluded.current_period_end, public.subscriptions.current_period_end),
      updated_at = now();

    IF v_is_active THEN
      UPDATE public.user_credit_balances
      SET plan = v_product.plan_tier
      WHERE user_id = _user_id;
    END IF;
  ELSE
    SELECT b.plan INTO v_plan FROM public.user_credit_balances b WHERE b.user_id = _user_id;
  END IF;

  IF NOT v_is_active THEN
    SELECT b.balance, b.plan INTO v_balance, v_plan
    FROM public.user_credit_balances b WHERE b.user_id = _user_id;
    RETURN QUERY SELECT false, coalesce(v_balance, 0), 0::numeric, v_product.product_name, coalesce(v_plan, 'free'), false, false;
    RETURN;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.credit_transactions WHERE payment_id = v_payment_id) INTO v_duplicate;

  IF NOT v_duplicate THEN
    UPDATE public.user_credit_balances
    SET balance = balance + v_product.credits,
        plan = CASE WHEN v_product.product_type = 'subscription' THEN v_product.plan_tier ELSE plan END
    WHERE user_id = _user_id
    RETURNING user_credit_balances.balance, user_credit_balances.plan INTO v_balance, v_plan;

    INSERT INTO public.credit_transactions (user_id, payment_id, product_id, product_name, credits, source, action, metadata)
    VALUES (
      _user_id,
      v_payment_id,
      _product_id,
      v_product.product_name,
      v_product.credits,
      coalesce(_source, 'webhook'),
      'Added ' || v_product.credits::text || ' credits',
      jsonb_build_object('product_type', v_product.product_type, 'subscription_id', _subscription_id)
    );
  ELSE
    SELECT b.balance, b.plan INTO v_balance, v_plan
    FROM public.user_credit_balances b WHERE b.user_id = _user_id;
  END IF;

  RETURN QUERY SELECT (NOT v_duplicate), coalesce(v_balance, 0), CASE WHEN v_duplicate THEN 0::numeric ELSE v_product.credits END, v_product.product_name, coalesce(v_plan, 'free'), v_duplicate, (v_product.product_type = 'subscription' AND v_is_active);
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_dodo_credits_for_user(
  _user_id uuid,
  _product_id text,
  _payment_id text DEFAULT NULL,
  _source text DEFAULT 'webhook'
)
RETURNS TABLE(applied boolean, balance numeric, credits_added numeric, product_name text, plan text, duplicate boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT s.applied, s.balance, s.credits_added, s.product_name, s.plan, s.duplicate
  FROM public.sync_dodo_entitlement_for_user(
    _user_id,
    _product_id,
    _payment_id,
    NULL,
    'active',
    NULL,
    _source
  ) AS s;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_dodo_entitlement_for_user(uuid,text,text,text,text,timestamptz,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_dodo_entitlement_for_user(uuid,text,text,text,text,timestamptz,text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.apply_dodo_credits_for_user(uuid,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_dodo_credits_for_user(uuid,text,text,text) TO service_role;