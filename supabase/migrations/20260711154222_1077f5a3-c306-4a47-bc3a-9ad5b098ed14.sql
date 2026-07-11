
-- billing_plans
CREATE TABLE IF NOT EXISTS public.billing_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  dodo_product_id text NOT NULL,
  amount_minor integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  cycle_days integer NOT NULL DEFAULT 30,
  credits_per_cycle integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.billing_plans TO authenticated;
GRANT ALL ON public.billing_plans TO service_role;
ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone signed in can view active plans"
  ON public.billing_plans FOR SELECT TO authenticated
  USING (active = true);

-- customer_memberships
CREATE TABLE IF NOT EXISTS public.customer_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  customer_email text NOT NULL,
  customer_name text,
  plan_id uuid NOT NULL REFERENCES public.billing_plans(id),
  status text NOT NULL DEFAULT 'active',
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  next_invoice_at timestamptz,
  grace_ends_at timestamptz,
  last_payment_id text,
  last_invoice_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_memberships_user_id ON public.customer_memberships(user_id);
GRANT SELECT ON public.customer_memberships TO authenticated;
GRANT ALL ON public.customer_memberships TO service_role;
ALTER TABLE public.customer_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own membership"
  ON public.customer_memberships FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- renewal_invoices
CREATE TABLE IF NOT EXISTS public.renewal_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id uuid NOT NULL REFERENCES public.customer_memberships(id) ON DELETE CASCADE,
  due_at timestamptz NOT NULL DEFAULT now(),
  amount_minor integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'pending',
  dodo_payment_id text,
  dodo_payment_link text,
  paid_at timestamptz,
  reminder_count integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_renewal_invoices_membership_id ON public.renewal_invoices(membership_id);
GRANT SELECT ON public.renewal_invoices TO authenticated;
GRANT ALL ON public.renewal_invoices TO service_role;
ALTER TABLE public.renewal_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own renewal invoices"
  ON public.renewal_invoices FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.customer_memberships m
    WHERE m.id = renewal_invoices.membership_id AND m.user_id = auth.uid()
  ));

-- updated_at triggers
CREATE TRIGGER trg_billing_plans_updated_at BEFORE UPDATE ON public.billing_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_customer_memberships_updated_at BEFORE UPDATE ON public.customer_memberships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_renewal_invoices_updated_at BEFORE UPDATE ON public.renewal_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- has_active_billing_access RPC
CREATE OR REPLACE FUNCTION public.has_active_billing_access(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.customer_memberships
    WHERE user_id = p_user_id
      AND status IN ('active', 'grace')
      AND current_period_end > now()
  );
$$;
GRANT EXECUTE ON FUNCTION public.has_active_billing_access(uuid) TO authenticated, service_role;
