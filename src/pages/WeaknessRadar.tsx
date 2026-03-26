import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, AlertTriangle, Brain, Loader2, GitBranch, Target, BookOpen, Zap, CheckCircle2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { FlowChart, type FlowNode, type FlowEdge } from '@/components/FlowChart';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { UpgradePopup } from '@/components/UpgradePopup';

type DeepAnalysis = {
  summary: string;
  strengths: { topic: string; subject: string; detail: string; confidence_level: string; maintenance_tip: string }[];
  weaknesses: { topic: string; subject: string; root_cause: string; severity: string; fix_suggestion: string; prerequisite_gaps: string }[];
  recommendations: { action: string; priority: string; estimated_time: string; subjects_to_cover: string; study_method: string }[];
  score_breakdown: { area: string; score: number; comment: string }[];
};

const WeaknessRadar = () => {
  const { user } = useAuth();
  const [analyzing, setAnalyzing] = useState(false);
  const [deepAnalysis, setDeepAnalysis] = useState<DeepAnalysis | null>(null);
  const [showFlow, setShowFlow] = useState(false);
  const { checkAndIncrement, showUpgrade, setShowUpgrade } = useUsageLimits();

  const { data: tests } = useQuery({
    queryKey: ['tests', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('tests').select('*').eq('status', 'completed').order('created_at', { ascending: false }).limit(10);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: mistakes } = useQuery({
    queryKey: ['mistakes', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('mistakes').select('*').order('created_at', { ascending: false }).limit(50);
      return data || [];
    },
    enabled: !!user,
  });

  const avgScore = tests && tests.length > 0
    ? (tests.reduce((acc, t) => acc + (Number(t.score) || 0), 0) / tests.length)
    : 0;

  const mistakesByTopic = mistakes?.reduce((acc, m) => {
    acc[m.topic] = (acc[m.topic] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const topMistakes = Object.entries(mistakesByTopic).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Build weakness flowchart
  const weaknessNodes: FlowNode[] = [
    { id: 'analyze', label: 'Take Tests', type: 'start', status: 'completed', icon: <BookOpen className="w-3 h-3" /> },
    { id: 'detect', label: 'Detect Weaknesses', type: 'process', status: topMistakes.length > 0 ? 'completed' : 'active', icon: <AlertTriangle className="w-3 h-3" /> },
    ...topMistakes.slice(0, 3).map(([topic], i) => ({
      id: `weak-${i}`,
      label: topic,
      type: 'decision' as const,
      status: 'active' as const,
      icon: <Target className="w-3 h-3" />,
      description: `${topMistakes[i][1]} mistakes`,
    })),
    { id: 'practice', label: 'Targeted Practice', type: 'process', status: 'upcoming', icon: <Zap className="w-3 h-3" /> },
    { id: 'master', label: 'Mastery', type: 'end', status: 'locked', icon: <CheckCircle2 className="w-3 h-3" /> },
  ];

  const weaknessEdges: FlowEdge[] = [
    { from: 'analyze', to: 'detect', animated: true },
    ...topMistakes.slice(0, 3).map((_, i) => ({
      from: 'detect',
      to: `weak-${i}`,
      animated: true,
    })),
    ...topMistakes.slice(0, 3).map((_, i) => ({
      from: `weak-${i}`,
      to: 'practice',
    })),
    { from: 'practice', to: 'master' },
  ];

  const runDeepAnalysis = async () => {
    const allowed = await checkAndIncrement('weakness_radar');
    if (!allowed) return;
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('session-analysis', {
        body: {
          userId: user?.id,
          sessionData: {
            tests_completed: tests?.length || 0,
            average_score: avgScore,
            top_mistakes: topMistakes,
            test_subjects: tests?.map(t => ({ subject: t.subject, score: t.score })),
          },
        },
      });

      if (error) {
        toast.error(error.message || 'Analysis failed. Try again.');
        return;
      }

      setDeepAnalysis(data as DeepAnalysis);
    } catch {
      toast.error('Failed to run analysis');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <>
    <UpgradePopup open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    <div className="max-w-4xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[hsl(var(--warning))] to-[hsl(var(--destructive))] flex items-center justify-center shadow-lg shadow-warning/20">
            <BarChart3 className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Weakness Radar</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Track performance and get AI-powered deep analysis</p>
          </div>
        </div>
      </motion.div>

      {/* Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { icon: BarChart3, value: tests?.length || 0, label: 'Tests Completed', color: 'text-primary' },
          { icon: TrendingUp, value: `${avgScore.toFixed(0)}%`, label: 'Average Score', color: 'text-success' },
          { icon: AlertTriangle, value: topMistakes.length, label: 'Weak Topics', color: 'text-warning' },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="rounded-2xl liquid-glass p-5"
          >
            <div className="relative z-10">
              <stat.icon className={`w-7 h-7 ${stat.color} mb-2`} />
              <p className="text-2xl font-display font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Weakness Flowchart */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-display font-semibold text-foreground flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-primary" /> Weakness Resolution Path
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFlow(!showFlow)}
            className="text-primary text-xs rounded-xl hover:bg-primary/8"
          >
            {showFlow ? 'Hide' : 'Show'} Flowchart
          </Button>
        </div>
        {showFlow && (
          <FlowChart
            nodes={weaknessNodes}
            edges={weaknessEdges}
            direction="vertical"
            className="h-[350px]"
          />
        )}
      </motion.div>

      {/* Mistake Patterns */}
      {topMistakes.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="rounded-2xl liquid-glass p-6"
        >
          <div className="relative z-10">
            <h2 className="text-base font-display font-semibold text-foreground mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" /> Mistake Patterns
            </h2>
            <div className="space-y-3">
              {topMistakes.map(([topic, count], i) => (
                <div key={topic} className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground w-36 truncate">{topic}</span>
                  <div className="flex-1 h-2.5 rounded-full bg-muted/20 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((count / (topMistakes[0]?.[1] || 1)) * 100, 100)}%` }}
                      transition={{ delay: i * 0.1, duration: 0.6 }}
                      className="h-full rounded-full bg-warning"
                    />
                  </div>
                  <span className="text-sm font-bold text-foreground w-8 text-right">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Performance Breakdown */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="rounded-2xl liquid-glass p-6"
      >
        <div className="relative z-10">
          <h2 className="text-base font-display font-semibold text-foreground mb-4">Performance Breakdown</h2>
          {tests && tests.length > 0 ? (
            <div className="space-y-3">
              {tests.map((test, i) => (
                <div key={test.id} className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground w-28 truncate">{test.subject || test.title}</span>
                  <div className="flex-1 h-3 rounded-full bg-muted/20 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Number(test.score) || 0}%` }}
                      transition={{ delay: i * 0.08, duration: 0.5 }}
                      className={`h-full rounded-full ${
                        (Number(test.score) || 0) >= 70 ? 'bg-success' : (Number(test.score) || 0) >= 50 ? 'bg-warning' : 'bg-destructive'
                      }`}
                    />
                  </div>
                  <span className="text-sm font-bold text-foreground w-10 text-right">{Number(test.score)?.toFixed(0) || 0}%</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-15" />
              <p className="text-sm">Complete some tests to see your performance</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Deep AI Analysis */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="rounded-2xl liquid-glass p-6"
      >
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-display font-semibold text-foreground flex items-center gap-2">
              <Brain className="w-4 h-4 text-secondary" /> Deep AI Analysis
            </h2>
            <Button onClick={runDeepAnalysis} disabled={analyzing || !tests?.length} size="sm" className="gradient-primary text-primary-foreground rounded-xl">
              {analyzing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Brain className="w-4 h-4 mr-1" />}
              Analyze
            </Button>
          </div>

          {deepAnalysis ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">{deepAnalysis.summary}</p>

              {deepAnalysis.score_breakdown?.map((s, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-foreground font-medium">{s.area}</span>
                    <span className={`font-bold ${s.score >= 70 ? 'text-success' : s.score >= 50 ? 'text-warning' : 'text-destructive'}`}>{s.score}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/20 overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${s.score}%` }} className={`h-full rounded-full ${s.score >= 70 ? 'bg-success' : s.score >= 50 ? 'bg-warning' : 'bg-destructive'}`} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{s.comment}</p>
                </div>
              ))}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <h3 className="text-xs font-bold text-success mb-2">💪 Strengths</h3>
                  {deepAnalysis.strengths?.map((s, i) => (
                    <div key={i} className="mb-2">
                      <p className="text-xs font-medium text-foreground">{s.topic} <span className="text-muted-foreground">({s.subject})</span></p>
                      <p className="text-xs text-muted-foreground">{s.detail}</p>
                      <p className="text-xs text-success/70 italic">{s.maintenance_tip}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-warning mb-2">📋 Weaknesses</h3>
                  {deepAnalysis.weaknesses?.map((w, i) => (
                    <div key={i} className="mb-2">
                      <p className="text-xs font-medium text-foreground">{w.topic} <span className={`text-xs ${w.severity === 'critical' ? 'text-destructive' : w.severity === 'moderate' ? 'text-warning' : 'text-muted-foreground'}`}>({w.severity})</span></p>
                      <p className="text-xs text-muted-foreground">{w.root_cause}</p>
                      <p className="text-xs text-primary/70">{w.fix_suggestion}</p>
                    </div>
                  ))}
                </div>
              </div>

              {deepAnalysis.recommendations?.length > 0 && (
                <div className="border-t border-border/20 pt-4">
                  <h3 className="text-xs font-bold text-primary mb-2">🎯 Recommendations</h3>
                  {deepAnalysis.recommendations.map((r, i) => (
                    <div key={i} className="mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${r.priority === 'high' ? 'bg-destructive/20 text-destructive' : r.priority === 'medium' ? 'bg-warning/20 text-warning' : 'bg-muted/20 text-muted-foreground'}`}>{r.priority}</span>
                        <span className="text-[10px] text-muted-foreground">{r.estimated_time} · {r.study_method}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{r.action}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Click "Analyze" to get a deep AI analysis</p>
          )}
        </div>
      </motion.div>
    </div>
    </>
  );
};

export default WeaknessRadar;