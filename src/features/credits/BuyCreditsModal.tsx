import { useState } from 'react';
import { X, Zap, Check, Star } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CREDIT_PACKS, SUBSCRIPTION_PLANS, openCheckout } from './DodoPayments';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const BuyCreditsModal = ({ open, onOpenChange }: Props) => {
  const [tab, setTab] = useState<'packs' | 'plans'>('packs');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden bg-card/95 backdrop-blur-xl border-border">
        <div className="p-6 md:p-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-violet-400" fill="currentColor" />
              <h2 className="text-2xl font-bold tracking-tight">Top Up Credits</h2>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="p-1 rounded-md hover:bg-accent text-muted-foreground"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground mb-5">
            Credits never expire. Use them anytime.
          </p>

          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl bg-background/60 border border-border w-fit mb-5">
            <button
              type="button"
              onClick={() => setTab('packs')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tab === 'packs' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Credit Packs
            </button>
            <button
              type="button"
              onClick={() => setTab('plans')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tab === 'plans' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Upgrade Plan
            </button>
          </div>

          {tab === 'packs' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CREDIT_PACKS.map((p) => (
                <div
                  key={p.id}
                  className="relative rounded-2xl border border-border bg-card/60 p-4 hover:border-primary/50 hover:-translate-y-0.5 transition-all"
                >
                  {p.badge && (
                    <span
                      className={`absolute -top-2 right-3 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold ${
                        p.badge === 'Best Value'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}
                    >
                      {p.badge}
                    </span>
                  )}
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">{p.name}</div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold text-violet-300">{p.credits}</span>
                    <span className="text-xs text-muted-foreground">credits</span>
                  </div>
                  <div className="mt-2 text-xl font-bold">₹{p.price}</div>
                  <div className="text-[11px] text-muted-foreground">
                    ~{Math.floor(p.credits / 1.5)} artifact generations · ₹{p.perCredit}/credit
                  </div>
                  <button
                    type="button"
                    onClick={() => openCheckout(p.checkout)}
                    className="mt-3 w-full py-2 rounded-lg text-sm font-medium border border-violet-500/40 bg-violet-500/10 hover:bg-violet-500/20 text-violet-200 transition-colors"
                  >
                    Buy Now →
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Ultimate */}
              <div className="rounded-2xl border border-border bg-card/60 p-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Ultimate</div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-2xl font-bold">₹{SUBSCRIPTION_PLANS.ultimate.priceMonthly}</span>
                  <span className="text-xs text-muted-foreground">/mo</span>
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-sm">
                  <Zap className="w-3.5 h-3.5 text-violet-400" fill="currentColor" />
                  <span>{SUBSCRIPTION_PLANS.ultimate.credits} credits/month</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Rollover up to {SUBSCRIPTION_PLANS.ultimate.rolloverCap}
                </div>
                <button
                  type="button"
                  onClick={() => openCheckout(SUBSCRIPTION_PLANS.ultimate.checkoutMonthly)}
                  className="mt-3 w-full py-2 rounded-lg text-sm font-medium border border-violet-500/40 bg-violet-500/10 hover:bg-violet-500/20 text-violet-200 transition-colors"
                >
                  Upgrade to Ultimate →
                </button>
              </div>

              {/* PRO+ featured */}
              <div className="relative rounded-2xl border-2 border-violet-500/60 bg-gradient-to-br from-violet-500/10 via-card/60 to-card/60 p-4">
                <span className="absolute -top-2.5 left-3 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold bg-violet-500 text-white">
                  <Star className="w-2.5 h-2.5" fill="currentColor" /> Most Popular
                </span>
                <div className="text-xs text-violet-300 uppercase tracking-wider">PRO+</div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-2xl font-bold">₹{SUBSCRIPTION_PLANS.pro_plus.priceMonthly}</span>
                  <span className="text-xs text-muted-foreground">/mo</span>
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-sm">
                  <Zap className="w-3.5 h-3.5 text-violet-400" fill="currentColor" />
                  <span>{SUBSCRIPTION_PLANS.pro_plus.credits} credits/month</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Rollover up to {SUBSCRIPTION_PLANS.pro_plus.rolloverCap}
                </div>
                <button
                  type="button"
                  onClick={() => openCheckout(SUBSCRIPTION_PLANS.pro_plus.checkoutMonthly)}
                  className="mt-3 w-full py-2 rounded-lg text-sm font-medium bg-violet-500 hover:bg-violet-400 text-white transition-colors"
                >
                  Upgrade to PRO+ →
                </button>
              </div>
            </div>
          )}

          <div className="mt-5 flex items-center justify-center gap-3 text-[11px] text-muted-foreground flex-wrap">
            <span className="inline-flex items-center gap-1"><Check className="w-3 h-3" /> No card for Basic</span>
            <span className="inline-flex items-center gap-1"><Check className="w-3 h-3" /> Credits never expire</span>
            <span className="inline-flex items-center gap-1"><Check className="w-3 h-3" /> Cancel anytime</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
