import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Dna, Brain, TrendingDown, TrendingUp, AlertTriangle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';

const ERROR_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  CONCEPTUAL: { bg: 'bg-destructive/15', text: 'text-destructive', label: 'Conceptual' },
  APPLICATION: { bg: 'bg-warning/15', text: 'text-warning', label: 'Application' },
  CARELESS: { bg: 'bg-primary/15', text: 'text-primary', label: 'Careless' },
  MEMORY: { bg: 'bg-secondary/15', text: 'text-secondary', label: 'Memory' },
  TIME_PRESSURE: { bg: 'bg-blue-500/15', text: 'text-blue-400', label: 'Time Pressure' },
  MISREAD: { bg: 'bg-amber-500/15', text: 'text-amber-400', label: 'Misread' },
};

const MistakeDNA = () => {
  const { user } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: tags, isLoading } = useQuery({
    queryKey: ['mistake-tags', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('mistake_tags')
        .select('*, question_responses(*)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(100) as any;
      return data || [];
    },
    enabled: !!user,
  });

  const breakdown = useMemo(() => {
    if (!tags?.length) return {};
    const counts: Record<string, number> = {};
    tags.forEach((t: any) => {
      counts[t.error_type] = (counts[t.error_type] || 0) + 1;
    });
    return counts;
  }, [tags]);

  const total = Object.values(breakdown).reduce((s, c) => s + c, 0);

  const subjectBreakdown = useMemo(() => {
    if (!tags?.length) return {};
    const map: Record<string, Record<string, number>> = {};
    tags.forEach((t: any) => {
      const sub = t.subject || 'General';
      if (!map[sub]) map[sub] = {};
      map[sub][t.error_type] = (map[sub][t.error_type] || 0) + 1;
    });
    return map;
  }, [tags]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-destructive/30 to-warning/20 flex items-center justify-center">
            <Dna className="w-6 h-6 text-destructive" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Mistake DNA</h1>
            <p className="text-sm text-muted-foreground">
              {total > 0 ? `Based on ${total} wrong answers` : 'Complete tests to see your mistake patterns'}
            </p>
          </div>
        </div>
      </motion.div>

      {total === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="rounded-2xl p-10 text-center"
          style={{ background: 'hsl(230 20% 11% / 0.5)', border: '1px solid hsl(0 0% 100% / 0.05)' }}
        >
          <Dna className="w-12 h-12 mx-auto mb-3 text-muted-foreground/20" />
          <p className="text-muted-foreground text-sm">Complete your first test to see your mistake fingerprint.</p>
          <Button onClick={() => window.location.href = '/tests'} className="mt-4 gradient-primary text-primary-foreground rounded-xl">
            Take a Test
          </Button>
        </motion.div>
      ) : (
        <>
          {/* Fingerprint Bar */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="rounded-2xl p-6"
            style={{ background: 'hsl(230 20% 11% / 0.5)', border: '1px solid hsl(0 0% 100% / 0.05)' }}
          >
            <h2 className="text-sm font-semibold text-foreground mb-4">Your Mistake Fingerprint</h2>
            <div className="h-8 rounded-full overflow-hidden flex">
              {Object.entries(breakdown).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
                const pct = (count / total) * 100;
                const colors = ERROR_COLORS[type] || ERROR_COLORS.CONCEPTUAL;
                return (
                  <motion.div
                    key={type}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8 }}
                    className={`h-full ${colors.bg} flex items-center justify-center`}
                    title={`${colors.label}: ${count}`}
                  >
                    {pct > 12 && <span className={`text-[10px] font-bold ${colors.text}`}>{Math.round(pct)}%</span>}
                  </motion.div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {Object.entries(breakdown).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
                const colors = ERROR_COLORS[type] || ERROR_COLORS.CONCEPTUAL;
                return (
                  <span key={type} className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${colors.bg} ${colors.text}`}>
                    {colors.label}: {count}
                  </span>
                );
              })}
            </div>
          </motion.div>

          {/* Subject Breakdown */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="rounded-2xl p-6"
            style={{ background: 'hsl(230 20% 11% / 0.5)', border: '1px solid hsl(0 0% 100% / 0.05)' }}
          >
            <h2 className="text-sm font-semibold text-foreground mb-4">By Subject</h2>
            <div className="space-y-3">
              {Object.entries(subjectBreakdown).map(([subject, types]) => (
                <div key={subject}>
                  <p className="text-xs font-medium text-foreground mb-1.5">{subject}</p>
                  <div className="flex gap-1.5">
                    {Object.entries(types).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
                      const colors = ERROR_COLORS[type] || ERROR_COLORS.CONCEPTUAL;
                      return (
                        <span key={type} className={`px-2 py-0.5 rounded-full text-[10px] ${colors.bg} ${colors.text}`}>
                          {colors.label} {count}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Recent Mistakes */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="rounded-2xl p-6"
            style={{ background: 'hsl(230 20% 11% / 0.5)', border: '1px solid hsl(0 0% 100% / 0.05)' }}
          >
            <h2 className="text-sm font-semibold text-foreground mb-4">Recent Mistakes</h2>
            <div className="space-y-2">
              {tags?.slice(0, 15).map((tag: any) => {
                const colors = ERROR_COLORS[tag.error_type] || ERROR_COLORS.CONCEPTUAL;
                const expanded = expandedId === tag.id;
                return (
                  <div key={tag.id}
                    className="rounded-xl p-3 cursor-pointer hover:bg-muted/10 transition-colors"
                    style={{ border: '1px solid hsl(0 0% 100% / 0.03)' }}
                    onClick={() => setExpandedId(expanded ? null : tag.id)}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${colors.bg} ${colors.text}`}>
                        {colors.label}
                      </span>
                      <span className="text-xs text-muted-foreground truncate flex-1">
                        {tag.topic || tag.subject || 'Unknown topic'}
                      </span>
                      {expanded ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
                    </div>
                    {expanded && tag.question_responses && (
                      <div className="mt-3 space-y-2 text-xs">
                        <p className="text-foreground/80"><strong>Q:</strong> {tag.question_responses.question_text}</p>
                        <p className="text-destructive"><strong>Your answer:</strong> {tag.question_responses.student_answer}</p>
                        <p className="text-success"><strong>Correct:</strong> {tag.question_responses.correct_answer}</p>
                        <p className="text-muted-foreground italic">{tag.ai_explanation}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
};

export default MistakeDNA;
