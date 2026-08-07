create or replace function public.spend_user_credits(_amount numeric, _action text default 'spend')
returns table(success boolean, balance numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_balance numeric;
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

  select b.balance into v_balance
  from public.user_credit_balances b
  where b.user_id = v_user_id
  for update;

  if coalesce(v_balance, 0) < _amount then
    return query select false, coalesce(v_balance, 0);
    return;
  end if;

  update public.user_credit_balances
  set balance = public.user_credit_balances.balance - _amount
  where user_id = v_user_id
  returning user_credit_balances.balance into v_balance;

  insert into public.credit_transactions (user_id, payment_id, product_id, product_name, credits, source, action)
  values (v_user_id, null, 'spend', coalesce(_action, 'spend'), -_amount, 'spend', coalesce(_action, 'spend'));

  return query select true, v_balance;
end;
$$;

create or replace function public.apply_dodo_credits_for_user(
  _user_id uuid,
  _product_id text,
  _payment_id text default null,
  _source text default 'webhook'
)
returns table(applied boolean, balance numeric, credits_added numeric, product_name text, plan text, duplicate boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product record;
  v_payment_id text;
  v_balance numeric;
  v_plan text;
begin
  if _user_id is null then
    raise exception 'missing_user';
  end if;

  select * into v_product from public.get_dodo_credit_product(_product_id) limit 1;
  if v_product.product_name is null then
    raise exception 'unknown_product';
  end if;

  v_payment_id := nullif(trim(coalesce(_payment_id, '')), '');
  if v_payment_id is null then
    v_payment_id := coalesce(_source, 'credit') || ':' || _user_id::text || ':' || _product_id || ':' || to_char(now(), 'YYYYMMDDHH24MISSMS');
  end if;

  insert into public.user_credit_balances (user_id, balance, plan)
  values (_user_id, 5, 'free')
  on conflict (user_id) do nothing;

  if exists (select 1 from public.credit_transactions where payment_id = v_payment_id) then
    select b.balance, b.plan into v_balance, v_plan
    from public.user_credit_balances b where b.user_id = _user_id;
    return query select false, coalesce(v_balance, 0), 0::numeric, v_product.product_name, coalesce(v_plan, 'free'), true;
    return;
  end if;

  v_plan := case when v_product.product_type = 'subscription' then v_product.plan_tier else null end;

  update public.user_credit_balances
  set balance = public.user_credit_balances.balance + v_product.credits,
      plan = coalesce(v_plan, public.user_credit_balances.plan)
  where user_id = _user_id
  returning user_credit_balances.balance, user_credit_balances.plan into v_balance, v_plan;

  insert into public.credit_transactions (user_id, payment_id, product_id, product_name, credits, source, action, metadata)
  values (_user_id, v_payment_id, _product_id, v_product.product_name, v_product.credits, coalesce(_source, 'webhook'), 'Added ' || v_product.credits::text || ' credits', jsonb_build_object('product_type', v_product.product_type));

  return query select true, v_balance, v_product.credits, v_product.product_name, v_plan, false;
end;
$$;

revoke execute on function public.apply_dodo_credits_for_user(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.apply_dodo_credits_for_user(uuid,text,text,text) to service_role;
grant execute on function public.apply_dodo_credits(text,text,text) to authenticated;
grant execute on function public.spend_user_credits(numeric,text) to authenticated;
