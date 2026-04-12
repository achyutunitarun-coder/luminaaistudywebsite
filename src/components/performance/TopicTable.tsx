import { motion } from 'framer-motion';
import type { TopicData } from '@/data/performanceData';

const statusConfig = {
  strong: { label: 'Strong', bg: 'rgba(45,212,191,0.12)', color: '#2dd4bf' },
  improving: { label: 'Improving', bg: 'rgba(96,165,250,0.12)', color: '#60a5fa' },
  'big-unlock': { label: 'Big unlock', bg: 'rgba(168,85,247,0.12)', color: '#a855f7' },
  'needs-focus': { label: 'Needs focus', bg: 'rgba(251,191,36,0.12)', color: '#fbbf24' },
};

type Props = { topics: TopicData[] };

export const TopicTable = ({ topics }: Props) => (
  <div className="rounded-[14px] overflow-hidden" style={{ border: '0.5px solid rgba(255,255,255,0.07)' }}>
    <table className="w-full text-[13px]">
      <thead>
        <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
          {['Topic', 'Before', 'Now', 'Your Ceiling', 'Status'].map(h => (
            <th key={h} className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-medium" style={{ color: '#64748b' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {topics.map((t, i) => {
          const s = statusConfig[t.status];
          const pct = Math.round((t.now / t.ceiling) * 100);
          return (
            <motion.tr
              key={t.name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 * i }}
              className="border-t"
              style={{ borderColor: 'rgba(255,255,255,0.05)' }}
            >
              <td className="px-4 py-3 font-medium" style={{ color: '#f1f5f9' }}>{t.name}</td>
              <td className="px-4 py-3" style={{ color: '#64748b' }}>{t.before}%</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span style={{ color: '#f1f5f9' }} className="font-semibold tabular-nums">{t.now}%</span>
                  <div className="flex-1 h-1.5 rounded-full max-w-[80px]" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, delay: 0.1 * i }}
                      className="h-full rounded-full"
                      style={{ background: s.color }}
                    />
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 font-semibold" style={{ color: '#2dd4bf' }}>{t.ceiling}%</td>
              <td className="px-4 py-3">
                <span className="px-2 py-0.5 rounded-[99px] text-[11px] font-medium" style={{ background: s.bg, color: s.color }}>
                  {s.label}
                </span>
              </td>
            </motion.tr>
          );
        })}
      </tbody>
    </table>
  </div>
);
