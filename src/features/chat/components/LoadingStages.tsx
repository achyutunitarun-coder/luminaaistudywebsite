import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface Props {
  stage: string;
  active: boolean;
}

/**
 * Smooth, monotonically-increasing fake progress that reaches ~94% over a few minutes.
 * Real progress comes when the artifact actually arrives — we then jump to 100.
 */
export const LoadingStages = ({ stage, active }: Props) => {
  const [pct, setPct] = useState(0);
  const [substage, setSubstage] = useState('Designing layout…');

  useEffect(() => {
    if (!active) { setPct(0); return; }
    setPct(2);
    const start = Date.now();
    const id = setInterval(() => {
      const t = (Date.now() - start) / 1000; // seconds
      // Logistic-ish curve: fast early, slows toward 92.
      const target = Math.min(94, 94 * (1 - Math.exp(-t / 70)));
      setPct((prev) => Math.max(prev, +target.toFixed(1)));
      if (t < 5)         setSubstage('Queueing background job…');
      else if (t < 18)   setSubstage('Starting model route…');
      else if (t < 45)   setSubstage('Writing content…');
      else if (t < 90)   setSubstage('Adding styles and interactions…');
      else if (t < 180)  setSubstage('Finalising in background…');
      else               setSubstage('Still working — keeping the job alive…');
    }, 350);
    return () => clearInterval(id);
  }, [active]);

  if (!active) return null;

  return (
    <div className="px-4 py-3 rounded-xl bg-card/40 border border-border">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2 gap-2">
        <span className="flex items-center gap-2 min-w-0 truncate">
          <motion.span
            className="w-1.5 h-1.5 rounded-full bg-primary shrink-0"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.4, repeat: Infinity }}
          />
          <span className="truncate">{stage || substage}</span>
        </span>
        <span className="tabular-nums opacity-70 shrink-0">{Math.round(pct)}%</span>
      </div>
      <div className="h-[3px] w-full rounded-full bg-border/40 overflow-hidden">
        <motion.div
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="h-full bg-gradient-to-r from-primary to-primary/60"
        />
      </div>
      <div className="mt-1.5 text-[10px] text-muted-foreground/70">
        {substage} · artifact jobs can take a few minutes — credits only charge on success
      </div>
    </div>
  );
};
