create table if not exists public.user_credit_balances (
  user_id uuid primary key,
  balance numeric(12,2) not null default 5,
  plan text not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  payment_id text,
  product_id text not null,
  product_name text not null,
  credits numeric(12,2) not null,
  source text not null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (payment_id)
);

alter table public.user_credit_balances enable row level security;
alter table public.credit_transactions enable row level security;

drop policy if exists "Users can view own credit balance" on public.user_credit_balances;
create policy "Users can view own credit balance"
on public.user_credit_balances
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can view own credit transactions" on public.credit_transactions;
create policy "Users can view own credit transactions"
on public.credit_transactions
for select
to authenticated
using (auth.uid() = user_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_user_credit_balances_updated_at on public.user_credit_balances;
create trigger touch_user_credit_balances_updated_at
before update on public.user_credit_balances
for each row execute function public.touch_updated_at();

create or replace function public.get_dodo_credit_product(_product_id text)
returns table(product_name text, credits numeric, product_type text, plan_tier text)
language sql
stable
security definer
set search_path = public
as $$
  select p.product_name, p.credits, p.product_type, p.plan_tier
  from (values
    ('pdt_0NdcF1gd6Z5PBeFx8gbiE'::text, 'Starter'::text, 30::numeric, 'pack'::text, 'free'::text),
    ('pdt_0NdcF1o3DQYEdtVQBA8MG'::text, 'Standard'::text, 100::numeric, 'pack'::text, 'free'::text),
    ('pdt_0NdcF1rKPidZVQ4vdzt5u'::text, 'Power'::text, 300::numeric, 'pack'::text, 'free'::text),
    ('pdt_0NdcF1ua83g4FRUO1LhKt'::text, 'Mega'::text, 800::numeric, 'pack'::text, 'free'::text),
    ('pdt_0NbKNHJ5nK556qajM5MKa'::text, 'Ultimate'::text, 40::numeric, 'subscription'::text, 'ultimate'::text),
    ('pdt_0Nbybrhl2M0GdzScdoAwb'::text, 'PRO+'::text, 150::numeric, 'subscription'::text, 'pro_plus'::text)
  ) as p(product_id, product_name, credits, product_type, plan_tier)
  where p.product_id = _product_id;
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
  set balance = balance + v_product.credits,
      plan = coalesce(v_plan, plan)
  where user_id = _user_id
  returning user_credit_balances.balance, user_credit_balances.plan into v_balance, v_plan;

  insert into public.credit_transactions (user_id, payment_id, product_id, product_name, credits, source, action, metadata)
  values (_user_id, v_payment_id, _product_id, v_product.product_name, v_product.credits, coalesce(_source, 'webhook'), 'Added ' || v_product.credits::text || ' credits', jsonb_build_object('product_type', v_product.product_type));

  return query select true, v_balance, v_product.credits, v_product.product_name, v_plan, false;
end;
$$;

create or replace function public.apply_dodo_credits(
  _product_id text,
  _payment_id text default null,
  _source text default 'return_url'
)
returns table(applied boolean, balance numeric, credits_added numeric, product_name text, plan text, duplicate boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  return query select * from public.apply_dodo_credits_for_user(auth.uid(), _product_id, _payment_id, _source);
end;
$$;

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
  set balance = balance - _amount
  where user_id = v_user_id
  returning user_credit_balances.balance into v_balance;

  insert into public.credit_transactions (user_id, payment_id, product_id, product_name, credits, source, action)
  values (v_user_id, null, 'spend', coalesce(_action, 'spend'), -_amount, 'spend', coalesce(_action, 'spend'));

  return query select true, v_balance;
end;
$$;

revoke execute on function public.apply_dodo_credits_for_user(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.apply_dodo_credits_for_user(uuid,text,text,text) to service_role;
grant execute on function public.apply_dodo_credits(text,text,text) to authenticated;
grant execute on function public.spend_user_credits(numeric,text) to authenticated;