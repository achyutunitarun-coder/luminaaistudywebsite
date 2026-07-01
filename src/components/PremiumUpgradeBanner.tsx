import { Crown, Zap, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from '@/hooks/useSubscription';

interface Props {
  feature: string;
  usageCount?: { used: number; limit: number };
  variant?: 'banner' | 'card' | 'inline';
  className?: string;
}

export function PremiumUpgradeBanner({ feature, usageCount, variant = 'banner', className = '' }: Props) {
  const { isPro, plan } = useSubscription();
  const navigate = useNavigate();

  if (isPro) return null;

  const remaining = usageCount ? usageCount.limit - usageCount.used : null;

  if (variant === 'inline') {
    return (
      <button
        onClick={() => navigate('/upgrade')}
        className={`inline-flex items-center gap-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors ${className}`}
      >
        <Crown className="w-3 h-3" />
        Upgrade for unlimited
        <ArrowRight className="w-3 h-3" />
      </button>
    );
  }

  if (variant === 'card') {
    return (
      <div className={`rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent p-5 ${className}`}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
            <Crown className="w-5 h-5 text-amber-400" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-amber-200 mb-1">Upgrade to {plan === 'basic' ? 'Ultimate' : 'PRO+'}</h4>
            <p className="text-xs text-amber-400/70 mb-3">
              {remaining !== null
                ? `You've used ${usageCount!.used} of ${usageCount!.limit} ${feature} uses.`
                : `Unlock unlimited ${feature} and all premium features.`}
            </p>
            <button
              onClick={() => navigate('/upgrade')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors"
            >
              <Zap className="w-3 h-3" />
              View Plans
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-4 ${className}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
            <Crown className="w-4 h-4 text-amber-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-amber-200">
              {remaining !== null
                ? `${remaining} ${feature} use${remaining === 1 ? '' : 's'} remaining`
                : `Unlock unlimited ${feature}`}
            </p>
            <p className="text-xs text-amber-400/60">
              Upgrade to {plan === 'basic' ? 'Ultimate (₹199/mo)' : 'PRO+ (₹499/mo)'} for higher limits
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/upgrade')}
          className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/20 transition-all"
        >
          Upgrade <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
