import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const WeaknessRadar = () => {
  const { user } = useAuth();

  const { data: tests } = useQuery({
    queryKey: ['tests', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('tests').select('*').eq('status', 'completed').order('created_at', { ascending: false }).limit(10);
      return data || [];
    },
    enabled: !!user,
  });

  const avgScore = tests && tests.length > 0
    ? (tests.reduce((acc, t) => acc + (Number(t.score) || 0), 0) / tests.length)
    : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-2xl font-display font-bold text-foreground">AI Weakness Radar</h1>
        <p className="text-muted-foreground text-sm">Track your performance and improve weak areas</p>
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
          <p className="text-2xl font-display font-bold text-foreground">—</p>
          <p className="text-sm text-muted-foreground">Weak Topics</p>
        </motion.div>
      </div>

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
    </div>
  );
};

export default WeaknessRadar;
