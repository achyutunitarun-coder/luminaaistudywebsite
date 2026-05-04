revoke execute on function public.get_dodo_credit_product(text) from public, anon;
revoke execute on function public.apply_dodo_credits(text,text,text) from public, anon;
revoke execute on function public.apply_dodo_credits_for_user(uuid,text,text,text) from public, anon, authenticated;
revoke execute on function public.spend_user_credits(numeric,text) from public, anon;

grant execute on function public.get_dodo_credit_product(text) to authenticated, service_role;
grant execute on function public.apply_dodo_credits(text,text,text) to authenticated;
grant execute on function public.apply_dodo_credits_for_user(uuid,text,text,text) to service_role;
grant execute on function public.spend_user_credits(numeric,text) to authenticated;