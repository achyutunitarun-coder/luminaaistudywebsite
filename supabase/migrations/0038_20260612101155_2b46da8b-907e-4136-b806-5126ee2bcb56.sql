
CREATE OR REPLACE FUNCTION public.get_dodo_credit_product(_product_id text)
 RETURNS TABLE(product_name text, credits numeric, product_type text, plan_tier text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.product_name, p.credits, p.product_type, p.plan_tier
  from (values
    ('pdt_0NdcF1gd6Z5PBeFx8gbiE'::text, 'Starter'::text, 30::numeric, 'pack'::text, 'free'::text),
    ('pdt_0NdcF1o3DQYEdtVQBA8MG'::text, 'Standard'::text, 100::numeric, 'pack'::text, 'free'::text),
    ('pdt_0NdcF1rKPidZVQ4vdzt5u'::text, 'Power'::text, 300::numeric, 'pack'::text, 'free'::text),
    ('pdt_0NdcF1ua83g4FRUO1LhKt'::text, 'Mega'::text, 800::numeric, 'pack'::text, 'free'::text),
    ('pdt_0NbKNHJ5nK556qajM5MKa'::text, 'Ultimate'::text, 40::numeric, 'subscription'::text, 'ultimate'::text),
    ('pdt_0Nbybrhl2M0GdzScdoAwb'::text, 'PRO+'::text, 150::numeric, 'subscription'::text, 'pro_plus'::text),
    ('pdt_0NgrUZL3QLR2Xmw2PQgRR'::text, 'MEGA'::text, 300::numeric, 'subscription'::text, 'pro_plus'::text),
    ('pdt_0NgrZWBT2Irz439pIp6Xn'::text, 'POWER+'::text, 500::numeric, 'subscription'::text, 'pro_plus'::text)
  ) as p(product_id, product_name, credits, product_type, plan_tier)
  where p.product_id = _product_id;
$function$;
