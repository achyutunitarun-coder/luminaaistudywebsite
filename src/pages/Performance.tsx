import { useState } from 'react';
import { motion } from 'framer-motion';
import { Brain, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '@/hooks/useProfile';
import { performanceData } from '@/data/performanceData';
import { SubjectTabs } from '@/components/performance/SubjectTabs';
import { StatCards } from '@/components/performance/StatCards';
import { TopicTable } from '@/components/performance/TopicTable';
import { ToolGrid } from '@/components/performance/ToolGrid';
import { TrendChart } from '@/components/performance/TrendChart';
import { InsightBox } from '@/components/performance/InsightBox';

const subjects = ['overall', 'physics', 'chemistry', 'mathematics'];

const Performance = () => {
  const [active, setActive] = useState('overall');
  const data = performanceData[active];
  const navigate = useNavigate();
  const { profile } = useProfile();
  const userName = profile?.display_name?.split(' ')[0] || 'there';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="rounded-[14px] p-6 md:p-8 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #0f1f3d 0%, #0d1a2e 50%, #1a0d2e 100%)',
          border: '0.5px solid rgba(45,212,191,0.2)',
          boxShadow: '0 0 40px rgba(45,212,191,0.06)',
        }}
      >
        <div className="absolute top-0 right-0 w-[300px] h-[300px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(45,212,191,0.08), transparent 70%)' }} />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[99px] mb-4" style={{ background: 'rgba(45,212,191,0.1)', border: '0.5px solid rgba(45,212,191,0.2)' }}>
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#2dd4bf' }} />
            <Brain className="w-3.5 h-3.5" style={{ color: '#2dd4bf' }} />
            <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#2dd4bf' }}>Neural Insight</span>
          </div>
          <h1 className="text-2xl font-bold mb-4" style={{ color: '#f1f5f9' }}>Your Growth Story, {userName}</h1>
          <div className="space-y-2 max-w-xl">
            <p className="text-[13px]"><span style={{ color: '#64748b' }}>Observation: </span><span style={{ color: '#f1f5f9' }}>{data.insight.observation}</span></p>
            <p className="text-[13px]"><span style={{ color: '#64748b' }}>Interpretation: </span><span style={{ color: '#f1f5f9' }}>{data.insight.interpretation}</span></p>
            <p className="text-[13px]"><span style={{ color: '#64748b' }}>Action: </span><span style={{ color: '#2dd4bf', fontWeight: 500, cursor: 'pointer' }} onClick={() => navigate(data.insight.action.url)}>{data.insight.action.text}</span></p>
          </div>
          <Button
            onClick={() => navigate(data.insight.action.url)}
            size="sm"
            className="mt-4 rounded-[10px] text-[13px] font-semibold px-5"
            style={{ background: 'linear-gradient(135deg, #2dd4bf, #0ea5e9)', color: '#0a0c15' }}
          >
            {data.insight.action.label} <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
      </motion.div>

      {/* Tabs */}
      <SubjectTabs subjects={subjects} active={active} onChange={setActive} />

      {/* Stats */}
      <StatCards data={data} index={0} />

      {/* Topic Table */}
      <div>
        <h2 className="text-[15px] font-semibold mb-3" style={{ color: '#f1f5f9' }}>Topic Progress</h2>
        <TopicTable topics={data.topics} />
      </div>

      {/* Tools Grid */}
      <div>
        <h2 className="text-[15px] font-semibold mb-3" style={{ color: '#f1f5f9' }}>Study Tools Impact</h2>
        <ToolGrid />
      </div>

      {/* Trend Chart */}
      <TrendChart data={data} />

      {/* Insight Box */}
      <InsightBox data={data} />
    </div>
  );
};

export default Performance;
