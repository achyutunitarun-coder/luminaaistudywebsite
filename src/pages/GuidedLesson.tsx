import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GraduationCap, Sparkles, Loader2, CheckCircle, XCircle, ChevronRight, RotateCcw, Trophy, Lightbulb, HelpCircle, Zap, BookOpen, Brain, Target, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { UpgradePopup } from '@/components/UpgradePopup';

type Question = {
  type: string;
  question: string;
  options: string[];
  correct: number;
  hint: string;
  explanation: string;
};

type StepData = {
  stepNumber: number;
  stepTitle: string;
  teaching: string;
  understandingCheck: string;
  questions: Question[];
  encouragement: string;
  xpReward: number;
};

type LessonOutline = {
  title: string;
  totalSteps: number;
  steps: string[];
  difficulty: string;
};

const QUICK_TOPICS = ['Photosynthesis', 'Newton\'s Laws', 'Cell Division', 'Quadratic Formula', 'Supply & Demand', 'DNA Replication'];
const DIFFICULTIES = [
  { value: 'beginner', label: '🌱 Beginner', desc: 'Simple language' },
  { value: 'intermediate', label: '⚡ Intermediate', desc: 'Balanced depth' },
  { value: 'advanced', label: '🔥 Advanced', desc: 'Challenging' },
];

