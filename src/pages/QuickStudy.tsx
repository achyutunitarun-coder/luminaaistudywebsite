import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Sparkles, Loader2, CheckCircle, Clock, BookOpen, RotateCcw, Trophy, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { FileUploadButton, buildFileContext, type UploadedFile } from '@/components/FileUploadButton';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { UpgradePopup } from '@/components/UpgradePopup';

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
  const [activeTab, setActiveTab] = useState<'concepts' | 'quiz'>('concepts');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const { checkAndIncrement, showUpgrade, setShowUpgrade } = useUsageLimits();

  const generate = async () => {
    if (!topic.trim()) return;
    const allowed = await checkAndIncrement('quick_study');
    if (!allowed) return;
    setGenerating(true);
    setLesson(null);
    setAnswers({});
    setSubmitted(false);
    setActiveTab('concepts');
    try {
      const fileContext = buildFileContext(uploadedFiles);
      const fullTopic = topic + fileContext;
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/quick-study`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ topic: fullTopic }),
      });
      if (!resp.ok) throw new Error('Failed');
      setLesson(await resp.json());
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
    <>
    <UpgradePopup open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[hsl(var(--warning))] to-[hsl(var(--primary))] flex items-center justify-center shadow-xl shadow-warning/20">
            <Zap className="w-7 h-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Quick Study</h1>
            <p className="text-muted-foreground text-sm flex items-center gap-1.5 mt-0.5">
              <Clock className="w-3.5 h-3.5" /> 10-minute rapid revision lessons
            </p>
          </div>
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {!lesson ? (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="relative rounded-[2rem] border border-border/30 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-2xl overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--warning)/0.06),transparent_60%)]" />

              <div className="relative z-10 p-8 space-y-6">
                <div>
                  <label className="text-sm font-semibold text-foreground mb-3 block flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-primary" /> What do you want to learn?
                  </label>
                  <Input
                    placeholder="Enter a topic — e.g., Photosynthesis..."
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    className="bg-muted/20 border-border/30 rounded-xl h-14 px-5 text-base"
                    onKeyDown={e => e.key === 'Enter' && generate()}
                  />
                  <div className="mt-3">
                    <FileUploadButton files={uploadedFiles} onFilesChange={setUploadedFiles} />
                  </div>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-2.5">Quick picks</p>
                  <div className="flex flex-wrap gap-2">
                    {quickTopics.map(t => (
                      <button
                        key={t}
                        onClick={() => setTopic(t)}
                        className={`text-xs px-4 py-2.5 rounded-xl border transition-all font-medium ${
                          topic === t
                            ? 'border-primary/40 bg-primary/10 text-primary'
                            : 'border-border/30 bg-muted/10 text-muted-foreground hover:border-primary/30 hover:text-foreground'
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
                  className="gradient-primary text-primary-foreground h-14 px-10 text-base rounded-2xl shadow-lg shadow-primary/20 hover:shadow-xl transition-all"
                >
                  {generating ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Generating...</>
                  ) : (
                    <><Sparkles className="w-5 h-5 mr-2" /> Generate Lesson</>
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
            <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-xl p-6">
              <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] bg-primary/10 px-3 py-1 rounded-full">Quick Lesson</span>
              <h2 className="text-2xl font-display font-bold text-foreground mt-3">{lesson.title}</h2>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 rounded-2xl bg-muted/10 border border-border/20">
              {(['concepts', 'quiz'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${
                    activeTab === tab
                      ? 'bg-card text-foreground shadow-sm border border-border/20'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab === 'concepts' ? '📖 Key Concepts' : `🧠 Practice (${total})`}
                </button>
              ))}
            </div>

            {activeTab === 'concepts' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {lesson.key_concepts?.map((c, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="rounded-2xl border border-border/20 bg-card/40 backdrop-blur-xl p-5 hover:border-primary/20 transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-primary/20 transition-colors">
                        <Lightbulb className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-foreground mb-1.5">{c.concept}</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">{c.explanation}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {activeTab === 'quiz' && (
              <div className="space-y-4">
                {submitted && (
                  <div className="rounded-2xl border border-border/30 bg-card/40 p-5 flex items-center gap-4">
                    <Trophy className={`w-8 h-8 ${score === total ? 'text-success' : score >= total / 2 ? 'text-warning' : 'text-destructive'}`} />
                    <div>
                      <p className="text-2xl font-display font-bold text-foreground">{score}/{total}</p>
                      <p className="text-xs text-muted-foreground">{score === total ? 'Perfect! 🎉' : 'Review the explanations below'}</p>
                    </div>
                  </div>
                )}

                {lesson.practice_questions?.map((q, qi) => (
                  <motion.div
                    key={qi}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: qi * 0.06 }}
                    className="rounded-2xl border border-border/20 bg-card/40 p-5"
                  >
                    <p className="text-sm font-medium text-foreground mb-3">
                      <span className="text-primary font-bold mr-2">Q{qi + 1}.</span>{q.question}
                    </p>
                    <div className="space-y-2">
                      {q.options.map((opt, oi) => {
                        const isSelected = answers[qi] === oi;
                        const isCorrect = oi === q.correct;
                        let cls = 'w-full text-left text-sm px-4 py-3 rounded-xl transition-all border font-medium ';
                        if (submitted) {
                          if (isCorrect) cls += 'bg-success/10 text-success border-success/30';
                          else if (isSelected) cls += 'bg-destructive/10 text-destructive border-destructive/30';
                          else cls += 'bg-muted/5 text-muted-foreground border-border/15 opacity-50';
                        } else if (isSelected) {
                          cls += 'bg-primary/10 text-primary border-primary/40';
                        } else {
                          cls += 'bg-muted/5 text-foreground border-border/20 hover:border-primary/30';
                        }
                        return (
                          <button key={oi} className={cls} onClick={() => !submitted && setAnswers(p => ({ ...p, [qi]: oi }))} disabled={submitted}>
                            <span className="opacity-40 mr-2 font-bold">{String.fromCharCode(65 + oi)}.</span>{opt}
                          </button>
                        );
                      })}
                    </div>
                    {submitted && (
                      <p className="mt-3 text-xs text-muted-foreground bg-muted/10 rounded-xl p-3 border border-border/10">💡 {q.explanation}</p>
                    )}
                  </motion.div>
                ))}

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
                    <Button onClick={() => { setLesson(null); setTopic(''); }} variant="outline" className="h-12 px-8 rounded-2xl">
                      <RotateCcw className="w-4 h-4 mr-2" /> New Lesson
                    </Button>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default QuickStudy;
