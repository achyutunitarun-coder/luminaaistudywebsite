import { useState, useCallback } from 'react';
import { Loader2, ClipboardList, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface Question {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

interface Props {
  notes: string;
}

const LectureQuiz = ({ notes }: Props) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showResults, setShowResults] = useState(false);

  const generate = useCallback(async () => {
    setLoading(true);
    setAnswers({});
    setShowResults(false);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-lecture-tools`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ notes, type: 'quiz' }),
      });

      if (!resp.ok) throw new Error('Failed');
      const data = await resp.json();
      const match = (data.content || '').match(/\[[\s\S]*\]/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        setQuestions(parsed);
        toast.success(`${parsed.length} questions generated!`);
      } else throw new Error('Invalid');
    } catch {
      toast.error('Failed to generate quiz');
    } finally {
      setLoading(false);
    }
  }, [notes]);

  const score = Object.entries(answers).filter(([i, a]) => questions[Number(i)]?.correct === a).length;

  if (!questions.length && !loading) {
    return (
      <div className="flex flex-col items-center py-16">
        <ClipboardList className="w-12 h-12 text-muted-foreground/40 mb-4" />
        <h3 className="text-lg font-display font-bold text-foreground mb-2">Generate Quiz</h3>
        <p className="text-muted-foreground text-sm mb-6">Test your understanding with auto-generated MCQs.</p>
        <Button onClick={generate} disabled={!notes} className="h-11 px-6 rounded-2xl">
          <ClipboardList className="w-4 h-4 mr-2" /> Generate Quiz
        </Button>
        {!notes && <p className="text-xs text-muted-foreground mt-2">Generate notes first</p>}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center py-16">
        <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground text-sm">Generating quiz questions...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
      {showResults && (
        <div className="rounded-2xl bg-primary/10 border border-primary/20 p-4 flex items-center justify-between">
          <span className="text-foreground font-display font-bold">
            Score: {score}/{questions.length} ({Math.round(score / questions.length * 100)}%)
          </span>
          <Button variant="ghost" size="sm" onClick={generate} className="rounded-xl">
            <RotateCcw className="w-4 h-4 mr-1.5" /> New Quiz
          </Button>
        </div>
      )}

      {questions.map((q, qi) => (
        <div key={qi} className="rounded-2xl border border-border/30 bg-card/40 p-5 space-y-3">
          <p className="text-sm font-medium text-foreground">{qi + 1}. {q.question}</p>
          <div className="space-y-2">
            {q.options.map((opt, oi) => {
              const selected = answers[qi] === oi;
              const isCorrect = q.correct === oi;
              const showState = showResults && (selected || isCorrect);
              return (
                <motion.button
                  key={oi}
                  onClick={() => !showResults && setAnswers(prev => ({ ...prev, [qi]: oi }))}
                  className={`w-full text-left px-4 py-2.5 rounded-xl text-sm transition-all border ${
                    showState && isCorrect ? 'border-success/50 bg-success/10 text-success' :
                    showState && selected && !isCorrect ? 'border-destructive/50 bg-destructive/10 text-destructive' :
                    selected ? 'border-primary/50 bg-primary/10 text-foreground' :
                    'border-border/20 hover:border-border/40 text-muted-foreground hover:text-foreground'
                  }`}
                  whileTap={{ scale: showResults ? 1 : 0.98 }}
                >
                  <div className="flex items-center gap-2">
                    {showState && isCorrect && <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />}
                    {showState && selected && !isCorrect && <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />}
                    {opt}
                  </div>
                </motion.button>
              );
            })}
          </div>
          {showResults && answers[qi] !== undefined && (
            <p className="text-xs text-muted-foreground mt-2 pl-2 border-l-2 border-primary/30">{q.explanation}</p>
          )}
        </div>
      ))}

      {!showResults && Object.keys(answers).length > 0 && (
        <Button onClick={() => setShowResults(true)} className="w-full h-11 rounded-2xl">
          Submit Answers ({Object.keys(answers).length}/{questions.length})
        </Button>
      )}
    </div>
  );
};

export default LectureQuiz;
