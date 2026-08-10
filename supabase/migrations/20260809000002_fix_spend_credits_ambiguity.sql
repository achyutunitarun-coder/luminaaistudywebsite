-- Fix: fully qualify `balance` column references in spend_user_credits so they
-- don't collide with the function's OUT (`returns table(..., balance numeric)`)
-- column named `balance`, which caused SQLSTATE 42702 "column reference balance
-- is ambiguous".

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

  v_allowance := case when v_plan = 'free' then 5 else null end;
  if v_allowance is not null
     and (v_last_refill is null or v_last_refill < current_date)
     and v_balance < v_allowance then
    v_balance := v_allowance;
    update public.user_credit_balances
       set balance = public.user_credit_balances.balance + (v_allowance - v_balance),
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
    set balance = public.user_credit_balances.balance - _amount
  where user_id = v_user_id
  returning public.user_credit_balances.balance into v_balance;

  insert into public.credit_transactions (user_id, payment_id, product_id, product_name, credits, source, action)
  values (v_user_id, null, 'spend', coalesce(_action, 'spend'), -_amount, 'spend', coalesce(_action, 'spend'));

  return query select true, v_balance;
end;
$$;

revoke execute on function public.spend_user_credits(numeric,text) from public, anon;
grant execute on function public.spend_user_credits(numeric,text) to authenticated;