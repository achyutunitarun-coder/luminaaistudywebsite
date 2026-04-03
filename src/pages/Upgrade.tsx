import { motion } from 'framer-motion';
import { Check, X, Zap, Crown, Infinity, Sparkles, Shield, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/hooks/useSubscription';

const DODO_PRODUCT_ID = 'pdt_0NbKNHJ5nK556qajM5MKa';

const basicLimits = [
  '50 AI chat messages/day',
  '3 study sessions/day',
  '10 test generations/day',
  '10 flashcard sets/day',
  '6 notes generations/day',
  '25 quest games/day',
  '50 doubt-solving messages/day',
  '5 summaries/day',
  '1 podcast generation/week',
  '1 weakness radar/week',
];

const proFeatures = [
  'Unlimited AI messages',
  'Unlimited study sessions',
  'Unlimited tests & flashcards',
  'Unlimited notes generations',
  'Unlimited quest games',
  'Unlimited doubt solving',
  'Unlimited summaries',
  'Unlimited podcast generation',
  'Unlimited weakness radar',
  'Priority support',
];

const Upgrade = () => {
  const { isPro } = useSubscription();

  const handleUpgrade = () => {
    window.open(`https://checkout.dodopayments.com/buy/${DODO_PRODUCT_ID}`, '_blank');
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
          className="flex justify-center mb-5"
        >
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20 flex items-center justify-center shadow-xl shadow-amber-500/10">
            <Crown className="w-10 h-10 text-amber-400" />
          </div>
        </motion.div>
        <h1 className="text-4xl font-display font-bold text-foreground mb-3 tracking-tight">
          Upgrade to <span className="text-gradient-animated">Lumina Ultimate</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-md mx-auto">Unlock unlimited study power and supercharge your learning</p>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Basic */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-[1.75rem] liquid-glass p-7"
        >
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-muted/30 flex items-center justify-center">
                <Shield className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-display font-semibold text-foreground">Basic</h3>
                <p className="text-muted-foreground text-xs">Free forever</p>
              </div>
            </div>
            <div className="text-4xl font-display font-bold text-foreground mb-6">
              ₹0<span className="text-sm font-normal text-muted-foreground ml-1">/month</span>
            </div>
            <div className="space-y-3">
              {basicLimits.map(item => (
                <div key={item} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <div className="w-5 h-5 rounded-full bg-muted/20 flex items-center justify-center flex-shrink-0">
                    <X className="w-3 h-3 text-muted-foreground/50" />
                  </div>
                  {item}
                </div>
              ))}
            </div>
            {!isPro && (
              <Button variant="outline" className="w-full mt-7 h-12 rounded-2xl" disabled>
                Current Plan
              </Button>
            )}
          </div>
        </motion.div>

        {/* Pro */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-[1.75rem] liquid-glass-elevated p-7 shimmer-border"
        >
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                <Crown className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-display font-semibold text-foreground">Ultimate</h3>
                  <span className="px-2 py-0.5 rounded-full gradient-primary text-[10px] font-bold text-primary-foreground uppercase tracking-wider">Best Value</span>
                </div>
                <p className="text-muted-foreground text-xs">Unlimited everything</p>
              </div>
            </div>
            <div className="text-4xl font-display font-bold text-foreground mb-6">
              ₹199<span className="text-sm font-normal text-muted-foreground ml-1">/month</span>
            </div>
            <div className="space-y-3">
              {proFeatures.map((item, i) => (
                <motion.div
                  key={item}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.03 }}
                  className="flex items-center gap-2.5 text-sm text-foreground/80"
                >
                  <div className="w-5 h-5 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </div>
                  {item}
                </motion.div>
              ))}
            </div>
            {isPro ? (
              <Button variant="outline" className="w-full mt-7 h-12 rounded-2xl" disabled>
                <Star className="w-4 h-4 mr-2" /> Current Plan
              </Button>
            ) : (
              <Button
                onClick={handleUpgrade}
                className="w-full mt-7 h-13 rounded-2xl gradient-primary text-primary-foreground font-semibold text-base shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all hover:scale-[1.01] active:scale-[0.99]"
              >
                <Zap className="w-5 h-5 mr-2" />
                Upgrade Now
              </Button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Upgrade;
