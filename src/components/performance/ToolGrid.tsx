import { motion } from 'framer-motion';
import { Brain, Calendar, Target, Layers } from 'lucide-react';

const tools = [
  { name: 'Active Recall', impact: '+12%', status: 'in-use' as const, note: 'Used 3x this week', icon: Brain, color: '#2dd4bf' },
  { name: 'Spaced Repetition', impact: '+15%', status: 'free' as const, icon: Calendar, color: '#60a5fa' },
  { name: 'Retrieval Practice', impact: '+14%', status: 'free' as const, icon: Target, color: '#a855f7' },
  { name: 'Dual Coding', impact: '+11%', status: 'pro' as const, icon: Layers, color: '#fbbf24' },
];

export const ToolGrid = () => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
    {tools.map((t, i) => (
      <motion.div
        key={t.name}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 * i }}
        className="rounded-[14px] p-4 cursor-pointer hover:translate-y-[-2px] transition-transform"
        style={{
          background: '#111827',
          border: '0.5px solid rgba(255,255,255,0.07)',
        }}
      >
        <t.icon className="w-5 h-5 mb-2" style={{ color: t.color }} />
        <p className="text-[13px] font-semibold mb-1" style={{ color: '#f1f5f9' }}>{t.name}</p>
        <p className="text-[22px] font-bold mb-2" style={{ color: '#2dd4bf' }}>{t.impact}</p>
        {t.status === 'in-use' && (
          <p className="text-[11px]" style={{ color: '#2dd4bf' }}>✓ In use — {t.note}</p>
        )}
        {t.status === 'free' && (
          <p className="text-[11px]" style={{ color: '#a855f7' }}>→ Try it today</p>
        )}
        {t.status === 'pro' && (
          <p className="text-[11px]" style={{ color: '#fbbf24' }}>→ Unlock with Pro+</p>
        )}
      </motion.div>
    ))}
  </div>
);
