import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Sparkles, Loader2, CheckCircle, Clock, BookOpen, ArrowRight, RotateCcw, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

type Lesson = {
  title: string;
  key_concepts: { concept: string; explanation: string }[];
  practice_questions: { question: string; options: string[]; correct: number; explanation: string }[];
};

const quickTopics = ['Photosynthesis', 'Quadratic Equations', 'Newton\'s Laws', 'Cell Division', 'Thermodynamics', 'Organic Chemistry'];

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

  const score = submitted && lesson
    ? lesson.practice_questions?.reduce((acc, q, i) => acc + (answers[i] === q.correct ? 1 : 0), 0) || 0
    : 0;
  const total = lesson?.practice_questions?.length || 0;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-warning/20 to-warning/5 flex items-center justify-center shadow-lg shadow-warning/10">
          <Zap className="w-7 h-7 text-warning" />
        </div>
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Quick Study</h1>
          <p className="text-muted-foreground text-sm flex items-center gap-1.5 mt-0.5">
            <Clock className="w-3.5 h-3.5" /> 10-minute rapid revision lessons
          </p>
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {!lesson ? (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Input Card */}
            <div className="relative rounded-3xl border border-border/40 bg-card/50 backdrop-blur-xl overflow-hidden">
              <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-warning/8 blur-[80px]" />
              <div className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full bg-primary/8 blur-[60px]" />

              <div className="relative z-10 p-8 space-y-6">
                <div>
                  <label className="text-sm font-semibold text-foreground mb-3 block flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-primary" /> What do you want to learn?
                  </label>
                  <Input
                    placeholder="Enter a topic — e.g., Photosynthesis, Quadratic Equations..."
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    className="bg-muted/30 border-border/40 rounded-xl h-14 px-5 text-base"
                    onKeyDown={e => e.key === 'Enter' && generate()}
                  />
                </div>

                {/* Quick Topics */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2.5">Quick picks</p>
                  <div className="flex flex-wrap gap-2">
                    {quickTopics.map(t => (
                      <button
                        key={t}
                        onClick={() => { setTopic(t); }}
                        className={`text-xs px-3.5 py-2 rounded-xl border transition-all ${
                          topic === t
                            ? 'border-primary/40 bg-primary/10 text-primary'
                            : 'border-border/40 bg-muted/20 text-muted-foreground hover:border-primary/30 hover:text-foreground'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={generate}
                  disabled={generating || !topic.trim()}
                  className="gradient-primary text-primary-foreground h-13 px-8 text-base rounded-2xl shadow-lg shadow-primary/20 hover:shadow-xl transition-all"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 mr-2" />
                      Generate Quick Lesson
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="lesson"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Lesson Title */}
            <div className="rounded-3xl border border-border/40 bg-card/50 backdrop-blur-xl overflow-hidden">
              <div className="p-8">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-primary uppercase tracking-[0.15em]">Quick Lesson</span>
                </div>
                <h2 className="text-2xl font-display font-bold text-foreground">{lesson.title}</h2>
              </div>

              {/* Key Concepts */}
              <div className="px-8 pb-8">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                    <BookOpen className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">Key Concepts</h3>
                </div>
                <div className="space-y-4">
                  {lesson.key_concepts?.map((c, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="relative pl-5 py-3 border-l-2 border-primary/20 hover:border-primary/50 transition-colors group"
                    >
                      <div className="absolute left-[-5px] top-4 w-2 h-2 rounded-full bg-primary/50 group-hover:bg-primary transition-colors" />
                      <p className="text-sm font-semibold text-foreground">{c.concept}</p>
                      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{c.explanation}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            {/* Practice Questions */}
            <div className="rounded-3xl border border-border/40 bg-card/50 backdrop-blur-xl overflow-hidden">
              <div className="p-8">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-6 h-6 rounded-lg bg-secondary/10 flex items-center justify-center">
                    <Trophy className="w-3.5 h-3.5 text-secondary" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">Practice Questions</h3>
                  {submitted && (
                    <span className={`ml-auto text-sm font-bold ${score === total ? 'text-success' : score >= total / 2 ? 'text-warning' : 'text-destructive'}`}>
                      {score}/{total} correct
                    </span>
                  )}
                </div>
                <div className="space-y-5">
                  {lesson.practice_questions?.map((q, qi) => (
                    <motion.div
                      key={qi}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + qi * 0.1 }}
                      className="rounded-2xl border border-border/30 bg-muted/10 p-5"
                    >
                      <p className="text-sm font-medium text-foreground mb-3">
                        <span className="text-primary font-bold mr-2">Q{qi + 1}.</span>
                        {q.question}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.options.map((opt, oi) => {
                          const isSelected = answers[qi] === oi;
                          const isCorrect = oi === q.correct;
                          let cls = 'text-sm px-4 py-3 rounded-xl transition-all text-left border font-medium ';

                          if (submitted) {
                            if (isCorrect) cls += 'bg-success/10 text-success border-success/30';
                            else if (isSelected) cls += 'bg-destructive/10 text-destructive border-destructive/30';
                            else cls += 'bg-muted/5 text-muted-foreground border-border/20 opacity-60';
                          } else if (isSelected) {
                            cls += 'bg-primary/10 text-primary border-primary/40 shadow-sm shadow-primary/10';
                          } else {
                            cls += 'bg-muted/5 text-foreground border-border/30 hover:border-primary/30 hover:bg-primary/5';
                          }
                          return (
                            <button
                              key={oi}
                              className={cls}
                              onClick={() => !submitted && setAnswers(p => ({ ...p, [qi]: oi }))}
                              disabled={submitted}
                            >
                              <span className="opacity-50 mr-2">{String.fromCharCode(65 + oi)}.</span>
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                      <AnimatePresence>
                        {submitted && (
                          <motion.p
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="mt-3 text-xs text-muted-foreground leading-relaxed bg-muted/20 rounded-lg p-3"
                          >
                            💡 {q.explanation}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              {!submitted ? (
                <Button
                  onClick={() => setSubmitted(true)}
                  disabled={Object.keys(answers).length !== total}
                  className="gradient-primary text-primary-foreground h-12 px-8 rounded-2xl shadow-lg shadow-primary/20"
                >
                  <CheckCircle className="w-4 h-4 mr-2" /> Check Answers
                </Button>
              ) : (
                <Button
                  onClick={() => { setLesson(null); setTopic(''); }}
                  variant="outline"
                  className="h-12 px-8 rounded-2xl"
                >
                  <RotateCcw className="w-4 h-4 mr-2" /> New Lesson
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default QuickStudy;
