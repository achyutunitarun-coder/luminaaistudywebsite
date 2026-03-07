import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingUp, TrendingDown, Star, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

type Report = {
  headline: string;
  total_study_minutes: number;
  total_study_hours: number;
  average_test_score: number;
  tests_taken: number;
  xp_earned: number;
  strengths: { topic: string; detail: string }[];
  weaknesses: { topic: string; detail: string }[];
  recommendations: string[];
  overall_grade: string;
};

const gradeColors: Record<string, string> = {
  A: 'text-success',
  B: 'text-primary',
  C: 'text-warning',
  D: 'text-destructive',
  F: 'text-destructive',
};

export const MonthlyReportModal = () => {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const today = new Date();
    // Show on the 1st of the month
    if (today.getDate() !== 1) return;

    const key = `monthly_report_${today.getFullYear()}_${today.getMonth()}`;
    if (localStorage.getItem(key)) return;

    generateReport(key);
  }, [user]);

  const generateReport = async (key: string) => {
    if (!user) return;
    setLoading(true);
    setShow(true);

    try {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const monthStart = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1).toISOString();
      const monthEnd = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0).toISOString();

      const [sessionsRes, testsRes, mistakesRes, profileRes] = await Promise.all([
        supabase.from('study_sessions').select('duration_minutes').eq('user_id', user.id).gte('started_at', monthStart).lte('started_at', monthEnd),
        supabase.from('tests').select('score, subject, total_questions, correct_answers').eq('user_id', user.id).gte('created_at', monthStart).lte('created_at', monthEnd),
        supabase.from('mistakes').select('topic, subject, mistake_type').eq('user_id', user.id).gte('created_at', monthStart).lte('created_at', monthEnd),
        supabase.from('profiles').select('xp, level').eq('user_id', user.id).single(),
      ]);

      const totalMins = sessionsRes.data?.reduce((s, r) => s + (r.duration_minutes || 0), 0) || 0;
      const tests = testsRes.data || [];
      const avgScore = tests.length ? tests.reduce((s, t) => s + (t.score || 0), 0) / tests.length : 0;

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/monthly-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          userData: {
            totalStudyMinutes: totalMins,
            tests: tests.map(t => ({ score: t.score, subject: t.subject, total: t.total_questions, correct: t.correct_answers })),
            mistakes: mistakesRes.data || [],
            xp: profileRes.data?.xp || 0,
            level: profileRes.data?.level || 1,
          },
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        setReport(data);
        localStorage.setItem(key, 'shown');
      }
    } catch (e) {
      console.error('Monthly report error:', e);
    }
    setLoading(false);
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="glass rounded-3xl p-8 max-w-lg w-full max-h-[85vh] overflow-auto relative"
        >
          <button onClick={() => setShow(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>

          {loading && !report ? (
            <div className="text-center py-16">
              <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Generating your monthly report...</p>
            </div>
          ) : report ? (
            <div className="space-y-6">
              <div className="text-center">
                <Award className="w-12 h-12 text-xp mx-auto mb-3" />
                <h2 className="text-2xl font-display font-bold text-foreground">{report.headline}</h2>
                <p className="text-sm text-muted-foreground mt-1">Monthly Study Report</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="glass rounded-xl p-4 text-center">
                  <p className="text-2xl font-display font-bold text-foreground">{report.total_study_hours}h</p>
                  <p className="text-[10px] text-muted-foreground">Studied</p>
                </div>
                <div className="glass rounded-xl p-4 text-center">
                  <p className="text-2xl font-display font-bold text-foreground">{Math.round(report.average_test_score)}%</p>
                  <p className="text-[10px] text-muted-foreground">Avg Score</p>
                </div>
                <div className="glass rounded-xl p-4 text-center">
                  <p className={`text-2xl font-display font-bold ${gradeColors[report.overall_grade] || 'text-foreground'}`}>{report.overall_grade}</p>
                  <p className="text-[10px] text-muted-foreground">Grade</p>
                </div>
              </div>

              {report.strengths?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-success flex items-center gap-1 mb-2">
                    <TrendingUp className="w-4 h-4" /> Strengths
                  </h3>
                  {report.strengths.map((s, i) => (
                    <div key={i} className="mb-2">
                      <p className="text-sm font-medium text-foreground">{s.topic}</p>
                      <p className="text-xs text-muted-foreground">{s.detail}</p>
                    </div>
                  ))}
                </div>
              )}

              {report.weaknesses?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-warning flex items-center gap-1 mb-2">
                    <TrendingDown className="w-4 h-4" /> Areas to Improve
                  </h3>
                  {report.weaknesses.map((w, i) => (
                    <div key={i} className="mb-2">
                      <p className="text-sm font-medium text-foreground">{w.topic}</p>
                      <p className="text-xs text-muted-foreground">{w.detail}</p>
                    </div>
                  ))}
                </div>
              )}

              {report.recommendations?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-primary mb-2">💡 Recommendations</h3>
                  {report.recommendations.map((r, i) => (
                    <p key={i} className="text-xs text-muted-foreground mb-1">• {r}</p>
                  ))}
                </div>
              )}

              <Button onClick={() => setShow(false)} className="w-full gradient-primary text-primary-foreground">
                Got it!
              </Button>
            </div>
          ) : null}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
