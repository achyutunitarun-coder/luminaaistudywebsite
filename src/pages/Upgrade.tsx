import { motion } from 'framer-motion';
import { Check, X, Zap, Crown, Shield, Star, Sparkles, Rocket, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/hooks/useSubscription';

const DODO_ULTIMATE_ID = 'pdt_0NbKNHJ5nK556qajM5MKa';
const DODO_PRO_PLUS_ID = 'pdt_0Nbybrhl2M0GdzScdoAwb';

const basicLimits = [
  '50 AI chat messages/day',
  '3 study sessions/day',
  '10 test generations/day',
  '10 flashcard sets/day',
  '6 notes generations/day',
  '25 quest games/day',
  '50 doubt-solving messages/day',
  'Limited Hub access (daily caps)',
  '1 podcast generation/week',
  '1 weakness radar/week',
];

const ultimateFeatures = [
  'Unlimited AI messages',
  'Unlimited study sessions',
  'Unlimited tests & flashcards',
  'Unlimited notes generations',
  'Unlimited quest games',
  'Unlimited doubt solving',
  'Unlimited podcast generation',
  'Unlimited weakness radar',
  'Priority support',
];

const ultimateExclusions = [
  'Full Hub access (PRO+ only)',
  'Advanced analytics & insights',
  'Focus Mode',
  'Custom study plans',
];

const proPlus = [
  'Everything in Ultimate',
  'Full Hub access — all 7 modules unlimited',
  'Full cognitive dashboard history (1 year)',
  'Focus Mode (no skipping)',
  'Advanced analytics & insights',
  'Priority AI responses',
  'Custom study plans',
  'Exclusive badges & XP boosts',
];

const Upgrade = () => {
  const { isPro, isProPlus, isUltimate } = useSubscription();

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }} className="flex justify-center mb-5">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20 flex items-center justify-center shadow-xl shadow-amber-500/10">
            <Crown className="w-10 h-10 text-amber-400" />
          </div>
        </motion.div>
        <h1 className="text-4xl font-display font-bold text-foreground mb-3 tracking-tight">
          Upgrade to <span className="text-gradient-animated">Lumina Pro</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-md mx-auto">Unlock unlimited study power and supercharge your learning</p>
      </motion.div>

      <div className="grid md:grid-cols-3 gap-5">
        {/* Basic */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="rounded-[1.75rem] liquid-glass p-6">
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-muted/30 flex items-center justify-center"><Shield className="w-5 h-5 text-muted-foreground" /></div>
              <div><h3 className="text-lg font-display font-semibold text-foreground">Basic</h3><p className="text-muted-foreground text-xs">Free forever</p></div>
            </div>
            <div className="text-4xl font-display font-bold text-foreground mb-6">₹0<span className="text-sm font-normal text-muted-foreground ml-1">/month</span></div>
            <div className="space-y-2.5">
              {basicLimits.map(item => (
                <div key={item} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <div className="w-5 h-5 rounded-full bg-muted/20 flex items-center justify-center flex-shrink-0"><X className="w-3 h-3 text-muted-foreground/50" /></div>
                  {item}
                </div>
              ))}
            </div>
            {!isPro && <Button variant="outline" className="w-full mt-6 h-11 rounded-2xl" disabled>Current Plan</Button>}
          </div>
        </motion.div>

        {/* Ultimate ₹199 */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="rounded-[1.75rem] liquid-glass-elevated p-6 shimmer-border relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full gradient-primary text-[11px] font-bold text-primary-foreground uppercase tracking-wider">Popular</div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center"><Crown className="w-5 h-5 text-amber-400" /></div>
              <div><h3 className="text-lg font-display font-semibold text-foreground">Ultimate</h3><p className="text-muted-foreground text-xs">Unlimited AI tools</p></div>
            </div>
            <div className="text-4xl font-display font-bold text-foreground mb-1">₹199<span className="text-sm font-normal text-muted-foreground ml-1">/month</span></div>
            <p className="text-xs text-muted-foreground mb-5">All AI tools unlimited · No Hub access</p>
            <div className="space-y-2.5">
              {ultimateFeatures.map((item, i) => (
                <motion.div key={item} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + i * 0.03 }} className="flex items-center gap-2.5 text-sm text-foreground/80">
                  <div className="w-5 h-5 rounded-full gradient-primary flex items-center justify-center flex-shrink-0"><Check className="w-3 h-3 text-primary-foreground" /></div>
                  {item}
                </motion.div>
              ))}
              {ultimateExclusions.map((item, i) => (
                <motion.div key={item} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.03 }} className="flex items-center gap-2.5 text-sm text-muted-foreground/50">
                  <div className="w-5 h-5 rounded-full bg-muted/20 flex items-center justify-center flex-shrink-0"><Lock className="w-3 h-3 text-muted-foreground/40" /></div>
                  {item}
                </motion.div>
              ))}
            </div>
            {isUltimate ? (
              <Button variant="outline" className="w-full mt-6 h-11 rounded-2xl" disabled><Star className="w-4 h-4 mr-2" /> Current Plan</Button>
            ) : isProPlus ? (
              <Button variant="outline" className="w-full mt-6 h-11 rounded-2xl" disabled>Included in PRO+</Button>
            ) : (
              <Button onClick={() => window.open(`https://checkout.dodopayments.com/buy/${DODO_ULTIMATE_ID}`, '_blank')}
                className="w-full mt-6 h-12 rounded-2xl gradient-primary text-primary-foreground font-semibold text-base shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all hover:scale-[1.01] active:scale-[0.99]">
                <Zap className="w-5 h-5 mr-2" /> Upgrade Now
              </Button>
            )}
          </div>
        </motion.div>

        {/* PRO+ ₹499 */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="rounded-[1.75rem] liquid-glass p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-purple-500/5" />
          <div className="absolute inset-[1px] rounded-[calc(1.75rem-1px)] border border-violet-500/30" />
          <div className="absolute -top-3 right-4 px-3 py-1 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1 z-10">
            <Rocket className="w-3 h-3" /> Best Value
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center"><Sparkles className="w-5 h-5 text-violet-400" /></div>
              <div><h3 className="text-lg font-display font-semibold text-foreground">PRO+</h3><p className="text-muted-foreground text-xs">Maximum power</p></div>
            </div>
            <div className="text-4xl font-display font-bold text-foreground mb-1">₹499<span className="text-sm font-normal text-muted-foreground ml-1">/month</span></div>
            <p className="text-xs text-violet-400/80 mb-5">Everything unlimited · Full Hub access</p>
            <div className="space-y-2.5">
              {proPlus.map((item, i) => (
                <motion.div key={item} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.03 }} className="flex items-center gap-2.5 text-sm text-foreground/80">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center flex-shrink-0"><Check className="w-3 h-3 text-white" /></div>
                  {item}
                </motion.div>
              ))}
            </div>
            {isProPlus ? (
              <Button variant="outline" className="w-full mt-6 h-11 rounded-2xl" disabled><Star className="w-4 h-4 mr-2" /> Current Plan</Button>
            ) : (
              <Button onClick={() => window.open(`https://checkout.dodopayments.com/buy/${DODO_PRO_PLUS_ID}`, '_blank')}
                className="w-full mt-6 h-12 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-500 text-white font-semibold text-base shadow-lg shadow-violet-500/20 hover:shadow-xl hover:shadow-violet-500/30 transition-all hover:scale-[1.01] active:scale-[0.99]">
                <Rocket className="w-5 h-5 mr-2" /> Go PRO+
              </Button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Upgrade;
