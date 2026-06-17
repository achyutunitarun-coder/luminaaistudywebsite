import { motion } from 'framer-motion';
import { Brain, TrendingUp, TrendingDown, Target, AlertTriangle, Zap } from 'lucide-react';
import type { SubjectData } from '@/hooks/usePerformanceData';

type Props = { data: SubjectData };

export const InsightBox = ({ data }: Props) => {
  const trend = data.actual - (data.trend.actual[0] || 0);
  const isImproving = trend >= 0;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-6 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, hsl(230 25% 8% / 0.7), hsl(264 20% 10% / 0.5))', borderLeft: '3px solid hsl(174 72% 56%)', border: '1px solid hsl(0 0% 100% / 0.06)' }}
    >
      <div className="absolute top-0 right-0 w-[200px] h-[200px] rounded-full opacity-[0.04]" style={{ background: 'radial-gradient(circle, hsl(174 72% 56%), transparent)' }} />
      <div className="relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4" style={{ background: 'hsl(174 72% 56% / 0.1)', border: '1px solid hsl(174 72% 56% / 0.2)' }}>
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'hsl(174 72% 56%)' }} />
          <Brain className="w-3.5 h-3.5" style={{ color: 'hsl(174 72% 56%)' }} />
          <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'hsl(174 72% 56%)' }}>Neural Insight</span>
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isImproving ? 'bg-emerald-500/15' : 'bg-amber-500/15'}`}>
              {isImproving ? <TrendingUp className="w-5 h-5 text-emerald-400" /> : <TrendingDown className="w-5 h-5 text-amber-400" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {isImproving ? `Improved by ${trend} points` : `Dropped by ${Math.abs(trend)} points`}
                {data.trend.actual[0] > 0 && <span className="text-muted-foreground font-normal"> — from {data.trend.actual[0]}% to {data.actual}%</span>}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">in {data.name}</p>
            </div>
          </div>

          {data.biggestUnlock.topic && data.biggestUnlock.topic !== 'No data yet' && (
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-primary/15">
                <Target className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Biggest opportunity: <span className="text-primary">{data.biggestUnlock.topic}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Currently at {data.biggestUnlock.from}% — potential to reach {data.biggestUnlock.to}%
                </p>
                <div className="mt-2 h-2 rounded-full bg-muted/20 overflow-hidden max-w-[200px]">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${data.biggestUnlock.to}%` }} transition={{ duration: 1, delay: 0.3 }}
                    className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-400" />
                </div>
              </div>
            </div>
          )}

          {data.strongest.topic && data.strongest.topic !== 'No data yet' && (
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-emerald-500/15">
                <Zap className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Strongest area: <span className="text-emerald-400">{data.strongest.topic}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Scoring {data.strongest.score}% — keep it up!</p>
              </div>
            </div>
          )}

          <p className="text-sm leading-relaxed text-muted-foreground pt-2 border-t border-border/10">
            {data.actual > 0
              ? `You're building something real here. ${data.biggestUnlock.topic && data.biggestUnlock.topic !== 'No data yet' ? `Focus on ${data.biggestUnlock.topic} for maximum growth.` : 'Keep practicing to unlock your full potential.'} The compound effect of daily practice is working in your favor.`
              : 'Start taking tests to unlock personalized insights.'}
          </p>
        </div>
      </div>
    </motion.div>
  );
};
