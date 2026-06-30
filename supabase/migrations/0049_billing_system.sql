-- Billing system: subscription-like manual renewal via Dodo one-time payments.
-- No Dodo subscriptions or mandates are ever created.
-- Every renewal is customer-initiated via a one-time payment link.
-- The webhook is the source of truth for entitlement updates.

-- ─────────────────────────────────────────────
-- 1. BILLING PLANS
-- ─────────────────────────────────────────────
CREATE TABLE public.billing_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  dodo_product_id text NOT NULL UNIQUE,
  amount_minor integer NOT NULL,          -- Amount in lowest denomination (paise for INR)
  currency text NOT NULL DEFAULT 'INR',
  cycle_days integer NOT NULL DEFAULT 30,
  credits_per_cycle integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;

-- Everyone can view active plans
CREATE POLICY "Anyone can view active plans"
  ON public.billing_plans
  FOR SELECT
  TO authenticated
  USING (active = true);

-- Only service_role can insert/update/delete
CREATE POLICY "Service role manages plans"
  ON public.billing_plans
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────
-- 2. CUSTOMER MEMBERSHIPS
-- ─────────────────────────────────────────────
CREATE TYPE public.membership_status AS ENUM ('active', 'grace', 'paused', 'cancelled');

CREATE TABLE public.customer_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_email text NOT NULL,
  customer_name text NOT NULL DEFAULT '',
  plan_id uuid NOT NULL REFERENCES public.billing_plans(id),
  status membership_status NOT NULL DEFAULT 'active',
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz NOT NULL,
  next_invoice_at timestamptz NOT NULL,
  grace_ends_at timestamptz NOT NULL,
  last_payment_id text,
  last_invoice_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_memberships_user ON public.customer_memberships(user_id);
CREATE INDEX idx_memberships_status ON public.customer_memberships(status);
CREATE INDEX idx_memberships_next_invoice ON public.customer_memberships(next_invoice_at)
  WHERE status IN ('active', 'grace');
CREATE INDEX idx_memberships_grace ON public.customer_memberships(grace_ends_at)
  WHERE status IN ('active', 'grace');

ALTER TABLE public.customer_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own membership"
  ON public.customer_memberships
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages memberships"
  ON public.customer_memberships
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────
-- 3. RENEWAL INVOICES
-- ─────────────────────────────────────────────
CREATE TYPE public.invoice_status AS ENUM ('pending', 'paid', 'expired', 'failed');

CREATE TABLE public.renewal_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id uuid NOT NULL REFERENCES public.customer_memberships(id) ON DELETE CASCADE,
  due_at timestamptz NOT NULL,
  amount_minor integer NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  status invoice_status NOT NULL DEFAULT 'pending',
  dodo_payment_id text,
  dodo_payment_link text,
  paid_at timestamptz,
  reminder_count integer NOT NULL DEFAULT 0,
  last_reminder_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoices_membership ON public.renewal_invoices(membership_id);
CREATE INDEX idx_invoices_dodo_payment ON public.renewal_invoices(dodo_payment_id);
CREATE INDEX idx_invoices_status ON public.renewal_invoices(status);
CREATE INDEX idx_invoices_due ON public.renewal_invoices(due_at) WHERE status = 'pending';

ALTER TABLE public.renewal_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own invoices"
  ON public.renewal_invoices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.customer_memberships m
      WHERE m.id = membership_id AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role manages invoices"
  ON public.renewal_invoices
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────
-- 4. WEBHOOK EVENTS (idempotency log)
-- ─────────────────────────────────────────────
CREATE TYPE public.webhook_event_status AS ENUM ('processed', 'ignored', 'error');

CREATE TABLE public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status webhook_event_status NOT NULL DEFAULT 'processed',
  error_message text,
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_events_event_id ON public.webhook_events(event_id);
CREATE INDEX idx_webhook_events_type ON public.webhook_events(event_type);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Only service_role can read/write webhook events
CREATE POLICY "Service role manages webhook events"
  ON public.webhook_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────
-- 5. DATABASE FUNCTIONS
-- ─────────────────────────────────────────────

-- Has active access? TRUE when status=active OR (status=grace AND now <= grace_ends_at)
CREATE OR REPLACE FUNCTION public.has_active_billing_access(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.customer_memberships
    WHERE user_id = p_user_id
      AND (
        status = 'active'
        OR (status = 'grace' AND grace_ends_at >= now())
      )
  ) INTO v_result;

  RETURN v_result OR EXISTS (
    -- Fallback: check legacy subscriptions table for backward compat
    SELECT 1 FROM public.subscriptions
    WHERE user_id = p_user_id AND status = 'active'
  );
END;
$$;

