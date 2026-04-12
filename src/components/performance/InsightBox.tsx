import { motion } from 'framer-motion';
import { Brain } from 'lucide-react';
import type { SubjectData } from '@/hooks/usePerformanceData';

type Props = { data: SubjectData };

export const InsightBox = ({ data }: Props) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    className="rounded-[14px] p-5 relative overflow-hidden"
    style={{
      background: 'linear-gradient(135deg, rgba(15,31,61,0.6), rgba(26,13,46,0.4))',
      borderLeft: '3px solid #2dd4bf',
      border: '0.5px solid rgba(45,212,191,0.15)',
    }}
  >
    <div className="absolute top-0 right-0 w-[200px] h-[200px] rounded-full opacity-[0.06]" style={{ background: 'radial-gradient(circle, #2dd4bf, transparent)' }} />
    <div className="relative z-10">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[99px] mb-3" style={{ background: 'rgba(45,212,191,0.1)', border: '0.5px solid rgba(45,212,191,0.2)' }}>
        <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#2dd4bf' }} />
        <Brain className="w-3.5 h-3.5" style={{ color: '#2dd4bf' }} />
        <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#2dd4bf' }}>Neural Insight</span>
      </div>
      <p className="text-[13px] leading-relaxed" style={{ color: '#f1f5f9' }}>
        You've improved from {data.trend.actual[0]}% to {data.actual}% in {data.name} — that's {data.actual - data.trend.actual[0]} points of real growth.
        Your biggest opportunity right now is <span style={{ color: '#2dd4bf', fontWeight: 600 }}>{data.biggestUnlock.topic}</span>,
        where consistent practice could take you from {data.biggestUnlock.from}% to {data.biggestUnlock.to}%.
        You're building something real here. Keep going — the compound effect of daily practice is working in your favor.
      </p>
    </div>
  </motion.div>
);
