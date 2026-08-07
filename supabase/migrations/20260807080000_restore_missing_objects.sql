-- Restore objects deleted during migration reconciliation (fd3d760).
-- These objects existed in remote history but were never re-applied after
-- reconciliation removed intermediate migrations. Also folds in pending
-- migrations 20260802062053 (join_squad_by_invite_code + squad_members policy)
-- and 20260806132221 (backend-only REVOKE/GRANT hardening), which are
-- repaired-reverted and removed once this migration is pushed.
--
-- Restores:
--   * Squad tables (squads, squad_members, squad_activity, squad_messages)
--   * parent_links + get_parent_link_by_code
--   * user_memory (consumed by extract-memory edge function)
--   * sync_dodo_entitlement_for_user (called by dodo-webhook, billing-webhook,
--     restore-dodo-credits) -- was missing in production, breaking payments
--   * Email queue infra (pgmq queues + send log/state + RPC wrappers) consumed
--     by process-email-queue edge function

-- ============================================================
-- 1. Study squads
-- ============================================================
CREATE TABLE public.squads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  invite_code text UNIQUE DEFAULT substr(md5(random()::text), 0, 8),
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.squad_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id uuid REFERENCES public.squads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  display_name text,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(squad_id, user_id)
);

CREATE TABLE public.squad_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id uuid REFERENCES public.squads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  activity_type text,
  xp_earned int DEFAULT 0,
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.squad_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id uuid REFERENCES public.squads(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  display_name text,
  role text NOT NULL DEFAULT 'user',
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.squads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_messages ENABLE ROW LEVEL SECURITY;

-- squads RLS
CREATE POLICY "Members can view squads" ON public.squads FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.squad_members WHERE squad_members.squad_id = squads.id AND squad_members.user_id = auth.uid())
  OR created_by = auth.uid()
);
CREATE POLICY "Users can create squads" ON public.squads FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creators can update squads" ON public.squads FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Creators can delete squads" ON public.squads FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- squad_members RLS (select + delete; insert is gated by join_squad_by_invite_code
-- for everyone except the squad creator, per pending migration 20260802062053)
CREATE POLICY "Members can view squad members" ON public.squad_members FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.squad_members sm WHERE sm.squad_id = squad_members.squad_id AND sm.user_id = auth.uid())
);
CREATE POLICY "Squad creators can add themselves" ON public.squad_members FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.squads s
    WHERE s.id = squad_members.squad_id
      AND s.created_by = auth.uid()
  )
);
CREATE POLICY "Users can leave squads" ON public.squad_members FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- squad_activity RLS (membership-gated, replacing the permissive own-row insert)
CREATE POLICY "Members can view activity" ON public.squad_activity FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.squad_members WHERE squad_members.squad_id = squad_activity.squad_id AND squad_members.user_id = auth.uid())
);
CREATE POLICY "Members can insert squad activity" ON public.squad_activity FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.squad_members sm
    WHERE sm.squad_id = squad_activity.squad_id
      AND sm.user_id = auth.uid()
  )
);

-- squad_messages RLS
CREATE POLICY "Members can view squad messages" ON public.squad_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.squad_members sm WHERE sm.squad_id = squad_messages.squad_id AND sm.user_id = auth.uid()));
CREATE POLICY "Members can insert squad messages" ON public.squad_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.squad_members sm WHERE sm.squad_id = squad_messages.squad_id AND sm.user_id = auth.uid()));

