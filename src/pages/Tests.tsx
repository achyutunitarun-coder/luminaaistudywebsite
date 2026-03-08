import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Loader2, Target, Brain, Trophy, ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

type Question = {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
};

const Tests = () => {
  const { user } = useAuth();
  const [syllabus, setSyllabus] = useState('');
  const [subject, setSubject] = useState('');
  const [numQuestions, setNumQuestions] = useState(5);
  const [generating, setGenerating] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [testId, setTestId] = useState<string | null>(null);

  const generateTest = async () => {
    if (!syllabus.trim() || !user) return;
    setGenerating(true);
    setQuestions([]);
    setAnswers({});
    setSubmitted(false);

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ syllabus, subject, numQuestions }),
      });

      if (!resp.ok) throw new Error('Failed to generate test');
      const data = await resp.json();
      
      if (data.questions) {
        setQuestions(data.questions);
        const { data: test } = await supabase.from('tests').insert({
          user_id: user.id,
          title: subject || 'AI Generated Test',
          subject,
          syllabus,
          total_questions: data.questions.length,
          questions: data.questions,
          status: 'in_progress',
        }).select().single();
        if (test) setTestId(test.id);
      }
    } catch (error) {
      toast.error('Failed to generate test. Please try again.');
    }
    setGenerating(false);
  };

  const submitTest = async () => {
    if (!testId) return;
    let correct = 0;
    questions.forEach((q, i) => {
      if (answers[i] === q.correct) correct++;
    });
    const score = (correct / questions.length) * 100;

    await supabase.from('tests').update({
      correct_answers: correct,
      score,
      answers,
      status: 'completed',
    }).eq('id', testId);

    setSubmitted(true);
    toast.success(`Test completed! Score: ${score.toFixed(0)}%`);
  };

  const scoreCount = submitted
    ? questions.reduce((acc, q, i) => acc + (answers[i] === q.correct ? 1 : 0), 0)
    : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-secondary/20 to-secondary/5 flex items-center justify-center shadow-lg shadow-secondary/10">
          <Brain className="w-7 h-7 text-secondary" />
        </div>
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">AI Test Generator</h1>
          <p className="text-muted-foreground text-sm flex items-center gap-1.5 mt-0.5">
            <Target className="w-3.5 h-3.5" /> Input your syllabus, get adaptive tests
          </p>
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {questions.length === 0 ? (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="relative rounded-3xl border border-border/40 bg-card/50 backdrop-blur-xl overflow-hidden">
              <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-secondary/8 blur-[80px]" />
              <div className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full bg-primary/8 blur-[60px]" />

              <div className="relative z-10 p-8 space-y-6">
                <div>
                  <label className="text-sm font-semibold text-foreground mb-3 block flex items-center gap-2">
                    <Target className="w-4 h-4 text-secondary" /> Subject
                  </label>
                  <Input
                    placeholder="e.g., Mathematics, Physics, Biology..."
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    className="bg-muted/30 border-border/40 rounded-xl h-14 px-5 text-base"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-foreground mb-3 block">Syllabus / Topics</label>
                  <Textarea
                    placeholder="Enter your syllabus, topics, or curriculum here. The more detail you provide, the better your test will be..."
                    value={syllabus}
                    onChange={e => setSyllabus(e.target.value)}
                    className="bg-muted/30 border-border/40 rounded-xl min-h-[140px] px-5 py-4 text-sm leading-relaxed resize-none"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-foreground mb-3 block">Number of Questions</label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      value={numQuestions}
                      onChange={e => setNumQuestions(Math.max(1, Math.min(20, parseInt(e.target.value) || 5)))}
                      className="bg-muted/30 border-border/40 rounded-xl h-12 px-4 text-sm w-24"
                      min={1}
                      max={20}
                    />
                    <div className="flex gap-1.5">
                      {[5, 10, 15, 20].map(n => (
                        <button
                          key={n}
                          onClick={() => setNumQuestions(n)}
                          className={`w-10 h-10 rounded-xl text-xs font-medium transition-all ${
                            numQuestions === n
                              ? 'gradient-primary text-primary-foreground shadow-md shadow-primary/20'
                              : 'bg-muted/40 text-muted-foreground hover:bg-muted/60'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <Button
                  onClick={generateTest}
                  disabled={generating || !syllabus.trim()}
                  className="gradient-primary text-primary-foreground h-14 px-10 text-base rounded-2xl shadow-lg shadow-primary/20 hover:shadow-xl transition-all"
                >
                  {generating ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Generating Test...</>
                  ) : (
                    <><Sparkles className="w-5 h-5 mr-2" /> Generate Test</>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="test"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-5"
          >
            {/* Score Bar */}
            {submitted && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative rounded-3xl border border-border/40 bg-card/50 backdrop-blur-xl overflow-hidden p-8 text-center"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
                <div className="relative z-10">
                  <Trophy className={`w-12 h-12 mx-auto mb-3 ${scoreCount === questions.length ? 'text-xp' : scoreCount >= questions.length / 2 ? 'text-warning' : 'text-destructive'}`} />
                  <p className="text-5xl font-display font-bold text-foreground">{scoreCount}/{questions.length}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {scoreCount === questions.length ? 'Perfect score! 🎉' : scoreCount >= questions.length / 2 ? 'Good effort! Keep going.' : 'Keep practicing, you\'ll get there!'}
                  </p>
                </div>
              </motion.div>
            )}

            {/* Questions */}
            {questions.map((q, qi) => {
              const isAnswered = answers[qi] !== undefined;
              const isCorrect = submitted && answers[qi] === q.correct;
              const isWrong = submitted && isAnswered && answers[qi] !== q.correct;

              return (
                <motion.div
                  key={qi}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: qi * 0.05 }}
                  className={`rounded-3xl border bg-card/50 backdrop-blur-xl overflow-hidden transition-all ${
                    submitted
                      ? isCorrect ? 'border-success/30' : isWrong ? 'border-destructive/30' : 'border-border/40'
                      : 'border-border/40'
                  }`}
                >
                  <div className="p-6">
                    {/* Question Header */}
                    <div className="flex items-start gap-3 mb-5">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg mt-0.5 ${
                        submitted
                          ? isCorrect ? 'bg-success/10 text-success' : isWrong ? 'bg-destructive/10 text-destructive' : 'bg-muted/50 text-muted-foreground'
                          : 'bg-secondary/10 text-secondary'
                      }`}>
                        Q{qi + 1}
                      </span>
                      <p className="text-foreground font-medium text-[15px] leading-relaxed flex-1">{q.question}</p>
                      {submitted && (
                        isCorrect
                          ? <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                          : isWrong
                          ? <XCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                          : null
                      )}
                    </div>

                    {/* Options */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {q.options.map((opt, oi) => {
                        const isSelected = answers[qi] === oi;
                        const isCorrectOpt = oi === q.correct;
                        let cls = 'text-sm px-4 py-3.5 rounded-xl transition-all text-left border font-medium w-full ';

                        if (submitted) {
                          if (isCorrectOpt) cls += 'bg-success/10 text-success border-success/30';
                          else if (isSelected) cls += 'bg-destructive/10 text-destructive border-destructive/30';
                          else cls += 'bg-muted/5 text-muted-foreground border-border/20 opacity-50';
                        } else if (isSelected) {
                          cls += 'bg-primary/10 text-primary border-primary/40 shadow-sm shadow-primary/10';
                        } else {
                          cls += 'bg-muted/5 text-foreground border-border/30 hover:border-primary/30 hover:bg-primary/5';
                        }

                        return (
                          <button
                            key={oi}
                            className={cls}
                            onClick={() => !submitted && setAnswers(prev => ({ ...prev, [qi]: oi }))}
                            disabled={submitted}
                          >
                            <span className="opacity-40 mr-2 font-semibold">{String.fromCharCode(65 + oi)}.</span>
                            {opt}
                          </button>
                        );
                      })}
                    </div>

                    {/* Explanation */}
                    <AnimatePresence>
                      {submitted && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-4 text-xs text-muted-foreground leading-relaxed bg-muted/20 rounded-xl p-4 border border-border/20"
                        >
                          💡 {q.explanation}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              {!submitted ? (
                <Button
                  onClick={submitTest}
                  disabled={Object.keys(answers).length !== questions.length}
                  className="gradient-primary text-primary-foreground h-13 px-10 rounded-2xl shadow-lg shadow-primary/20 text-base"
                >
                  <CheckCircle className="w-5 h-5 mr-2" /> Submit Test
                </Button>
              ) : (
                <Button
                  onClick={() => { setQuestions([]); setAnswers({}); setSubmitted(false); setSyllabus(''); setSubject(''); }}
                  variant="outline"
                  className="h-12 px-8 rounded-2xl"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" /> Generate New Test
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Tests;
