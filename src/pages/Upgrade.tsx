/**
 * /upgrade — In-app pricing page.
 * Bold editorial look — Cabinet Grotesk display, Inter body, JetBrains Mono accents.
 * 5 subscription tiers + credit packs + credit calculator.
 * Checkout is handled by Dodo; the dodo-webhook + usePaymentReturn entitle credits on success.
 */
import { useEffect, useMemo, useState } from 'react';
import { Check, Sparkles, Zap, Crown, Rocket, Star, Calculator, ArrowRight, Infinity as InfinityIcon } from 'lucide-react';
import { SUBSCRIPTION_PLANS, CREDIT_PACKS, openCheckout } from '@/features/credits/DodoPayments';
import { useSubscription } from '@/hooks/useSubscription';
import { useCreditsStore } from '@/features/credits/useCreditsStore';
import { cn } from '@/lib/utils';

type BillingCycle = 'monthly' | 'annual';

const FEATURE_COSTS: Record<string, { label: string; perUse: number }> = {
  notes:      { label: 'Notes Generator',      perUse: 1.5 },
  exam:       { label: 'Exam Pack',            perUse: 1.5 },
  slides:     { label: 'Slides Artifact',      perUse: 1.5 },
  code:       { label: 'Code Artifact',        perUse: 1.5 },
  lecture3:   { label: 'Lecture Notes only',   perUse: 3 },
  lecture5:   { label: 'Lecture Notes + Cards',perUse: 5 },
  lecture7:   { label: 'Lecture Notes+Cards+Quiz', perUse: 7 },
  lecture10:  { label: 'Lecture Full Pack',    perUse: 10 },
  podcast:    { label: 'Podcast Only',         perUse: 5 },
};

interface Tier {
  id: 'basic' | 'ultimate' | 'pro_plus' | 'mega' | 'power_plus';
  name: string;
  tagline: string;
  priceMonthly: number;
  priceAnnual: number;
  credits: number | null;
  rollover: number | null;
  bullets: string[];
  badge?: string;
  accent: 'slate' | 'purple' | 'gold' | 'amber' | 'rose';
  icon: typeof Sparkles;
  cta: string;
  checkout?: { monthly: string; annual: string };
}

