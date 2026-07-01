import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type Plan = 'basic' | 'ultimate' | 'pro_plus' | 'mega' | 'power_plus';

type SubscriptionContextType = {
  plan: Plan;
  loading: boolean;
  isPro: boolean;
  isProPlus: boolean;
  isUltimate: boolean;
  isMega: boolean;
  isPowerPlus: boolean;
  refetch: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [plan, setPlan] = useState<Plan>('basic');
  const [loading, setLoading] = useState(true);

  const fetchSubscription = useCallback(async () => {
    if (!user) { setPlan('basic'); setLoading(false); return; }
    try {
      // 1. Try the billing system (customer_memberships via edge function) first
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const res = await fetch(`${supabaseUrl}/functions/v1/billing-manage/my-membership`, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
          });
          if (res.ok) {
            const body = await res.json();
            const membership = body?.membership;
            if (membership?.status === 'active' || membership?.status === 'grace') {
              const planName = membership.billing_plans?.name?.toLowerCase().replace(/[^a-z_]/g, '') || '';
              const validPlans: Record<string, Plan> = {
                ultimate: 'ultimate',
                'pro+': 'pro_plus',
                pro_plus: 'pro_plus',
                mega: 'mega',
                'power+': 'power_plus',
                power_plus: 'power_plus',
              };
              const matched = validPlans[planName];
              if (matched) {
                setPlan(matched);
                setLoading(false);
                return;
              }
            }
          }
        }
      } catch { /* fall through to legacy checks */ }

      // 2. Check user_credit_balances for plan info
      const { data: creditBalance } = await supabase
        .from('user_credit_balances')
        .select('plan')
        .maybeSingle();

      const balancePlan = creditBalance?.plan;
      if (balancePlan === 'ultimate' || balancePlan === 'pro_plus' || balancePlan === 'mega' || balancePlan === 'power_plus') {
        setPlan(balancePlan as Plan);
        setLoading(false);
        return;
      }

      // 3. Legacy subscriptions table fallback
      const { data } = await supabase
        .from('subscriptions')
        .select('status, plan')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data?.status === 'active') {
        const p = String(data.plan ?? '').toLowerCase();
        if (p === 'pro_plus') setPlan('pro_plus');
        else if (p === 'mega') setPlan('mega');
        else if (p === 'power_plus') setPlan('power_plus');
        else setPlan('ultimate');
      } else {
        setPlan('basic');
      }
    } catch {
      setPlan('basic');
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchSubscription(); }, [fetchSubscription]);
  useEffect(() => {
    window.addEventListener('lumina:subscription-refresh', fetchSubscription);
    return () => window.removeEventListener('lumina:subscription-refresh', fetchSubscription);
  }, [fetchSubscription]);

  const planLower = plan.toLowerCase();
  const isPro = planLower === 'ultimate' || planLower === 'pro_plus' || planLower === 'mega' || planLower === 'power_plus';
  const isProPlus = planLower === 'pro_plus' || planLower === 'mega' || planLower === 'power_plus';
  const isUltimate = planLower === 'ultimate';
  const isMega = planLower === 'mega';
  const isPowerPlus = planLower === 'power_plus';

  return (
    <SubscriptionContext.Provider value={{ plan, loading, isPro, isProPlus, isUltimate, isMega, isPowerPlus, refetch: fetchSubscription }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider');
  return ctx;
};