-- Extend membership on successful payment
CREATE OR REPLACE FUNCTION public.extend_membership_on_payment(
  p_membership_id uuid,
  p_dodo_payment_id text,
  p_dodo_payment_link text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_membership public.customer_memberships;
  v_plan public.billing_plans;
  v_invoice public.renewal_invoices;
  v_new_start timestamptz;
  v_new_end timestamptz;
  v_new_grace timestamptz;
  v_grace_days constant integer := coalesce(current_setting('app.billing_grace_days', true)::integer, 3);
BEGIN
  -- Lock the membership row to prevent race conditions
  SELECT * INTO v_membership
  FROM public.customer_memberships
  WHERE id = p_membership_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Membership not found');
  END IF;

  SELECT * INTO v_plan FROM public.billing_plans WHERE id = v_membership.plan_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Plan not found');
  END IF;

  -- Find the matching pending invoice
  SELECT * INTO v_invoice
  FROM public.renewal_invoices
  WHERE membership_id = p_membership_id
    AND dodo_payment_id = p_dodo_payment_id
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice not found for payment ' || p_dodo_payment_id);
  END IF;

  -- Calculate new period dates
  v_new_start := GREATEST(now(), v_membership.current_period_end);
  v_new_end := v_new_start + (v_plan.cycle_days || ' days')::interval;
  v_new_grace := v_new_end + (v_grace_days || ' days')::interval;

  -- Mark invoice paid
  UPDATE public.renewal_invoices
  SET status = 'paid',
      paid_at = now(),
      updated_at = now()
  WHERE id = v_invoice.id;

  -- Extend membership
  UPDATE public.customer_memberships
  SET status = 'active',
      current_period_start = v_new_start,
      current_period_end = v_new_end,
      next_invoice_at = v_new_end,
      grace_ends_at = v_new_grace,
      last_payment_id = p_dodo_payment_id,
      last_invoice_id = v_invoice.id,
      updated_at = now()
  WHERE id = p_membership_id;

  -- If the plan grants credits, add them to the user's balance
  IF v_plan.credits_per_cycle > 0 THEN
    INSERT INTO public.credit_transactions (
      user_id, payment_id, product_id, product_name,
      credits, source, action, metadata
    ) VALUES (
      v_membership.user_id,
      p_dodo_payment_id,
      v_plan.dodo_product_id,
      v_plan.name || ' Renewal',
      v_plan.credits_per_cycle,
      'billing_renewal',
      'Monthly credit allocation - ' || v_plan.name,
      jsonb_build_object(
        'membership_id', p_membership_id,
        'invoice_id', v_invoice.id,
        'plan_name', v_plan.name,
        'period_start', v_new_start,
        'period_end', v_new_end
      )
    );

    -- Upsert user_credit_balances
    INSERT INTO public.user_credit_balances (user_id, balance, plan)
    VALUES (v_membership.user_id, v_plan.credits_per_cycle, v_plan.name)
    ON CONFLICT (user_id) DO UPDATE SET
      balance = public.user_credit_balances.balance + v_plan.credits_per_cycle,
      plan = CASE WHEN public.user_credit_balances.plan = 'free' OR public.user_credit_balances.plan = 'basic'
                  THEN v_plan.name ELSE public.user_credit_balances.plan END;
  END IF;

  -- Also upsert into legacy subscriptions table for backward compat
  INSERT INTO public.subscriptions (user_id, subscription_id, status, plan, current_period_end, updated_at)
  VALUES (
    v_membership.user_id,
    p_dodo_payment_id,
    'active',
    v_plan.name,
    v_new_end,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    subscription_id = coalesce(excluded.subscription_id, public.subscriptions.subscription_id),
    status = excluded.status,
    plan = excluded.plan,
    current_period_end = excluded.current_period_end,
    updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'membership_id', p_membership_id,
    'invoice_id', v_invoice.id,
    'current_period_start', v_new_start,
    'current_period_end', v_new_end,
    'grace_ends_at', v_new_grace,
    'credits_added', v_plan.credits_per_cycle
  );
END;
$$;

-- Pause membership when grace period expires
CREATE OR REPLACE FUNCTION public.pause_expired_membership(p_membership_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_membership public.customer_memberships;
BEGIN
  SELECT * INTO v_membership
  FROM public.customer_memberships
  WHERE id = p_membership_id AND status IN ('active', 'grace')
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active/grace membership found');
  END IF;

  UPDATE public.customer_memberships
  SET status = 'paused',
      updated_at = now()
  WHERE id = p_membership_id;

  -- Downgrade legacy subscription
  UPDATE public.subscriptions
  SET plan = 'basic',
      status = 'inactive',
      updated_at = now()
  WHERE user_id = v_membership.user_id;

  RETURN jsonb_build_object(
    'success', true,
    'membership_id', p_membership_id,
    'user_id', v_membership.user_id,
    'new_status', 'paused'
  );
END;
$$;

-- Grant permissions
REVOKE EXECUTE ON FUNCTION public.has_active_billing_access(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_billing_access(uuid) TO service_role, authenticated;

REVOKE EXECUTE ON FUNCTION public.extend_membership_on_payment(uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.extend_membership_on_payment(uuid,text,text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.pause_expired_membership(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pause_expired_membership(uuid) TO service_role;
