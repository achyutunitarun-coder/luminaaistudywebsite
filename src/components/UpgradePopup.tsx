import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, MessageSquare, BookOpen, Brain, FileText, HelpCircle, Crown, Infinity } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DODO_PRODUCT_ID = 'pdt_0NbKNHJ5nK556qajM5MKa';

const features = [
  { icon: MessageSquare, label: 'Unlimited AI messages' },
  { icon: BookOpen, label: 'Unlimited study sessions' },
  { icon: Brain, label: 'Unlimited tests' },
  { icon: Zap, label: 'Unlimited flashcards' },
  { icon: FileText, label: 'Unlimited notes generations' },
  { icon: HelpCircle, label: 'Unlimited doubt solving' },
  { icon: Crown, label: 'Full access to all features' },
];

export const UpgradePopup = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const handleUpgrade = () => {
    window.open(`https://checkout.dodopayments.com/buy/${DODO_PRODUCT_ID}`, '_blank');
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

          {/* Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative z-10 w-full max-w-md rounded-2xl bg-card border border-border/20 shadow-2xl overflow-hidden"
          >
            {/* Gradient top accent */}
            <div className="h-1.5 w-full bg-gradient-to-r from-primary via-primary/80 to-accent" />

            <div className="p-6 md:p-8">
              {/* Close */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Icon */}
              <div className="flex justify-center mb-5">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Crown className="w-7 h-7 text-primary" />
                </div>
              </div>

              {/* Title */}
              <h2 className="text-xl font-display font-bold text-foreground text-center mb-2">
                Upgrade to Pro to keep using Lumina
              </h2>
              <p className="text-sm text-muted-foreground text-center mb-6 leading-relaxed">
                You've reached your daily limit. Upgrade to PRO to unlock unlimited messages, study sessions, tests, flashcards, notes, doubt solving, and all features.
              </p>

              {/* Features */}
              <div className="space-y-2.5 mb-6">
                {features.map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-muted/10 border border-border/10">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-sm text-foreground/80 flex-1">{label}</span>
                    <Infinity className="w-4 h-4 text-primary/60" />
                  </div>
                ))}
              </div>

              {/* Price */}
              <div className="text-center mb-5">
                <span className="text-3xl font-bold text-foreground">₹399</span>
                <span className="text-muted-foreground text-sm">/month</span>
              </div>

              {/* Buttons */}
              <div className="space-y-2.5">
                <Button
                  onClick={handleUpgrade}
                  className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold text-base"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Upgrade Now
                </Button>
                <Button
                  onClick={onClose}
                  variant="ghost"
                  className="w-full h-10 rounded-xl text-muted-foreground hover:text-foreground text-sm"
                >
                  Maybe Later
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
