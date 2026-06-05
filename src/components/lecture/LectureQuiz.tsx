import { useState, useCallback } from 'react';
import { Loader2, ClipboardList, CheckCircle2, XCircle, RotateCcw, Sparkles, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';

interface Question { question: string; options: string[]; correct: number; explanation: string; }
interface Props { notes: string; onBeforeGenerate?: () => Promise<boolean>; }

const LectureQuiz = ({ notes, onBeforeGenerate }: Props) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showResults, setShowResults] = useState(false);

  const generate = useCallback(async () => {
    if (onBeforeGenerate) { const allowed = await onBeforeGenerate(); if (!allowed) return; }
    setLoading(true); setAnswers({}); setShowResults(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Please sign in to generate a quiz.');
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-lecture-tools`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ notes, type: 'quiz' }),
      });
      if (!resp.ok) throw new Error('Failed');
      const data = await resp.json();
      const match = (data.content || '').match(/\[[\s\S]*\]/);
      if (match) { const parsed = JSON.parse(match[0]); setQuestions(parsed); toast.success(`${parsed.length} questions generated!`); }
      else throw new Error('Invalid');
    } catch { toast.error('Failed to generate quiz'); }
    finally { setLoading(false); }
  }, [notes]);

  const score = Object.entries(answers).filter(([i, a]) => questions[Number(i)]?.correct === a).length;
  const pct = questions.length > 0 ? Math.round(score / questions.length * 100) : 0;

  if (!questions.length && !loading) {
    return (
      <div className="flex flex-col items-center py-14">
        <div className="relative mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[hsl(var(--primary)/0.15)] to-[hsl(var(--secondary)/0.1)] flex items-center justify-center">
            <ClipboardList className="w-8 h-8 text-primary/60" />
          </div>
          <Sparkles className="absolute -top-1 -right-1 w-5 h-5 text-primary animate-pulse" />
        </div>
        <h3 className="text-xl font-display font-bold text-foreground mb-1.5">Generate Quiz</h3>
        <p className="text-muted-foreground text-sm mb-6 text-center max-w-sm">Test your understanding with auto-generated MCQs.</p>
        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
          <Button onClick={generate} disabled={!notes} className="h-12 px-8 rounded-2xl bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary)/0.85)] shadow-lg shadow-primary/20">
            <ClipboardList className="w-4 h-4 mr-2" /> Generate Quiz
          </Button>
        </motion.div>
        {!notes && <p className="text-xs text-muted-foreground mt-3">Generate notes first</p>}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center py-16 gap-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-muted-foreground text-sm">Generating quiz questions...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
      {showResults && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-2xl p-5 flex items-center justify-between border ${
            pct >= 80 ? 'bg-green-500/10 border-green-500/20' : pct >= 50 ? 'bg-primary/10 border-primary/20' : 'bg-destructive/10 border-destructive/20'
          }`}
        >
          <div className="flex items-center gap-3">
            <Trophy className={`w-6 h-6 ${pct >= 80 ? 'text-green-500' : pct >= 50 ? 'text-primary' : 'text-destructive'}`} />
            <div>
              <span className="text-foreground font-display font-bold text-lg">
                {score}/{questions.length}
              </span>
              <span className="text-muted-foreground text-sm ml-2">({pct}%)</span>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={generate} className="rounded-xl">
            <RotateCcw className="w-4 h-4 mr-1.5" /> New Quiz
          </Button>
        </motion.div>
      )}

      {questions.map((q, qi) => (
        <motion.div
          key={qi}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: qi * 0.05 }}
          className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-xl p-5 space-y-3"
        >
          <p className="text-sm font-medium text-foreground leading-relaxed">{qi + 1}. {q.question}</p>
          <div className="space-y-2">
            {q.options.map((opt, oi) => {
              const selected = answers[qi] === oi;
              const isCorrect = q.correct === oi;
              const showState = showResults && (selected || isCorrect);
              return (
                <motion.button
                  key={oi}
                  onClick={() => !showResults && setAnswers(prev => ({ ...prev, [qi]: oi }))}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all border ${
                    showState && isCorrect ? 'border-green-500/40 bg-green-500/10 text-green-400' :
                    showState && selected && !isCorrect ? 'border-destructive/40 bg-destructive/10 text-destructive' :
                    selected ? 'border-primary/40 bg-primary/10 text-foreground' :
                    'border-border/15 hover:border-border/30 text-muted-foreground hover:text-foreground hover:bg-card/40'
                  }`}
                  whileTap={{ scale: showResults ? 1 : 0.98 }}
                >
                  <div className="flex items-center gap-2.5">
                    {showState && isCorrect && <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />}
                    {showState && selected && !isCorrect && <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />}
                    {opt}
                  </div>
                </motion.button>
              );
            })}
          </div>
          {showResults && answers[qi] !== undefined && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-muted-foreground mt-2 pl-3 border-l-2 border-primary/30 leading-relaxed"
            >
              {q.explanation}
            </motion.p>
          )}
        </motion.div>
      ))}

      {!showResults && Object.keys(answers).length > 0 && (
        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
          <Button onClick={() => setShowResults(true)} className="w-full h-12 rounded-2xl bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary)/0.85)] shadow-lg shadow-primary/20">
            Submit Answers ({Object.keys(answers).length}/{questions.length})
          </Button>
        </motion.div>
      )}
    </div>
  );
};

export default LectureQuiz;