const FUNC_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/guided-lesson`;

const Q_TYPE_ICONS: Record<string, typeof Brain> = {
  recall: BookOpen,
  understanding: Brain,
  application: Target,
  tricky: Zap,
};
const Q_TYPE_LABELS: Record<string, string> = {
  recall: 'Recall',
  understanding: 'Understand',
  application: 'Apply',
  tricky: 'Think',
};

const GuidedLesson = () => {
  const { checkAndIncrement, showUpgrade, setShowUpgrade } = useUsageLimits();
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('intermediate');
  const [loading, setLoading] = useState(false);
  const [outline, setOutline] = useState<LessonOutline | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepData, setStepData] = useState<StepData | null>(null);
  const [phase, setPhase] = useState<'teach' | 'questions' | 'results'>('teach');
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showHint, setShowHint] = useState<Record<number, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [totalXP, setTotalXP] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [allStepScores, setAllStepScores] = useState<number[]>([]);

  const callAPI = useCallback(async (body: any) => {
    const resp = await fetch(FUNC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error('Failed');
    return resp.json();
  }, []);

  const startLesson = async () => {
    if (!topic.trim()) return;
    const allowed = await checkAndIncrement('guided_lesson');
    if (!allowed) return;
    setLoading(true);
    try {
      const data = await callAPI({ topic, step: -1, difficulty });
      setOutline(data);
      setCurrentStep(0);
      setTotalXP(0);
      setCompletedSteps([]);
      setAllStepScores([]);
      await loadStep(0, data.totalSteps);
    } catch {
      toast.error('Failed to start lesson');
    }
    setLoading(false);
  };

  const loadStep = async (step: number, total?: number) => {
    setLoading(true);
    setPhase('teach');
    setAnswers({});
    setShowHint({});
    setSubmitted(false);
    setStepData(null);
    try {
      const prevAnswers = allStepScores.length > 0 ? { scores: allStepScores } : undefined;
      const data = await callAPI({
        topic,
        step,
        totalSteps: total || outline?.totalSteps || 5,
        difficulty,
        userAnswers: prevAnswers,
      });
      setStepData(data);
    } catch {
      toast.error('Failed to load step');
    }
    setLoading(false);
  };

  const submitAnswers = () => {
    if (!stepData) return;
    setSubmitted(true);
    setPhase('results');
    const score = stepData.questions.reduce((acc, q, i) => acc + (answers[i] === q.correct ? 1 : 0), 0);
    const xp = Math.round((score / 4) * (stepData.xpReward || 25));
    setTotalXP(prev => prev + xp);
    setAllStepScores(prev => [...prev, score]);
    setCompletedSteps(prev => [...prev, currentStep]);
  };

  const nextStep = () => {
    if (!outline) return;
    if (currentStep + 1 >= outline.totalSteps) {
      setPhase('teach');
      setStepData(null);
      return;
    }
    const next = currentStep + 1;
    setCurrentStep(next);
    loadStep(next);
  };

  const resetAll = () => {
    setOutline(null);
    setStepData(null);
    setCurrentStep(0);
    setTotalXP(0);
    setCompletedSteps([]);
    setAllStepScores([]);
    setTopic('');
    setPhase('teach');
  };

  const score = stepData ? stepData.questions.reduce((acc, q, i) => acc + (answers[i] === q.correct ? 1 : 0), 0) : 0;
  const progress = outline ? ((completedSteps.length) / outline.totalSteps) * 100 : 0;
  const isLessonComplete = outline && completedSteps.length >= outline.totalSteps;

  return (
    <>
      <UpgradePopup open={showUpgrade} onClose={() => setShowUpgrade(false)} />
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--secondary))] flex items-center justify-center shadow-xl shadow-primary/20">
            <GraduationCap className="w-7 h-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Guided Learning</h1>
            <p className="text-muted-foreground text-sm">Step-by-step interactive tutoring • Learn by doing</p>
          </div>
        </motion.div>

        {/* Progress bar when lesson active */}
        {outline && !isLessonComplete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl border border-border/10 bg-muted/5 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground">{outline.title}</span>
              <div className="flex items-center gap-2">
                <Star className="w-3.5 h-3.5 text-warning" />
                <span className="text-xs font-bold text-warning">{totalXP} XP</span>
              </div>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between mt-2">
              {outline.steps.map((s, i) => (
                <div key={i} className={`flex items-center gap-1 text-[9px] ${completedSteps.includes(i) ? 'text-primary font-bold' : i === currentStep ? 'text-foreground font-medium' : 'text-muted-foreground/30'}`}>
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${completedSteps.includes(i) ? 'bg-primary text-primary-foreground' : i === currentStep ? 'bg-primary/20 text-primary border border-primary/40' : 'bg-muted/20 text-muted-foreground/30'}`}>
                    {completedSteps.includes(i) ? '✓' : i + 1}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {/* ─── LESSON COMPLETE ─── */}
          {isLessonComplete && (
            <motion.div key="complete" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="rounded-[2rem] border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-8 text-center space-y-4">
              <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 1, repeat: 2 }}>
                <Trophy className="w-16 h-16 mx-auto text-warning" />
              </motion.div>
              <h2 className="text-2xl font-display font-bold text-foreground">Lesson Complete! 🎉</h2>
              <p className="text-muted-foreground">You earned <span className="text-warning font-bold">{totalXP} XP</span> across {outline?.totalSteps} steps</p>
              <div className="flex flex-wrap justify-center gap-2">
                {allStepScores.map((s, i) => (
                  <div key={i} className={`px-3 py-1.5 rounded-xl text-xs font-bold ${s >= 3 ? 'bg-primary/10 text-primary' : s >= 2 ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'}`}>
                    Step {i + 1}: {s}/4
                  </div>
                ))}
              </div>
              <Button onClick={resetAll} className="mt-4 rounded-2xl gradient-primary text-primary-foreground h-12 px-8">
                <RotateCcw className="w-4 h-4 mr-2" /> New Lesson
              </Button>
            </motion.div>
          )}

          {/* ─── TOPIC INPUT ─── */}
          {!outline && !loading && (
            <motion.div key="input" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div className="rounded-[2rem] border border-border/10 bg-muted/5 p-8 space-y-6">
                <div>
                  <label className="text-sm font-semibold text-foreground mb-3 block flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-primary" /> What do you want to learn?
                  </label>
                  <Input
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    placeholder="Enter a topic — e.g., Photosynthesis, Newton's Laws..."
                    className="bg-muted/20 border-border/30 rounded-xl h-14 px-5 text-base"
                    onKeyDown={e => e.key === 'Enter' && startLesson()}
                  />
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-2">Quick picks</p>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_TOPICS.map(t => (
                      <button key={t} onClick={() => setTopic(t)} className={`text-xs px-4 py-2 rounded-xl border transition-all font-medium ${topic === t ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border/20 bg-muted/10 text-muted-foreground hover:border-primary/20'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-2">Difficulty</p>
                  <div className="flex gap-2">
                    {DIFFICULTIES.map(d => (
                      <button key={d.value} onClick={() => setDifficulty(d.value)} className={`flex-1 px-3 py-3 rounded-xl border transition-all text-center ${difficulty === d.value ? 'border-primary/40 bg-primary/10' : 'border-border/20 bg-muted/5 hover:border-primary/20'}`}>
                        <span className="text-sm font-medium block">{d.label}</span>
                        <span className="text-[10px] text-muted-foreground">{d.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <Button onClick={startLesson} disabled={!topic.trim()} className="gradient-primary text-primary-foreground h-14 px-10 text-base rounded-2xl shadow-lg shadow-primary/20 w-full">
                  <Sparkles className="w-5 h-5 mr-2" /> Start Guided Lesson
                </Button>
              </div>
            </motion.div>
          )}

          {/* ─── LOADING ─── */}
          {loading && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-20 gap-4">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
                <Loader2 className="w-10 h-10 text-primary" />
              </motion.div>
              <p className="text-sm text-muted-foreground">Preparing your lesson...</p>
            </motion.div>
          )}

          {/* ─── TEACHING PHASE ─── */}
          {stepData && phase === 'teach' && !loading && (
            <motion.div key="teach" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
              <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/5 to-transparent p-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-bold text-primary uppercase tracking-widest bg-primary/10 px-3 py-1 rounded-full">Step {stepData.stepNumber}</span>
                  <span className="text-sm font-semibold text-foreground">{stepData.stepTitle}</span>
                </div>
                <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">
                  {stepData.teaching.split('**').map((part, i) => i % 2 === 1 ? <strong key={i} className="text-primary">{part}</strong> : part)}
                </div>
              </div>

              <div className="rounded-xl border border-border/10 bg-muted/5 p-4 flex items-center gap-3">
                <Lightbulb className="w-5 h-5 text-warning flex-shrink-0" />
                <p className="text-sm text-muted-foreground italic">{stepData.understandingCheck}</p>
              </div>

              <Button onClick={() => setPhase('questions')} className="w-full h-12 rounded-2xl gradient-primary text-primary-foreground shadow-lg shadow-primary/20">
                Got it! Show me the questions <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </motion.div>
          )}

          {/* ─── QUESTIONS PHASE ─── */}
          {stepData && (phase === 'questions' || phase === 'results') && !loading && (
            <motion.div key="questions" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              {/* Results banner */}
              {submitted && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={`rounded-2xl p-5 flex items-center gap-4 border ${score >= 3 ? 'border-primary/20 bg-primary/5' : score >= 2 ? 'border-warning/20 bg-warning/5' : 'border-destructive/20 bg-destructive/5'}`}>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold ${score >= 3 ? 'bg-primary/10 text-primary' : score >= 2 ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'}`}>
                    {score}/4
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">
                      {score === 4 ? 'Perfect! 🎉' : score === 3 ? 'Great job! 💪' : score === 2 ? 'Not bad — review below 📖' : 'Let\'s review this step 🔄'}
                    </p>
                    <p className="text-xs text-muted-foreground">{stepData.encouragement}</p>
                  </div>
                </motion.div>
              )}

              {stepData.questions.map((q, qi) => {
                const Icon = Q_TYPE_ICONS[q.type] || Brain;
                const label = Q_TYPE_LABELS[q.type] || q.type;
                return (
                  <motion.div key={qi} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: qi * 0.05 }} className="rounded-2xl border border-border/10 bg-muted/5 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Icon className="w-4 h-4 text-primary" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-primary/60">{label}</span>
                      <span className="text-[10px] text-muted-foreground/30">Q{qi + 1}</span>
                    </div>
                    <p className="text-sm font-medium text-foreground mb-3">{q.question}</p>

                    <div className="space-y-2">
                      {q.options.map((opt, oi) => {
                        const isSelected = answers[qi] === oi;
                        const isCorrect = oi === q.correct;
                        let cls = 'w-full text-left text-sm px-4 py-3 rounded-xl transition-all border font-medium flex items-center gap-2 ';
                        if (submitted) {
                          if (isCorrect) cls += 'bg-primary/10 text-primary border-primary/30';
                          else if (isSelected) cls += 'bg-destructive/10 text-destructive border-destructive/30';
                          else cls += 'bg-muted/5 text-muted-foreground/40 border-border/10';
                        } else if (isSelected) {
                          cls += 'bg-primary/10 text-primary border-primary/40';
                        } else {
                          cls += 'bg-muted/5 text-foreground border-border/15 hover:border-primary/25 hover:bg-primary/5';
                        }
                        return (
                          <button key={oi} className={cls} onClick={() => !submitted && setAnswers(p => ({ ...p, [qi]: oi }))} disabled={submitted}>
                            <span className="w-6 h-6 rounded-lg bg-muted/20 flex items-center justify-center text-[11px] font-bold flex-shrink-0">
                              {submitted && isCorrect ? <CheckCircle className="w-4 h-4 text-primary" /> : submitted && isSelected && !isCorrect ? <XCircle className="w-4 h-4 text-destructive" /> : String.fromCharCode(65 + oi)}
                            </span>
                            {opt}
                          </button>
                        );
                      })}
                    </div>

                    {/* Hint */}
                    {!submitted && (
                      <button onClick={() => setShowHint(p => ({ ...p, [qi]: !p[qi] }))} className="flex items-center gap-1 mt-2 text-[11px] text-muted-foreground/40 hover:text-warning transition-colors">
                        <HelpCircle className="w-3 h-3" /> {showHint[qi] ? 'Hide hint' : 'Need a hint?'}
                      </button>
                    )}
                    {showHint[qi] && !submitted && (
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 text-xs text-warning/70 bg-warning/5 rounded-lg p-2.5 border border-warning/10">
                        💡 {q.hint}
                      </motion.p>
                    )}

                    {/* Explanation after submit */}
                    {submitted && (
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 text-xs text-muted-foreground bg-muted/10 rounded-xl p-3 border border-border/10">
                        {answers[qi] === q.correct ? '✅ ' : '❌ '}{q.explanation}
                      </motion.p>
                    )}
                  </motion.div>
                );
              })}

              {/* Actions */}
              <div className="flex gap-3">
                {!submitted ? (
                  <Button onClick={submitAnswers} disabled={Object.keys(answers).length < 4} className="flex-1 h-12 rounded-2xl gradient-primary text-primary-foreground shadow-lg shadow-primary/20">
                    <CheckCircle className="w-4 h-4 mr-2" /> Check Answers
                  </Button>
                ) : (
                  <Button onClick={nextStep} className="flex-1 h-12 rounded-2xl gradient-primary text-primary-foreground shadow-lg shadow-primary/20">
                    {currentStep + 1 >= (outline?.totalSteps || 5) ? (
                      <><Trophy className="w-4 h-4 mr-2" /> Finish Lesson</>
                    ) : (
                      <><ChevronRight className="w-4 h-4 mr-2" /> Next Step</>
                    )}
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export default GuidedLesson;