const TIERS: Tier[] = [
  {
    id: 'basic',
    name: 'Basic',
    tagline: 'Start free, forever.',
    priceMonthly: 0,
    priceAnnual: 0,
    credits: 5,
    rollover: 0,
    bullets: [
      '5 AI credits / month',
      'AI Chat — 20 / day',
      'Doubt Solver — 20 / day',
      'Notes Generator — 3 / day',
      'Test Generator — 3 / day',
      'Flashcards · Quick Study',
      'Quest · Leaderboard',
    ],
    accent: 'slate',
    icon: Sparkles,
    cta: 'Current plan',
  },
  {
    id: 'ultimate',
    name: 'Ultimate',
    tagline: 'For serious daily learners.',
    priceMonthly: SUBSCRIPTION_PLANS.ultimate.priceMonthly,
    priceAnnual: SUBSCRIPTION_PLANS.ultimate.priceAnnual,
    credits: SUBSCRIPTION_PLANS.ultimate.credits,
    rollover: SUBSCRIPTION_PLANS.ultimate.rolloverCap,
    badge: 'Most Popular',
    bullets: [
      '40 credits / month · rollover up to 80',
      'Unlimited AI Chat',
      '5 AI models',
      'Unlimited Notes, Tests, Flashcards',
      'Guided Lesson · Smart Notebook',
      'Lecture AI · Note to Quiz',
    ],
    accent: 'purple',
    icon: Zap,
    cta: 'Upgrade to Ultimate',
    checkout: { monthly: SUBSCRIPTION_PLANS.ultimate.checkoutMonthly, annual: SUBSCRIPTION_PLANS.ultimate.checkoutAnnual },
  },
  {
    id: 'pro_plus',
    name: 'PRO+',
    tagline: 'Power tools, every model.',
    priceMonthly: SUBSCRIPTION_PLANS.pro_plus.priceMonthly,
    priceAnnual: SUBSCRIPTION_PLANS.pro_plus.priceAnnual,
    credits: SUBSCRIPTION_PLANS.pro_plus.credits,
    rollover: SUBSCRIPTION_PLANS.pro_plus.rolloverCap,
    bullets: [
      '150 credits / month · rollover up to 300',
      'All 8 AI models',
      'Reasoning · Deep Dive · Creative modes',
      'Larger tests & flashcard decks',
      'AI Study Plans',
      'Lumina Computer access',
    ],
    accent: 'gold',
    icon: Crown,
    cta: 'Upgrade to PRO+',
    checkout: { monthly: SUBSCRIPTION_PLANS.pro_plus.checkoutMonthly, annual: SUBSCRIPTION_PLANS.pro_plus.checkoutAnnual },
  },
  {
    id: 'mega',
    name: 'MEGA',
    tagline: 'For heavy daily usage.',
    priceMonthly: SUBSCRIPTION_PLANS.mega.priceMonthly,
    priceAnnual: SUBSCRIPTION_PLANS.mega.priceAnnual,
    credits: SUBSCRIPTION_PLANS.mega.credits,
    rollover: SUBSCRIPTION_PLANS.mega.rolloverCap,
    bullets: [
      '300 credits / month · rollover up to 600',
      'Everything in PRO+',
      'Advanced Weakness Radar',
      'Enhanced Study Session',
      'More AI horsepower per task',
      'Priority routing',
    ],
    accent: 'amber',
    icon: Rocket,
    cta: 'Go MEGA',
    checkout: { monthly: SUBSCRIPTION_PLANS.mega.checkoutMonthly, annual: SUBSCRIPTION_PLANS.mega.checkoutAnnual },
  },
  {
    id: 'power_plus',
    name: 'POWER+',
    tagline: 'The flagship. No ceiling.',
    priceMonthly: SUBSCRIPTION_PLANS.power_plus.priceMonthly,
    priceAnnual: SUBSCRIPTION_PLANS.power_plus.priceAnnual,
    credits: SUBSCRIPTION_PLANS.power_plus.credits,
    rollover: SUBSCRIPTION_PLANS.power_plus.rolloverCap,
    badge: 'Flagship',
    bullets: [
      '500 credits / month · rollover up to 1000',
      'Everything in MEGA',
      '200-question tests',
      '200-card flashcard decks',
      'Personalized Exam Roadmap',
      'Lumina Computer — 100 sessions / mo',
      'Dedicated Success Manager',
    ],
    accent: 'rose',
    icon: Star,
    cta: 'Get POWER+',
    checkout: { monthly: SUBSCRIPTION_PLANS.power_plus.checkoutMonthly, annual: SUBSCRIPTION_PLANS.power_plus.checkoutAnnual },
  },
];

const ACCENT_RING: Record<Tier['accent'], string> = {
  slate:  'from-slate-500/20 via-transparent to-transparent',
  purple: 'from-violet-500/40 via-violet-500/10 to-transparent',
  gold:   'from-amber-300/40 via-amber-300/10 to-transparent',
  amber:  'from-orange-400/40 via-orange-400/10 to-transparent',
  rose:   'from-rose-400/40 via-rose-400/10 to-transparent',
};

const ACCENT_TEXT: Record<Tier['accent'], string> = {
  slate: 'text-slate-300',
  purple: 'text-violet-300',
  gold: 'text-amber-300',
  amber: 'text-orange-300',
  rose: 'text-rose-300',
};

const ACCENT_BTN: Record<Tier['accent'], string> = {
  slate:  'bg-white/[0.06] text-slate-200 hover:bg-white/[0.1] cursor-default',
  purple: 'bg-violet-500 text-white hover:bg-violet-400 shadow-[0_0_40px_-10px_rgba(139,92,246,0.8)]',
  gold:   'bg-amber-400 text-slate-950 hover:bg-amber-300 shadow-[0_0_40px_-10px_rgba(251,191,36,0.8)]',
  amber:  'bg-orange-500 text-white hover:bg-orange-400 shadow-[0_0_40px_-10px_rgba(249,115,22,0.8)]',
  rose:   'bg-rose-500 text-white hover:bg-rose-400 shadow-[0_0_40px_-10px_rgba(244,63,94,0.8)]',
};

