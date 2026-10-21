-- Admin role system: roles live in their own table, checked via a security definer function
-- so RLS policies can gate access without recursion.
create type public.app_role as enum ('admin', 'moderator', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

-- Users may read their own roles only; roles are managed by the backend (service role).
create policy "Users can view own roles"
on public.user_roles for select
to authenticated
using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- Lock the two internal Lumina Computer tables to admins (fail-closed until an admin exists).
drop policy if exists "lc_model_routing read" on public.lc_model_routing;
create policy "Admins can read model routing"
on public.lc_model_routing for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "lc_model_cooldowns read" on public.lc_model_cooldowns;
create policy "Admins can read model cooldowns"
on public.lc_model_cooldowns for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));