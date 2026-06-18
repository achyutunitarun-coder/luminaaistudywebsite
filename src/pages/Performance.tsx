import { useState } from 'react';
import { motion } from 'framer-motion';
import { Brain, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '@/hooks/useProfile';
import { usePerformanceData } from '@/hooks/usePerformanceData';
import { SubjectTabs } from '@/components/performance/SubjectTabs';
import { StatCards } from '@/components/performance/StatCards';
import { TopicTable } from '@/components/performance/TopicTable';
import { ToolGrid } from '@/components/performance/ToolGrid';
import { TrendChart } from '@/components/performance/TrendChart';
import { InsightBox } from '@/components/performance/InsightBox';

const Performance = () => {
  const [active, setActive] = useState('overall');
  const navigate = useNavigate();
  const { profile } = useProfile();
  const rawName = profile?.display_name?.split(' ')[0]?.trim() || '';
  const userName = !rawName || /^(lumina|user|student|guest|test|admin|scholar)$/i.test(rawName) ? 'scholar' : rawName;
  const { subjects, performanceData, isLoading, hasData } = usePerformanceData();

  const data = performanceData[active];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasData || !data) {
    return (
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="card rounded-2xl p-8 text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(99,102,241,0.05))',
          }}
        >
          <Brain className="w-12 h-12 mx-auto mb-4 text-primary" />
          <h2 className="text-xl font-bold mb-2 text-foreground">
            Your Growth Story Starts Here, {userName}
          </h2>
          <p className="text-[13px] mb-6 max-w-md mx-auto text-muted-foreground">
            Take a test, complete a guided lesson, or start a study session to unlock your personalized performance analytics.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button
              onClick={() => navigate('/tests')}
              size="sm"
              className="btn-primary px-5"
            >
              Take a Test <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
            <Button
              onClick={() => navigate('/guided-lesson')}
              variant="outline"
              size="sm"
              className="rounded-xl text-[13px] font-semibold px-5"
            >
              Start a Lesson
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="card rounded-2xl p-6 md:p-8 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(99,102,241,0.05))',
        }}
      >
        <div className="absolute top-0 right-0 w-[300px] h-[300px] rounded-full pointer-events-none bg-primary/[0.06] blur-[80px]" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4 bg-primary/10 border border-primary/20">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse bg-primary" />
            <Brain className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-primary">Neural Insight</span>
          </div>
          <h1 className="text-2xl font-bold mb-4 text-foreground">Your Growth Story, {userName}</h1>
          <div className="space-y-2 max-w-xl">
            <p className="text-[13px]"><span className="text-muted-foreground">Observation: </span><span className="text-foreground">{data.insight.observation}</span></p>
            <p className="text-[13px]"><span className="text-muted-foreground">Interpretation: </span><span className="text-foreground">{data.insight.interpretation}</span></p>
            <p className="text-[13px]"><span className="text-muted-foreground">Action: </span><span className="text-primary font-medium cursor-pointer" onClick={() => navigate(data.insight.action.url)}>{data.insight.action.text}</span></p>
          </div>
          <Button
            onClick={() => navigate(data.insight.action.url)}
            size="sm"
            className="mt-4 btn-primary px-5"
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
      {data.topics.length > 0 && (
        <div>
          <h2 className="text-[15px] font-semibold mb-3 text-foreground">Topic Progress</h2>
          <TopicTable topics={data.topics} />
        </div>
      )}

      {/* Tools Grid */}
      <div>
        <h2 className="text-[15px] font-semibold mb-3 text-foreground">Study Tools Impact</h2>
        <ToolGrid />
      </div>

      {/* Trend Chart */}
      {data.trend.actual.some(v => v > 0) && <TrendChart data={data} />}

      {/* Insight Box */}
      <InsightBox data={data} />
    </div>
  );
};

export default Performance;
