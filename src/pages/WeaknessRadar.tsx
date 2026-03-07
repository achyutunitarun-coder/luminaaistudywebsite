import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, AlertTriangle, Brain, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type DeepAnalysis = {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  score_breakdown: { area: string; score: number; comment: string }[];
};

const WeaknessRadar = () => {
  const { user } = useAuth();
  const [analyzing, setAnalyzing] = useState(false);
  const [deepAnalysis, setDeepAnalysis] = useState<DeepAnalysis | null>(null);

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

  // Group mistakes by topic
  const mistakesByTopic = mistakes?.reduce((acc, m) => {
    acc[m.topic] = (acc[m.topic] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const topMistakes = Object.entries(mistakesByTopic).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const runDeepAnalysis = async () => {
    setAnalyzing(true);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/session-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          sessionData: {
            tests_completed: tests?.length || 0,
            average_score: avgScore,
            top_mistakes: topMistakes,
            test_subjects: tests?.map(t => ({ subject: t.subject, score: t.score })),
          },
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setDeepAnalysis(data);
      }
    } catch {
      toast.error('Failed to run analysis');
    }
    setAnalyzing(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-2xl font-display font-bold text-foreground">AI Weakness Radar</h1>
        <p className="text-muted-foreground text-sm">Track your performance and get AI-powered deep analysis</p>
      </motion.div>

      {/* Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-5">
          <BarChart3 className="w-8 h-8 text-primary mb-2" />
          <p className="text-2xl font-display font-bold text-foreground">{tests?.length || 0}</p>
          <p className="text-sm text-muted-foreground">Tests Completed</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass rounded-xl p-5">
          <TrendingUp className="w-8 h-8 text-success mb-2" />
          <p className="text-2xl font-display font-bold text-foreground">{avgScore.toFixed(0)}%</p>
          <p className="text-sm text-muted-foreground">Average Score</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass rounded-xl p-5">
          <AlertTriangle className="w-8 h-8 text-warning mb-2" />
          <p className="text-2xl font-display font-bold text-foreground">{topMistakes.length}</p>
          <p className="text-sm text-muted-foreground">Weak Topics</p>
        </motion.div>
      </div>

      {/* Mistake Tracker */}
      {topMistakes.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass rounded-xl p-6">
          <h2 className="text-lg font-display font-semibold text-foreground mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" /> Mistake Patterns
          </h2>
          <div className="space-y-3">
            {topMistakes.map(([topic, count], i) => (
              <div key={topic} className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground w-40 truncate">{topic}</span>
                <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((count / (topMistakes[0]?.[1] || 1)) * 100, 100)}%` }}
                    transition={{ delay: i * 0.1 }}
                    className="h-full rounded-full bg-warning"
                  />
                </div>
                <span className="text-sm font-semibold text-foreground w-10 text-right">{count}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Performance by Subject */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass rounded-xl p-6">
        <h2 className="text-lg font-display font-semibold text-foreground mb-4">Performance Breakdown</h2>
        {tests && tests.length > 0 ? (
          <div className="space-y-4">
            {tests.map((test, i) => (
              <div key={test.id} className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground w-32 truncate">{test.subject || test.title}</span>
                <div className="flex-1 h-4 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Number(test.score) || 0}%` }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                    className={`h-full rounded-full ${
                      (Number(test.score) || 0) >= 70 ? 'bg-success' : (Number(test.score) || 0) >= 50 ? 'bg-warning' : 'bg-destructive'
                    }`}
                  />
                </div>
                <span className="text-sm font-semibold text-foreground w-12 text-right">{Number(test.score)?.toFixed(0) || 0}%</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-20" />
            <p>Complete some tests to see your performance analysis</p>
          </div>
        )}
      </motion.div>

      {/* Deep AI Analysis */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-display font-semibold text-foreground flex items-center gap-2">
            <Brain className="w-5 h-5 text-secondary" /> Deep AI Analysis
          </h2>
          <Button onClick={runDeepAnalysis} disabled={analyzing || !tests?.length} size="sm" className="gradient-primary text-primary-foreground">
            {analyzing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Brain className="w-4 h-4 mr-1" />}
            Analyze
          </Button>
        </div>

        {deepAnalysis ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{deepAnalysis.summary}</p>

            {deepAnalysis.score_breakdown?.map((s, i) => (
              <div key={i}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-foreground font-medium">{s.area}</span>
                  <span className="text-primary font-semibold">{s.score}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${s.score}%` }} className={`h-full rounded-full ${s.score >= 70 ? 'bg-success' : s.score >= 50 ? 'bg-warning' : 'bg-destructive'}`} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{s.comment}</p>
              </div>
            ))}

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <h3 className="text-xs font-semibold text-success mb-2">💪 Strengths</h3>
                {deepAnalysis.strengths?.map((s, i) => <p key={i} className="text-xs text-muted-foreground mb-1">• {s}</p>)}
              </div>
              <div>
                <h3 className="text-xs font-semibold text-warning mb-2">📋 Weaknesses</h3>
                {deepAnalysis.weaknesses?.map((w, i) => <p key={i} className="text-xs text-muted-foreground mb-1">• {w}</p>)}
              </div>
            </div>

            {deepAnalysis.recommendations?.length > 0 && (
              <div className="border-t border-border/50 pt-4">
                <h3 className="text-xs font-semibold text-primary mb-2">🎯 Recommendations</h3>
                {deepAnalysis.recommendations.map((r, i) => <p key={i} className="text-xs text-muted-foreground mb-1">• {r}</p>)}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">Click "Analyze" to get a deep AI analysis of your performance</p>
        )}
      </motion.div>
    </div>
  );
};

export default WeaknessRadar;
