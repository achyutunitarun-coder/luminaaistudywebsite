import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type Plan = 'basic' | 'ultimate' | 'pro_plus';

type SubscriptionContextType = {
  plan: Plan;
  loading: boolean;
  isPro: boolean;        // ultimate or pro_plus (any paid)
  isProPlus: boolean;    // pro_plus only (₹499)
  isUltimate: boolean;   // ultimate only (₹199)
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
      const { data } = await supabase
        .from('subscriptions')
        .select('status, plan')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data?.status === 'active') {
        if (data.plan === 'pro_plus') setPlan('pro_plus');
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

  const isPro = plan === 'ultimate' || plan === 'pro_plus';
  const isProPlus = plan === 'pro_plus';
  const isUltimate = plan === 'ultimate';

  return (
    <SubscriptionContext.Provider value={{ plan, loading, isPro, isProPlus, isUltimate, refetch: fetchSubscription }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider');
  return ctx;
};