CREATE INDEX idx_squad_activity_squad ON public.squad_activity(squad_id, created_at DESC);

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.squad_messages;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.squad_activity;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================
-- 2. Squad lookup / join functions
-- ============================================================
CREATE OR REPLACE FUNCTION public.lookup_squad_by_invite_code(_code text)
RETURNS TABLE(id uuid, name text, invite_code text, created_by uuid, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.name, s.invite_code, s.created_by, s.created_at
  FROM public.squads s
  WHERE s.invite_code = upper(trim(_code))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.lookup_squad_by_invite_code(text) FROM public;
GRANT EXECUTE ON FUNCTION public.lookup_squad_by_invite_code(text) TO authenticated;

-- From pending migration 20260802062053
CREATE OR REPLACE FUNCTION public.join_squad_by_invite_code(_code text, _display_name text DEFAULT NULL)
RETURNS TABLE(squad_id uuid, squad_name text, already_member boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_squad public.squads%ROWTYPE;
  v_count integer;
  v_exists boolean;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_squad FROM public.squads s
  WHERE s.invite_code = upper(trim(coalesce(_code, ''))) LIMIT 1;

  IF v_squad.id IS NULL THEN
    RAISE EXCEPTION 'invalid_invite_code';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.squad_members m
    WHERE m.squad_id = v_squad.id AND m.user_id = v_user
  ) INTO v_exists;

  IF v_exists THEN
    RETURN QUERY SELECT v_squad.id, v_squad.name, true;
    RETURN;
  END IF;

  SELECT count(*) INTO v_count FROM public.squad_members m WHERE m.squad_id = v_squad.id;
  IF v_count >= 12 THEN
    RAISE EXCEPTION 'squad_full';
  END IF;

  INSERT INTO public.squad_members (squad_id, user_id, display_name)
  VALUES (v_squad.id, v_user, coalesce(nullif(trim(_display_name), ''), 'Student'));

  INSERT INTO public.squad_activity (squad_id, user_id, activity_type, description)
  VALUES (v_squad.id, v_user, 'join',
    coalesce(nullif(trim(_display_name), ''), 'A student') || ' joined the squad');

  RETURN QUERY SELECT v_squad.id, v_squad.name, false;
END;
$$;

REVOKE ALL ON FUNCTION public.join_squad_by_invite_code(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.join_squad_by_invite_code(text, text) TO authenticated;

-- ============================================================
-- 3. Parent links + lookup-by-code
-- ============================================================
CREATE TABLE public.parent_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  parent_email text,
  access_code text UNIQUE DEFAULT substr(md5(random()::text), 0, 10),
  linked_at timestamptz
);

ALTER TABLE public.parent_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can manage own links" ON public.parent_links FOR SELECT TO authenticated USING (auth.uid() = student_id);
CREATE POLICY "Students can create links" ON public.parent_links FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Students can delete links" ON public.parent_links FOR DELETE TO authenticated USING (auth.uid() = student_id);

CREATE OR REPLACE FUNCTION public.get_parent_link_by_code(_code text)
RETURNS TABLE(id uuid, student_id uuid, parent_email text, access_code text, linked_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, student_id, parent_email, access_code, linked_at
  FROM public.parent_links
  WHERE access_code = _code
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_parent_link_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_parent_link_by_code(text) TO authenticated;

-- Prevent students from reading their own access_code column directly; lookups must use get_parent_link_by_code().
REVOKE SELECT (access_code) ON public.parent_links FROM authenticated, anon;

-- ============================================================
-- 4. User memory (consumed by extract-memory edge function)
-- ============================================================
CREATE TABLE public.user_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  memory_type text NOT NULL,
  key text NOT NULL,
  value text NOT NULL,
  confidence float DEFAULT 1.0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

CREATE UNIQUE INDEX idx_user_memory_user_key ON public.user_memory(user_id, key);

ALTER TABLE public.user_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own memory" ON public.user_memory FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own memory" ON public.user_memory FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own memory" ON public.user_memory FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own memory" ON public.user_memory FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- 5. sync_dodo_entitlement_for_user (critical billing path)
--    Note: apply_dodo_credits_for_user already exists on remote with the
--    ambiguity fix (20260807070000); we do NOT overwrite it here.
-- ============================================================
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
    SET balance = public.user_credit_balances.balance + v_product.credits,
        plan = CASE WHEN v_product.product_type = 'subscription' THEN v_product.plan_tier ELSE public.user_credit_balances.plan END
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

REVOKE EXECUTE ON FUNCTION public.sync_dodo_entitlement_for_user(uuid,text,text,text,text,timestamptz,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_dodo_entitlement_for_user(uuid,text,text,text,text,timestamptz,text) TO service_role;

-- ============================================================
-- 6. Email queue infrastructure (process-email-queue edge function)
-- ============================================================
DO $$ BEGIN
  EXECUTE 'CREATE EXTENSION IF NOT EXISTS pgmq';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN PERFORM pgmq.create('auth_emails'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.create('transactional_emails'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.create('auth_emails_dlq'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.create('transactional_emails_dlq'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.email_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT,
  template_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'suppressed', 'failed', 'bounced', 'complained', 'dlq')),
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.email_send_log TO service_role;
ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read send log" ON public.email_send_log FOR SELECT USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Service role can insert send log" ON public.email_send_log FOR INSERT WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Service role can update send log" ON public.email_send_log FOR UPDATE USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_send_log_created ON public.email_send_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_send_log_recipient ON public.email_send_log(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_send_log_message ON public.email_send_log(message_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_send_log_message_sent_unique
  ON public.email_send_log(message_id) WHERE status = 'sent';

CREATE TABLE IF NOT EXISTS public.email_send_state (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  retry_after_until TIMESTAMPTZ,
  batch_size INTEGER NOT NULL DEFAULT 10,
  send_delay_ms INTEGER NOT NULL DEFAULT 200,
  auth_email_ttl_minutes INTEGER NOT NULL DEFAULT 15,
  transactional_email_ttl_minutes INTEGER NOT NULL DEFAULT 60,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.email_send_state (id) VALUES (1) ON CONFLICT DO NOTHING;
GRANT ALL ON public.email_send_state TO service_role;
ALTER TABLE public.email_send_state ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can manage send state" ON public.email_send_state FOR ALL
    USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.suppressed_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('unsubscribe', 'bounce', 'complaint')),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email)
);

GRANT ALL ON public.suppressed_emails TO service_role;
ALTER TABLE public.suppressed_emails ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read suppressed emails" ON public.suppressed_emails FOR SELECT USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Service role can insert suppressed emails" ON public.suppressed_emails FOR INSERT WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_suppressed_emails_email ON public.suppressed_emails(email);

CREATE TABLE IF NOT EXISTS public.email_unsubscribe_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ
);

GRANT ALL ON public.email_unsubscribe_tokens TO service_role;
ALTER TABLE public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read tokens" ON public.email_unsubscribe_tokens FOR SELECT USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Service role can insert tokens" ON public.email_unsubscribe_tokens FOR INSERT WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Service role can mark tokens as used" ON public.email_unsubscribe_tokens FOR UPDATE
    USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_unsubscribe_tokens_token ON public.email_unsubscribe_tokens(token);

-- RPC wrappers so Edge Functions can interact with pgmq via supabase.rpc()
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name TEXT, payload JSONB)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name TEXT, batch_size INT, vt INT)
RETURNS TABLE(msg_id BIGINT, read_ct INT, message JSONB)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name TEXT, message_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(
  source_queue TEXT, dlq_name TEXT, message_id BIGINT, payload JSONB
)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN
    PERFORM pgmq.create(dlq_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN
    PERFORM pgmq.delete(source_queue, message_id);
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  RETURN new_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enqueue_email(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_email(TEXT, JSONB) TO service_role;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT) TO service_role;
REVOKE EXECUTE ON FUNCTION public.delete_email(TEXT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_email(TEXT, BIGINT) TO service_role;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(TEXT, TEXT, BIGINT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(TEXT, TEXT, BIGINT, JSONB) TO service_role;

-- ============================================================
-- 7. Backend/service-role-only REVOKE/GRANT hardening
--    (from pending migration 20260806132221; email_queue_dispatch is guarded
--    because it has no definition anywhere and was never deployed)
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.sync_dodo_entitlement_for_user(uuid, text, text, text, text, timestamptz, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.apply_dodo_credits_for_user(uuid, text, text, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_active_billing_access(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.get_dodo_credit_product(text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated, public;

GRANT EXECUTE ON FUNCTION public.sync_dodo_entitlement_for_user(uuid, text, text, text, text, timestamptz, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_dodo_credits_for_user(uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_active_billing_access(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_dodo_credit_product(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;

-- Signed-in-only routines: drop anonymous access, keep authenticated + service_role
REVOKE EXECUTE ON FUNCTION public.apply_dodo_credits(text, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.spend_user_credits(numeric, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.join_squad_by_invite_code(text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.award_xp_coins(uuid, integer, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.increment_usage(uuid, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_usage_count(uuid, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.increment_study_minutes(uuid, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.sync_leaderboard(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.lookup_squad_by_invite_code(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_parent_link_by_code(text) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.apply_dodo_credits(text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.spend_user_credits(numeric, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.join_squad_by_invite_code(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.award_xp_coins(uuid, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_usage(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_usage_count(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_study_minutes(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_leaderboard(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lookup_squad_by_invite_code(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_parent_link_by_code(text) TO authenticated, service_role;