const Upgrade = () => {
  const { plan: currentPlan } = useSubscription();
  const { balance } = useCreditsStore();
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [feature, setFeature] = useState<keyof typeof FEATURE_COSTS>('notes');
  const [usage, setUsage] = useState(20);

  useEffect(() => {
    document.title = 'Pricing — Lumina AI · Study Smarter. Score Higher.';
  }, []);

  const required = useMemo(() => +(FEATURE_COSTS[feature].perUse * usage).toFixed(1), [feature, usage]);
  const recommendation = useMemo(() => {
    const sub = TIERS.filter(t => t.credits && t.credits >= required && t.id !== 'basic')[0];
    const pack = [...CREDIT_PACKS].find(p => p.credits >= required) ?? CREDIT_PACKS[CREDIT_PACKS.length - 1];
    return { sub, pack };
  }, [required]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0a1a] text-slate-100 font-sans">
      {/* atmospheric gradient orbs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-32 w-[42rem] h-[42rem] rounded-full bg-violet-600/20 blur-[140px]" />
        <div className="absolute top-1/3 -right-32 w-[36rem] h-[36rem] rounded-full bg-amber-500/15 blur-[140px]" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[48rem] h-[48rem] rounded-full bg-rose-500/10 blur-[160px]" />
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cabinet+Grotesk:wght@500;600;700;800;900&family=JetBrains+Mono:wght@500;600&display=swap');
        .font-display { font-family: 'Cabinet Grotesk', ui-sans-serif, system-ui, sans-serif; letter-spacing: -0.02em; }
        .font-mono-display { font-family: 'JetBrains Mono', ui-monospace, monospace; }
      `}</style>

      <div className="relative max-w-7xl mx-auto px-6 pt-20 pb-32">
        {/* HERO */}
        <header className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.03] text-xs font-mono-display uppercase tracking-widest text-violet-300 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" /> Pricing
          </div>
          <h1 className="font-display text-5xl sm:text-7xl md:text-8xl font-extrabold leading-[0.95] mb-6">
            Study <span className="italic font-black bg-gradient-to-br from-violet-300 via-amber-200 to-rose-300 bg-clip-text text-transparent">smarter</span>.
            <br />Score higher.
          </h1>
          <p className="max-w-2xl mx-auto text-lg text-slate-400">
            40+ study tools. 8 model modes. Canvas Mode. Lumina Computer.
            Built by students, for students.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3 text-sm">
            <Pill icon="★" label="4.9 / 5" sub="rating" />
            <Pill icon="◆" label="9.5 / 10" sub="QA score" />
            <Pill icon="◉" label="10,000+" sub="students" />
            <Pill icon="⟁" label="40+" sub="tools" />
          </div>

          {/* Billing toggle */}
          <div className="mt-12 inline-flex p-1 rounded-full border border-white/10 bg-white/[0.03] backdrop-blur-xl">
            {(['monthly','annual'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCycle(c)}
                className={cn(
                  'px-6 py-2 rounded-full text-sm font-medium transition-all capitalize',
                  cycle === c ? 'bg-white text-slate-950 shadow-lg' : 'text-slate-400 hover:text-white',
                )}
              >
                {c}{c === 'annual' && <span className="ml-2 text-[10px] font-mono-display text-emerald-400">−33%</span>}
              </button>
            ))}
          </div>
        </header>

        {/* PLANS */}
        <section id="plans" className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 mb-32">
          {TIERS.map((tier) => {
            const price = cycle === 'annual' ? tier.priceAnnual : tier.priceMonthly;
            const isCurrent = currentPlan === tier.id || (currentPlan === 'basic' && tier.id === 'basic');
            const Icon = tier.icon;
            return (
              <article
                key={tier.id}
                className={cn(
                  'group relative rounded-3xl border border-white/10 bg-white/[0.025] backdrop-blur-xl p-6 flex flex-col transition-all hover:border-white/20 hover:-translate-y-1',
                  tier.badge === 'Most Popular' && 'lg:scale-[1.03] border-violet-400/40 bg-violet-500/[0.06]',
                  tier.badge === 'Flagship' && 'border-rose-400/30',
                )}
              >
                {/* glow ring */}
                <div aria-hidden className={cn('absolute -inset-px rounded-3xl bg-gradient-to-b opacity-0 group-hover:opacity-100 transition-opacity -z-10', ACCENT_RING[tier.accent])} />

                {tier.badge && (
                  <div className={cn(
                    'absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-mono-display font-semibold uppercase tracking-widest',
                    tier.badge === 'Most Popular' ? 'bg-violet-500 text-white' : 'bg-rose-500 text-white',
                  )}>
                    {tier.badge}
                  </div>
                )}

                <div className={cn('inline-flex w-10 h-10 items-center justify-center rounded-xl bg-white/[0.04] border border-white/10 mb-5', ACCENT_TEXT[tier.accent])}>
                  <Icon className="w-5 h-5" />
                </div>

                <h3 className="font-display text-2xl font-bold mb-1">{tier.name}</h3>
                <p className="text-xs text-slate-500 mb-6">{tier.tagline}</p>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="font-display text-5xl font-extrabold">₹{price}</span>
                    <span className="text-sm text-slate-500">/mo</span>
                  </div>
                  {cycle === 'annual' && tier.priceMonthly > 0 && (
                    <p className="text-[11px] font-mono-display text-slate-500 mt-1">billed yearly · ₹{price * 12}</p>
                  )}
                </div>

                {tier.credits !== null && (
                  <div className="mb-6 pb-6 border-b border-white/5">
                    <div className="text-xs font-mono-display uppercase tracking-widest text-slate-500 mb-1">Credits</div>
                    <div className="flex items-baseline gap-2">
                      <span className={cn('font-display text-2xl font-bold', ACCENT_TEXT[tier.accent])}>{tier.credits}</span>
                      <span className="text-xs text-slate-500">/ month</span>
                    </div>
                    {!!tier.rollover && tier.rollover > 0 && (
                      <p className="text-[11px] text-slate-500 mt-0.5">rollover up to {tier.rollover}</p>
                    )}
                  </div>
                )}

                <ul className="space-y-2.5 mb-8 flex-1">
                  {tier.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2.5 text-sm text-slate-300">
                      <Check className={cn('w-4 h-4 mt-0.5 shrink-0', ACCENT_TEXT[tier.accent])} />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  disabled={isCurrent || !tier.checkout}
                  onClick={() => tier.checkout && openCheckout(cycle === 'annual' ? tier.checkout.annual : tier.checkout.monthly)}
                  className={cn(
                    'w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2',
                    isCurrent ? 'bg-white/[0.04] text-slate-500 cursor-not-allowed border border-white/5' : ACCENT_BTN[tier.accent],
                  )}
                >
                  {isCurrent ? 'Current plan' : tier.cta}
                  {!isCurrent && tier.checkout && <ArrowRight className="w-4 h-4" />}
                </button>
              </article>
            );
          })}
        </section>

        {/* CREDIT PACKS */}
        <section className="mb-32">
          <div className="text-center mb-12">
            <div className="text-xs font-mono-display uppercase tracking-widest text-amber-300 mb-3">Top-up</div>
            <h2 className="font-display text-4xl sm:text-5xl font-extrabold mb-3">Credit packs.</h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              One-time top-ups. Stack them on any plan. Credits never expire.
              {' '}<span className="font-mono-display text-amber-300">Current balance: {balance.toFixed(1)}</span>
            </p>
          </div>
          <div className="grid gap-5 grid-cols-2 lg:grid-cols-4">
            {CREDIT_PACKS.map((p) => (
              <article key={p.id} className="group relative rounded-2xl border border-white/10 bg-white/[0.025] backdrop-blur-xl p-6 hover:border-amber-400/30 hover:-translate-y-1 transition-all">
                {p.badge && (
                  <div className="absolute -top-2.5 right-4 px-2 py-0.5 rounded-md text-[10px] font-mono-display font-semibold uppercase tracking-widest bg-amber-400 text-slate-950">
                    {p.badge}
                  </div>
                )}
                <div className="font-display text-xl font-bold text-slate-100 mb-2">{p.name}</div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="font-display text-4xl font-extrabold text-amber-300">{p.credits}</span>
                  <span className="text-sm text-slate-500">credits</span>
                </div>
                <div className="text-[11px] font-mono-display text-slate-500 mb-5">₹{p.perCredit.toFixed(2)} / credit</div>
                <div className="flex items-baseline gap-1 mb-5">
                  <span className="font-display text-2xl font-bold">₹{p.price}</span>
                </div>
                <button
                  onClick={() => openCheckout(p.checkout)}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold bg-white/[0.04] hover:bg-amber-400 hover:text-slate-950 border border-white/10 hover:border-amber-400 transition-all"
                >
                  Buy {p.name}
                </button>
              </article>
            ))}
          </div>
        </section>

        {/* CREDIT CALCULATOR */}
        <section className="mb-24">
          <div className="text-center mb-12">
            <div className="text-xs font-mono-display uppercase tracking-widest text-violet-300 mb-3">Calculator</div>
            <h2 className="font-display text-4xl sm:text-5xl font-extrabold mb-3">How many credits will you need?</h2>
            <p className="text-slate-400">Estimate your usage, pick the right plan.</p>
          </div>

          <div className="grid lg:grid-cols-[1.2fr_1fr] gap-8 rounded-3xl border border-white/10 bg-white/[0.025] backdrop-blur-xl p-8">
            {/* Controls */}
            <div className="space-y-6">
              <div>
                <label className="text-xs font-mono-display uppercase tracking-widest text-slate-500 mb-3 block">Feature</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(FEATURE_COSTS).map(([k, v]) => (
                    <button
                      key={k}
                      onClick={() => setFeature(k as keyof typeof FEATURE_COSTS)}
                      className={cn(
                        'px-3 py-2.5 rounded-lg text-xs font-medium text-left transition-all border',
                        feature === k ? 'bg-violet-500/20 border-violet-400/50 text-white' : 'bg-white/[0.02] border-white/10 text-slate-400 hover:border-white/20',
                      )}
                    >
                      <div className="truncate">{v.label}</div>
                      <div className="text-[10px] font-mono-display text-slate-500 mt-0.5">{v.perUse} cr/use</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-mono-display uppercase tracking-widest text-slate-500 mb-3 flex items-center justify-between">
                  <span>Uses per month</span>
                  <span className="text-violet-300 font-bold text-base">{usage}</span>
                </label>
                <input
                  type="range" min={1} max={100} value={usage}
                  onChange={(e) => setUsage(Number(e.target.value))}
                  className="w-full accent-violet-400"
                />
                <div className="flex justify-between text-[10px] font-mono-display text-slate-600 mt-2">
                  <span>1</span><span>50</span><span>100</span>
                </div>
              </div>
            </div>

            {/* Result */}
            <div className="rounded-2xl bg-gradient-to-br from-violet-500/10 via-transparent to-amber-500/10 border border-white/10 p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-mono-display uppercase tracking-widest text-slate-400 mb-3">
                  <Calculator className="w-3.5 h-3.5" /> You'll need
                </div>
                <div className="font-display text-6xl font-extrabold mb-1 bg-gradient-to-br from-white to-violet-300 bg-clip-text text-transparent">
                  {required}
                </div>
                <div className="text-sm text-slate-500">credits / month</div>
              </div>

              <div className="space-y-3 mt-6">
                {recommendation.sub && (
                  <div className="rounded-xl bg-white/[0.04] border border-white/10 p-4">
                    <div className="text-[10px] font-mono-display uppercase tracking-widest text-violet-300 mb-1">Recommended subscription</div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-display text-lg font-bold">{recommendation.sub.name}</div>
                        <div className="text-xs text-slate-500">₹{recommendation.sub.priceMonthly}/mo · {recommendation.sub.credits} credits</div>
                      </div>
                      <a href="#plans" className="text-xs font-semibold text-violet-300 hover:text-white transition flex items-center gap-1">
                        View <ArrowRight className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                )}
                <div className="rounded-xl bg-white/[0.04] border border-white/10 p-4">
                  <div className="text-[10px] font-mono-display uppercase tracking-widest text-amber-300 mb-1">Or top up with</div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-display text-lg font-bold">{recommendation.pack.name} pack</div>
                      <div className="text-xs text-slate-500">₹{recommendation.pack.price} · {recommendation.pack.credits} credits</div>
                    </div>
                    <button onClick={() => openCheckout(recommendation.pack.checkout)} className="text-xs font-semibold text-amber-300 hover:text-white transition flex items-center gap-1">
                      Buy <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FINE PRINT */}
        <footer className="text-center text-xs font-mono-display text-slate-500">
          <p className="flex items-center justify-center gap-2">
            <InfinityIcon className="w-3.5 h-3.5" />
            Cancel anytime · Credits sync via webhook on payment success · GST included
          </p>
        </footer>
      </div>
    </div>
  );
};

const Pill = ({ icon, label, sub }: { icon: string; label: string; sub: string }) => (
  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.025]">
    <span className="text-amber-300">{icon}</span>
    <span className="font-display font-bold text-white">{label}</span>
    <span className="text-slate-500">{sub}</span>
  </div>
);

export default Upgrade;
