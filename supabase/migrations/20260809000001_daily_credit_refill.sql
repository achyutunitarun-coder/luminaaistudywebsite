-- Daily credit allowance refill for free users.
--
-- Free users are guaranteed at least this many credits usable each day. Because
-- purchased credit packs keep `plan = 'free'`, we NEVER erase a purchase: the
-- refill only tops a free account up to the daily allowance when it is below it,
-- and records which day the top-up was last applied so it happens once per day.

alter table public.user_credit_balances
  add column if not exists last_refill_date date;

-- RPC that (1) applies the daily refill for free users and (2) returns the
-- resulting balance + plan. Call this whenever the client needs to know the
-- user's spendable balance, so the daily allowance is granted up-front.
create or replace function public.get_daily_credit_balance()
returns table(balance numeric, daily_refilled boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_balance numeric;
  v_plan text;
  v_last_refill date;
  v_allowance numeric;
  v_refilled boolean := false;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  insert into public.user_credit_balances (user_id, balance, plan)
  values (v_user_id, 5, 'free')
  on conflict (user_id) do nothing;

  select b.balance, b.plan, b.last_refill_date
    into v_balance, v_plan, v_last_refill
  from public.user_credit_balances b
  where b.user_id = v_user_id;

  v_allowance := case when v_plan = 'free' then 5 else null end;

  if v_allowance is not null
     and (v_last_refill is null or v_last_refill < current_date)
     and v_balance < v_allowance then
    update public.user_credit_balances
       set balance = v_allowance,
           last_refill_date = current_date
     where user_id = v_user_id
     returning user_credit_balances.balance into v_balance;
    v_refilled := true;
  elsif v_allowance is not null
     and (v_last_refill is null or v_last_refill < current_date) then
    -- Marks the day as topped-up even if the balance is already >= allowance.
    update public.user_credit_balances
       set last_refill_date = current_date
     where user_id = v_user_id;
  end if;

  return query select coalesce(v_balance, 0), v_refilled;
end;
$$;

-- Ensure `spend_user_credits` tops up the daily allowance before checking the
-- balance, so a free user whose daily credits are reset can spend them.
create or replace function public.spend_user_credits(_amount numeric, _action text default 'spend')
returns table(success boolean, balance numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_balance numeric;
  v_plan text;
  v_last_refill date;
  v_allowance numeric;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;
  if _amount <= 0 or _amount > 1000 then
    raise exception 'invalid_amount';
  end if;

  insert into public.user_credit_balances (user_id, balance, plan)
  values (v_user_id, 5, 'free')
  on conflict (user_id) do nothing;

  select b.balance, b.plan, b.last_refill_date
    into v_balance, v_plan, v_last_refill
  from public.user_credit_balances b
  where b.user_id = v_user_id
  for update;

  -- Daily refill (free only), applied before the balance check.
  v_allowance := case when v_plan = 'free' then 5 else null end;
  if v_allowance is not null
     and (v_last_refill is null or v_last_refill < current_date)
     and v_balance < v_allowance then
    v_balance := v_allowance;
    update public.user_credit_balances
       set balance = v_allowance,
           last_refill_date = current_date
     where user_id = v_user_id;
  elsif v_allowance is not null
     and (v_last_refill is null or v_last_refill < current_date) then
    update public.user_credit_balances
       set last_refill_date = current_date
     where user_id = v_user_id;
  end if;

  if v_balance < _amount then
    return query select false, coalesce(v_balance, 0);
    return;
  end if;

  update public.user_credit_balances
    set balance = balance - _amount
  where user_id = v_user_id
  returning user_credit_balances.balance into v_balance;

  insert into public.credit_transactions (user_id, payment_id, product_id, product_name, credits, source, action)
  values (v_user_id, null, 'spend', coalesce(_action, 'spend'), -_amount, 'spend', coalesce(_action, 'spend'));

  return query select true, v_balance;
end;
$$;

revoke execute on function public.get_daily_credit_balance() from public, anon;
grant execute on function public.get_daily_credit_balance() to authenticated;