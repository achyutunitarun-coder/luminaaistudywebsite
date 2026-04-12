import { motion } from 'framer-motion';
import { TrendingUp, Sparkles, Trophy, Unlock } from 'lucide-react';
import type { SubjectData } from '@/hooks/usePerformanceData';

type Props = { data: SubjectData; index: number };

export const StatCards = ({ data, index }: Props) => {
  const cards = [
    {
      label: 'YOUR SCORE',
      value: `${data.actual}%`,
      sub: `Up from ${data.trend.actual[0]}%`,
      icon: TrendingUp,
      color: '#2dd4bf',
    },
    {
      label: 'PEAK POTENTIAL',
      value: `${data.potential}%`,
      sub: `+${data.potential - data.actual} marks within reach`,
      icon: Sparkles,
      color: '#a855f7',
    },
    {
      label: 'STRONGEST TOPIC',
      value: data.strongest.topic,
      sub: `${data.strongest.score}% mastery`,
      icon: Trophy,
      color: '#fbbf24',
    },
    {
      label: 'BIGGEST UNLOCK',
      value: data.biggestUnlock.topic,
      sub: `${data.biggestUnlock.from}% → ${data.biggestUnlock.to}% possible`,
      icon: Unlock,
      color: '#60a5fa',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((c, i) => (
        <motion.div
          key={c.label}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 + i * 0.05, ease: [0.25, 0.1, 0.25, 1] }}
          className="rounded-[14px] p-4"
          style={{
            background: '#111827',
            border: '0.5px solid rgba(255,255,255,0.07)',
          }}
        >
          <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: '#64748b' }}>{c.label}</p>
          <div className="flex items-center gap-2 mt-2">
            <c.icon className="w-4 h-4 flex-shrink-0" style={{ color: c.color }} />
            <span className="text-[20px] font-bold truncate" style={{ color: c.color }}>{c.value}</span>
          </div>
          <p className="text-[11px] mt-1" style={{ color: '#64748b' }}>{c.sub}</p>
        </motion.div>
      ))}
    </div>
  );
};
