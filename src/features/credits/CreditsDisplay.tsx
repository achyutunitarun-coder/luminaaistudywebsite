import { useEffect } from 'react';
import { Zap, Crown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCreditsStore } from './useCreditsStore';
import { useSubscription } from '@/hooks/useSubscription';

interface Props {
  onClick: () => void;
  className?: string;
}

export const CreditsDisplay = ({ onClick, className = '' }: Props) => {
  const { balance, setBalance, plan } = useCreditsStore();
  const { isPro, plan: subPlan } = useSubscription();
  const isLow = balance < 3 && !isPro;
  const isPremium = isPro;

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return;
      (supabase as any)
        .from('user_credit_balances')
        .select('balance,plan')
        .maybeSingle()
        .then(({ data: row }: any) => {
          if (!cancelled && row) setBalance(Number(row.balance), row.plan);
        });
    });
    return () => { cancelled = true; };
  }, [setBalance]);

  if (isPremium) {
    const planLabel = subPlan === 'power_plus' ? 'POWER+' : subPlan === 'mega' ? 'MEGA' : subPlan === 'pro_plus' ? 'PRO+' : 'Ultimate';
    return (
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20 ${className}`}
        title={`${planLabel} plan · ${balance} credits`}
      >
        <Crown className="w-3.5 h-3.5 shrink-0" fill="currentColor" />
        <span className="tabular-nums">{balance.toFixed(1)}</span>
        <span className="opacity-70">cr</span>
        <span className="ml-0.5 text-[10px] uppercase tracking-wider font-bold text-amber-200">{planLabel}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
        isLow
          ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
          : 'bg-violet-500/10 border-violet-500/30 text-violet-300 hover:bg-violet-500/20'
      } ${className}`}
      title={isLow ? 'Low credits — tap to top up' : 'Credits balance'}
    >
      <Zap className="w-3.5 h-3.5 shrink-0" fill="currentColor" />
      <span className="tabular-nums">{balance.toFixed(1)}</span>
      <span className="opacity-70">credit{balance === 1 ? '' : 's'}</span>
      {isLow && <span className="ml-0.5 text-[10px] uppercase tracking-wider opacity-90 font-semibold">Low</span>}
    </button>
  );
};
