import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface Props {
  stage: string;
  active: boolean;
}

export const LoadingStages = ({ stage, active }: Props) => {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    if (!active) { setPct(0); return; }
    setPct(0);
    const t1 = setTimeout(() => setPct(25), 300);
    const t2 = setTimeout(() => setPct(55), 1500);
    const t3 = setTimeout(() => setPct(72), 4000);
    const t4 = setTimeout(() => setPct(88), 12000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [active, stage]);

  if (!active) return null;

  return (
    <div className="px-4 py-3 flex items-center gap-3">
      <div className="flex-1">
        <div className="text-xs text-muted-foreground mb-1.5 flex items-center gap-2">
          <motion.span
            className="w-1.5 h-1.5 rounded-full bg-primary"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.4, repeat: Infinity }}
          />
          {stage || 'Thinking…'}
        </div>
        <div className="h-[3px] w-full rounded-full bg-border/40 overflow-hidden">
          <motion.div
            initial={{ width: '0%' }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-primary to-primary/60"
          />
        </div>
      </div>
    </div>
  );
};
