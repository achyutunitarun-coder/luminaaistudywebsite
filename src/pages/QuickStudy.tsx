import { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, Sparkles, Loader2, CheckCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

type Lesson = {
  title: string;
  key_concepts: { concept: string; explanation: string }[];
  practice_questions: { question: string; options: string[]; correct: number; explanation: string }[];
};

const QuickStudy = () => {
  const [topic, setTopic] = useState('');
  const [generating, setGenerating] = useState(false);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const generate = async () => {
    if (!topic.trim()) return;
    setGenerating(true);
    setLesson(null);
    setAnswers({});
    setSubmitted(false);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/quick-study`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ topic }),
      });
      if (!resp.ok) throw new Error('Failed');
      const data = await resp.json();
      setLesson(data);
    } catch {
      toast.error('Failed to generate lesson');
    }
    setGenerating(false);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <Zap className="w-6 h-6 text-warning" /> Quick Study
        </h1>
        <p className="text-muted-foreground text-sm flex items-center gap-1">
          <Clock className="w-3 h-3" /> 10-minute rapid revision lessons
        </p>
      </motion.div>

      {!lesson ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-6 space-y-4">
          <Input
            placeholder="Enter a topic (e.g., Photosynthesis, Quadratic Equations)"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            className="bg-muted/50"
            onKeyDown={e => e.key === 'Enter' && generate()}
          />
          <Button onClick={generate} disabled={generating || !topic.trim()} className="gradient-primary text-primary-foreground">
            {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Generate Quick Lesson
          </Button>
        </motion.div>
      ) : (
        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6">
            <h2 className="text-xl font-display font-bold text-foreground mb-6">{lesson.title}</h2>

            {/* Key Concepts */}
            <h3 className="text-sm font-semibold text-primary mb-3">Key Concepts</h3>
            <div className="space-y-3 mb-8">
              {lesson.key_concepts?.map((c, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className="border-l-2 border-primary/30 pl-4">
                  <p className="text-sm font-semibold text-foreground">{c.concept}</p>
                  <p className="text-sm text-muted-foreground">{c.explanation}</p>
                </motion.div>
              ))}
            </div>

            {/* Practice Questions */}
            <h3 className="text-sm font-semibold text-secondary mb-3">Practice Questions</h3>
            <div className="space-y-4">
              {lesson.practice_questions?.map((q, qi) => (
                <div key={qi} className="bg-muted/20 rounded-lg p-4">
                  <p className="text-sm font-medium text-foreground mb-2">{q.question}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {q.options.map((opt, oi) => {
                      let cls = 'text-xs px-3 py-2 rounded-lg transition-all text-left';
                      if (submitted) {
                        if (oi === q.correct) cls += ' bg-success/10 text-success border border-success/30';
                        else if (answers[qi] === oi) cls += ' bg-destructive/10 text-destructive border border-destructive/30';
                        else cls += ' glass';
                      } else if (answers[qi] === oi) {
                        cls += ' bg-primary/10 text-primary border border-primary/30';
                      } else {
                        cls += ' glass hover:border-primary/30';
                      }
                      return (
                        <button key={oi} className={cls} onClick={() => !submitted && setAnswers(p => ({ ...p, [qi]: oi }))} disabled={submitted}>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                  {submitted && <p className="mt-2 text-xs text-muted-foreground">{q.explanation}</p>}
                </div>
              ))}
            </div>
          </motion.div>

          <div className="flex gap-2">
            {!submitted ? (
              <Button onClick={() => setSubmitted(true)} disabled={Object.keys(answers).length !== lesson.practice_questions?.length} className="gradient-primary text-primary-foreground">
                <CheckCircle className="w-4 h-4 mr-2" /> Check Answers
              </Button>
            ) : (
              <Button onClick={() => { setLesson(null); setTopic(''); }} variant="outline">
                New Lesson
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickStudy;
