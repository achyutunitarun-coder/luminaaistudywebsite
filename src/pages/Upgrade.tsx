import { motion } from 'framer-motion';
import { Check, X, Zap, Crown, Infinity } from 'lucide-react';
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
        className="text-center mb-10"
      >
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Crown className="w-8 h-8 text-primary" />
          </div>
        </div>
        <h1 className="text-3xl font-display font-bold text-foreground mb-2">Upgrade to Pro</h1>
        <p className="text-muted-foreground text-lg">Unlock unlimited study power</p>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Basic */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-border/20 bg-card/60 backdrop-blur-xl p-6"
        >
          <h3 className="text-lg font-semibold text-foreground mb-1">Basic</h3>
          <p className="text-muted-foreground text-sm mb-4">Free forever</p>
          <div className="text-3xl font-bold text-foreground mb-6">
            ₹0<span className="text-sm font-normal text-muted-foreground">/month</span>
          </div>
          <div className="space-y-3">
            {basicLimits.map(item => (
              <div key={item} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                <X className="w-4 h-4 text-destructive/50 flex-shrink-0" />
                {item}
              </div>
            ))}
          </div>
          {!isPro && (
            <Button variant="outline" className="w-full mt-6 rounded-xl" disabled>
              Current Plan
            </Button>
          )}
        </motion.div>

        {/* Pro */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border-2 border-primary/30 bg-card/60 backdrop-blur-xl p-6 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-accent" />
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-semibold text-foreground">Pro</h3>
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-wider">Recommended</span>
          </div>
          <p className="text-muted-foreground text-sm mb-4">Unlimited everything</p>
          <div className="text-3xl font-bold text-foreground mb-6">
            ₹399<span className="text-sm font-normal text-muted-foreground">/month</span>
          </div>
          <div className="space-y-3">
            {proFeatures.map(item => (
              <div key={item} className="flex items-center gap-2.5 text-sm text-foreground/80">
                <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Check className="w-2.5 h-2.5 text-primary" />
                </div>
                {item}
              </div>
            ))}
          </div>
          {isPro ? (
            <Button variant="outline" className="w-full mt-6 rounded-xl" disabled>
              Current Plan
            </Button>
          ) : (
            <Button onClick={handleUpgrade} className="w-full mt-6 h-12 rounded-xl gradient-primary text-primary-foreground font-semibold">
              <Zap className="w-4 h-4 mr-2" />
              Upgrade Now
            </Button>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Upgrade;
