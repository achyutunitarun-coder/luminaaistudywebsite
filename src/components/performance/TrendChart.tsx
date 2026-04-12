import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { SubjectData } from '@/data/performanceData';

type Props = { data: SubjectData };

export const TrendChart = ({ data }: Props) => {
  const chartData = data.trend.actual.map((v, i) => ({
    name: `Test ${i + 1}`,
    actual: v,
    projected: data.trend.projected[i],
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[14px] p-5"
      style={{ background: '#111827', border: '0.5px solid rgba(255,255,255,0.07)' }}
    >
      <h3 className="text-[13px] font-semibold mb-4" style={{ color: '#f1f5f9' }}>Score Trend</h3>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                background: '#151d2e',
                border: '0.5px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                fontSize: 12,
                color: '#f1f5f9',
              }}
            />
            <Line type="monotone" dataKey="actual" stroke="#fbbf24" strokeWidth={2} dot={{ r: 4, fill: '#fbbf24' }} />
            <Line type="monotone" dataKey="projected" stroke="#2dd4bf" strokeWidth={2} strokeDasharray="6 4" dot={{ r: 4, fill: '#2dd4bf', strokeDasharray: '0' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-5 mt-3 justify-center">
        <div className="flex items-center gap-2 text-[11px]">
          <div className="w-3 h-3 rounded-sm" style={{ background: '#fbbf24' }} />
          <span style={{ color: '#64748b' }}>Your actual</span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <div className="w-3 h-3 rounded-sm" style={{ background: '#2dd4bf' }} />
          <span style={{ color: '#64748b' }}>With Lumina tools</span>
        </div>
      </div>
    </motion.div>
  );
};
