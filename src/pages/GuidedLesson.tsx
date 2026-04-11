import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Sparkles, Loader2, CheckCircle, XCircle, ChevronRight, ChevronDown,
  RotateCcw, Trophy, Lightbulb, HelpCircle, Zap, BookOpen, Target, Star,
  Volume2, VolumeX, ArrowRight, Eye, Send, Crown, GraduationCap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { useAuth } from '@/hooks/useAuth';
import { UpgradePopup } from '@/components/UpgradePopup';
import { supabase } from '@/integrations/supabase/client';
import MarkdownRenderer from '@/components/MarkdownRenderer';

/* ─── Types ─── */
type OutlineStep = { title: string; description: string };
type Outline = { title: string; totalSteps: number; steps: OutlineStep[]; difficulty: string };
type CheckQuestion = {
  type: 'mcq' | 'short_answer';
  question: string;
  options?: string[];
  correct?: number;
  explanation?: string;
  model_answer?: string;
};
type StepContent = {
  stepTitle: string;
  explanation: string;
  example: string;
  check_questions: CheckQuestion[];
  encouragement: string;
};
type FinalQuizQ = {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
  step_ref: number;
};

/* ─── Constants ─── */
const FUNC_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/guided-lesson`;
const QUICK_TOPICS = ['Photosynthesis', "Newton's Laws", 'Cell Division', 'Quadratic Equations', 'Supply & Demand', 'DNA Replication', 'French Revolution', 'Thermodynamics'];
const DIFFICULTIES = [
  { value: 'beginner', label: 'Beginner', icon: '🌱' },
  { value: 'intermediate', label: 'Intermediate', icon: '⚡' },
  { value: 'advanced', label: 'Advanced', icon: '🔥' },
];

/* ─── Animations CSS ─── */
const shakeKeyframes = `@keyframes shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-4px)} 40%,80%{transform:translateX(4px)} }`;
const glowPulseKeyframes = `@keyframes glowPulse { 0%,100%{box-shadow:0 0 8px rgba(0,212,200,0.4)} 50%{box-shadow:0 0 20px rgba(0,212,200,0.8)} }`;
const ringExpandKeyframes = `@keyframes ringExpand { 0%{transform:scale(0);opacity:1} 100%{transform:scale(3);opacity:0} }`;

const GuidedLesson = () => {
  const { checkAndIncrement, showUpgrade, setShowUpgrade } = useUsageLimits();
  const { user } = useAuth();

  // ── State ──
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('intermediate');
  const [goal, setGoal] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState('');

  const [outline, setOutline] = useState<Outline | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepContent, setStepContent] = useState<StepContent | null>(null);
  const [phase, setPhase] = useState<'setup' | 'roadmap' | 'teach' | 'check' | 'feedback' | 'complete'>('setup');

  // Adaptive content
  const [extraContent, setExtraContent] = useState<{ type: string; text: string }[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Check phase
  const [mcqAnswer, setMcqAnswer] = useState<number | null>(null);
  const [shortAnswer, setShortAnswer] = useState('');
  const [mcqSubmitted, setMcqSubmitted] = useState(false);
  const [shortSubmitted, setShortSubmitted] = useState(false);
  const [shortFeedback, setShortFeedback] = useState<{ verdict: string; feedback: string; score: number } | null>(null);
  const [wrongAttempts, setWrongAttempts] = useState(0);

  // Scoring
  const [stepScores, setStepScores] = useState<{ correct: number; total: number }[]>([]);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // Final quiz
  const [finalQuiz, setFinalQuiz] = useState<FinalQuizQ[] | null>(null);
  const [finalAnswers, setFinalAnswers] = useState<Record<number, number>>({});
  const [finalSubmitted, setFinalSubmitted] = useState(false);

  // Review
  const [reviewMode, setReviewMode] = useState(false);
  const [allStepContents, setAllStepContents] = useState<Record<number, StepContent>>({});

  // Celebration
  const [showRing, setShowRing] = useState(false);
  const [milestone, setMilestone] = useState<string | null>(null);

  const contentRef = useRef<HTMLDivElement>(null);

  /* ─── API Helper ─── */
  const callAPI = useCallback(async (body: Record<string, unknown>) => {
    const resp = await fetch(FUNC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error(`API error ${resp.status}`);
    return resp.json();
  }, []);

  /* ─── Start Lesson ─── */
  const startLesson = async () => {
    if (!topic.trim()) { toast.error('Enter a topic to learn'); return; }
    const allowed = await checkAndIncrement('guided_lesson');
    if (!allowed) return;
    setLoading(true);
    try {
      const data = await callAPI({ mode: 'outline', topic: topic.trim(), difficulty });
      // Normalize steps
      const steps: OutlineStep[] = (data.steps || []).map((s: string | OutlineStep) =>
        typeof s === 'string' ? { title: s, description: '' } : s
      );
      setOutline({ ...data, steps });
      setPhase('roadmap');
    } catch (e) {
      toast.error('Failed to generate lesson outline. Try again.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  /* ─── Load Step ─── */
  const loadStep = async (stepIdx: number) => {
    if (!outline) return;
    setLoading(true);
    setPhase('teach');
    setCurrentStep(stepIdx);
    setExtraContent([]);
    setMcqAnswer(null);
    setShortAnswer('');
    setMcqSubmitted(false);
    setShortSubmitted(false);
    setShortFeedback(null);
    setWrongAttempts(0);
    try {
      const data = await callAPI({
        mode: 'step',
        topic: outline.title || topic,
        step: stepIdx,
        totalSteps: outline.steps.length,
        difficulty,
        stepTitle: outline.steps[stepIdx]?.title || '',
      });
      setStepContent(data);
      setAllStepContents(prev => ({ ...prev, [stepIdx]: data }));
    } catch (e) {
      toast.error('Failed to load step. Try again.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  /* ─── Adaptive Buttons ─── */
  const handleSimplify = async () => {
    if (!stepContent || !outline) return;
    setLoadingAction('simplify');
    try {
      const data = await callAPI({
        mode: 'simplify',
        topic: outline.title || topic,
        stepTitle: stepContent.stepTitle,
        originalExplanation: stepContent.explanation,
      });
      setExtraContent(prev => [...prev, { type: 'Simpler Explanation', text: data.explanation }]);
    } catch { toast.error('Failed to simplify'); }
    finally { setLoadingAction(''); }
  };

  const handleDeeper = async () => {
    if (!stepContent || !outline) return;
    setLoadingAction('deeper');
    try {
      const data = await callAPI({
        mode: 'deeper',
        topic: outline.title || topic,
        stepTitle: stepContent.stepTitle,
        originalExplanation: stepContent.explanation,
      });
      setExtraContent(prev => [...prev, { type: 'Deeper Dive', text: data.explanation }]);
    } catch { toast.error('Failed to go deeper'); }
    finally { setLoadingAction(''); }
  };

  const handleExample = async () => {
    if (!stepContent || !outline) return;
    setLoadingAction('example');
    try {
      const data = await callAPI({
        mode: 'example',
        topic: outline.title || topic,
        stepTitle: stepContent.stepTitle,
      });
      setExtraContent(prev => [...prev, { type: 'Real-World Example', text: data.example }]);
    } catch { toast.error('Failed to get example'); }
    finally { setLoadingAction(''); }
  };

  /* ─── TTS ─── */
  const toggleReadAloud = () => {
    if (isSpeaking) {
      speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    if (!stepContent) return;
    const text = stepContent.explanation.replace(/\*\*/g, '').replace(/[#*_]/g, '');
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.onend = () => setIsSpeaking(false);
    speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  /* ─── MCQ Submit ─── */
  const submitMCQ = () => {
    if (mcqAnswer === null || !stepContent) return;
    setMcqSubmitted(true);
    const q = stepContent.check_questions.find(q => q.type === 'mcq');
    if (!q) return;
    if (mcqAnswer !== q.correct) {
      setWrongAttempts(prev => prev + 1);
    }
  };

  /* ─── Short Answer Submit ─── */
  const submitShortAnswer = async () => {
    if (!shortAnswer.trim() || !stepContent) return;
    const q = stepContent.check_questions.find(q => q.type === 'short_answer');
    if (!q) return;
    setShortSubmitted(true);
    setLoadingAction('evaluate');
    try {
      const data = await callAPI({
        mode: 'evaluate',
        question: q.question,
        modelAnswer: q.model_answer || '',
        studentAnswer: shortAnswer,
      });
      setShortFeedback(data);
    } catch {
      setShortFeedback({ verdict: 'partial', feedback: 'Could not evaluate — but good effort!', score: 50 });
    } finally {
      setLoadingAction('');
    }
  };

  /* ─── Complete Step ─── */
  const completeStep = () => {
    if (!stepContent || !outline) return;
    const mcqQ = stepContent.check_questions.find(q => q.type === 'mcq');
    const mcqCorrect = mcqQ && mcqAnswer === mcqQ.correct ? 1 : 0;
    const shortCorrect = shortFeedback?.verdict === 'correct' ? 1 : shortFeedback?.verdict === 'partial' ? 0.5 : 0;
    const total = stepContent.check_questions.length;
    const correct = mcqCorrect + shortCorrect;

    setStepScores(prev => [...prev, { correct, total }]);
    setCompletedSteps(prev => new Set([...prev, currentStep]));

    // Milestone checks
    const done = completedSteps.size + 1;
    const totalSteps = outline.steps.length;
    const pct = done / totalSteps;
    if (pct >= 1) {
      setPhase('complete');
      setShowRing(true);
      setTimeout(() => setShowRing(false), 1500);
      saveLesson(done, stepScores.concat([{ correct, total }]));
      return;
    }
    if (pct >= 0.75 && !milestone) setMilestone('75% — Almost there!');
    else if (pct >= 0.5 && !milestone) setMilestone('50% — Halfway!');
    else if (pct >= 0.25 && !milestone) setMilestone('25% — Great start!');

    if (milestone) setTimeout(() => setMilestone(null), 2000);

    // Auto advance to next step
    const next = currentStep + 1;
    if (next < totalSteps) {
      loadStep(next);
    } else {
      setPhase('complete');
      setShowRing(true);
      setTimeout(() => setShowRing(false), 1500);
      saveLesson(done, stepScores.concat([{ correct, total }]));
    }
  };

  /* ─── Save Lesson ─── */
  const saveLesson = async (stepsCompleted: number, scores: { correct: number; total: number }[]) => {
    if (!user || !outline) return;
    const totalQ = scores.reduce((a, s) => a + s.total, 0);
    const correctA = scores.reduce((a, s) => a + s.correct, 0);
    const score = totalQ > 0 ? Math.round((correctA / totalQ) * 100) : 0;
    try {
      await (supabase.from('guided_lessons' as any) as any).insert({
        user_id: user.id,
        topic: outline.title || topic,
        difficulty,
        steps_completed: stepsCompleted,
        total_steps: outline.steps.length,
        score,
        total_questions: totalQ,
        correct_answers: Math.round(correctA),
        completed_at: new Date().toISOString(),
      });
      // Award XP
      await supabase.rpc('award_xp_coins', { p_user_id: user.id, p_xp: stepsCompleted * 15, p_coins: stepsCompleted * 3 });
    } catch (e) { console.error('Failed to save lesson:', e); }
  };

  /* ─── Final Quiz ─── */
  const startFinalQuiz = async () => {
    if (!outline) return;
    setLoading(true);
    try {
      const data = await callAPI({
        mode: 'final_quiz',
        topic: outline.title || topic,
        steps: outline.steps.map(s => s.title),
        difficulty,
      });
      const questions = Array.isArray(data) ? data : data.questions || [];
      setFinalQuiz(questions);
      setFinalAnswers({});
      setFinalSubmitted(false);
    } catch { toast.error('Failed to generate quiz'); }
    finally { setLoading(false); }
  };

  /* ─── Reset ─── */
  const resetLesson = () => {
    setOutline(null);
    setStepContent(null);
    setPhase('setup');
    setCurrentStep(0);
    setExtraContent([]);
    setStepScores([]);
    setCompletedSteps(new Set());
    setFinalQuiz(null);
    setAllStepContents({});
    setReviewMode(false);
    setTopic('');
  };

  /* ─── Scroll to top on step change ─── */
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentStep, phase]);

  /* ─── Computed ─── */
  const progressPct = outline ? ((completedSteps.size) / outline.steps.length) * 100 : 0;
  const totalCorrect = stepScores.reduce((a, s) => a + s.correct, 0);
  const totalQuestions = stepScores.reduce((a, s) => a + s.total, 0);
  const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

  // ═══════════════════════ RENDER ═══════════════════════

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] relative overflow-hidden">
      <style>{shakeKeyframes}{glowPulseKeyframes}{ringExpandKeyframes}</style>
      <UpgradePopup open={showUpgrade} onClose={() => setShowUpgrade(false)} />

      {/* Milestone Toast */}
      <AnimatePresence>
        {milestone && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl bg-[#00d4c8]/20 border border-[#00d4c8]/40 text-[#00d4c8] font-semibold text-sm backdrop-blur-lg"
          >
            🎉 {milestone}
          </motion.div>
        )}
      </AnimatePresence>

      <div ref={contentRef} className="max-w-[720px] mx-auto px-4 pb-32 pt-6 relative">

        {/* ═══ SETUP PHASE ═══ */}
        {phase === 'setup' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 pt-12">
            {/* Hero */}
            <div className="text-center space-y-4">
              <div className="inline-flex p-4 rounded-2xl bg-[#00d4c8]/10 border border-[#00d4c8]/20" style={{ animation: 'glowPulse 3s infinite' }}>
                <GraduationCap className="w-12 h-12 text-[#00d4c8]" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground">Guided Lesson</h1>
              <p className="text-muted-foreground text-lg max-w-md mx-auto">
                Enter any topic and learn it step-by-step with an AI tutor that adapts to you
              </p>
            </div>

            {/* Topic Input */}
            <div className="space-y-3">
              <div className="relative">
                <Input
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && startLesson()}
                  placeholder="What do you want to learn today?"
                  className="h-14 text-lg bg-card/60 border-border/50 backdrop-blur-sm pl-5 pr-14 rounded-xl focus:border-[#00d4c8]/50 focus:ring-[#00d4c8]/20"
                />
                <Sparkles className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/40" />
              </div>

              {/* Quick Topics */}
              <div className="flex flex-wrap gap-2">
                {QUICK_TOPICS.map(t => (
                  <button
                    key={t}
                    onClick={() => setTopic(t)}
                    className="px-3 py-1.5 text-xs rounded-lg bg-card/40 border border-border/30 text-muted-foreground hover:text-foreground hover:border-[#00d4c8]/40 hover:bg-[#00d4c8]/5 transition-all"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Options */}
            <div>
              <button
                onClick={() => setShowOptions(!showOptions)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${showOptions ? 'rotate-180' : ''}`} />
                Lesson Options
              </button>
              <AnimatePresence>
                {showOptions && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-3 space-y-3">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Difficulty</label>
                        <div className="flex gap-2">
                          {DIFFICULTIES.map(d => (
                            <button
                              key={d.value}
                              onClick={() => setDifficulty(d.value)}
                              className={`flex-1 px-3 py-2 rounded-lg text-sm border transition-all ${
                                difficulty === d.value
                                  ? 'border-[#00d4c8]/60 bg-[#00d4c8]/10 text-[#00d4c8]'
                                  : 'border-border/30 bg-card/30 text-muted-foreground hover:border-border/60'
                              }`}
                            >
                              {d.icon} {d.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Learning Goal (optional)</label>
                        <Input
                          value={goal}
                          onChange={e => setGoal(e.target.value)}
                          placeholder="e.g. Pass my exam, understand deeply..."
                          className="bg-card/40 border-border/30"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Start Button */}
            <Button
              onClick={startLesson}
              disabled={loading || !topic.trim()}
              className="w-full h-14 text-lg rounded-xl bg-[#00d4c8] hover:bg-[#00d4c8]/90 text-background font-semibold shadow-lg shadow-[#00d4c8]/20"
            >
              {loading ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Generating Lesson...</> : <><Sparkles className="w-5 h-5 mr-2" /> Start Lesson</>}
            </Button>
          </motion.div>
        )}

        {/* ═══ ROADMAP PHASE ═══ */}
        {phase === 'roadmap' && outline && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pt-8">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-foreground">{outline.title}</h2>
              <p className="text-muted-foreground">{outline.steps.length} steps · {DIFFICULTIES.find(d => d.value === difficulty)?.label}</p>
            </div>

            {/* Step List */}
            <div className="space-y-3">
              {outline.steps.map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-4 p-4 rounded-xl bg-card/40 border border-border/30 backdrop-blur-sm"
                >
                  <div className="w-10 h-10 rounded-full bg-[#00d4c8]/10 border border-[#00d4c8]/30 flex items-center justify-center text-sm font-bold text-[#00d4c8] shrink-0">
                    {i + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground text-sm">{step.title}</p>
                    {step.description && <p className="text-xs text-muted-foreground truncate">{step.description}</p>}
                  </div>
                </motion.div>
              ))}
            </div>

            <Button
              onClick={() => loadStep(0)}
              className="w-full h-12 rounded-xl bg-[#00d4c8] hover:bg-[#00d4c8]/90 text-background font-semibold"
            >
              Begin Lesson <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        )}

        {/* ═══ LESSON STEPS ═══ */}
        {(phase === 'teach' || phase === 'check' || phase === 'feedback') && outline && (
          <>
            {/* Sticky Progress */}
            <div className="sticky top-0 z-30 -mx-4 px-4 py-3 bg-background/80 backdrop-blur-lg border-b border-border/20">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-semibold text-[#00d4c8] uppercase tracking-wider">
                  Step {currentStep + 1} of {outline.steps.length}
                </span>
                <div className="flex-1" />
                {/* Mini step dots */}
                <div className="flex gap-1">
                  {outline.steps.map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full transition-all ${
                        completedSteps.has(i) ? 'bg-emerald-400' :
                        i === currentStep ? 'bg-[#00d4c8] shadow-[0_0_6px_rgba(0,212,200,0.6)]' :
                        'bg-muted/30'
                      }`}
                      style={i === currentStep ? { animation: 'glowPulse 2s infinite' } : undefined}
                    />
                  ))}
                </div>
              </div>
              <Progress value={progressPct} className="h-1.5 bg-muted/20" />
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      className="w-2.5 h-2.5 rounded-full bg-[#00d4c8]"
                      animate={{ y: [0, -8, 0] }}
                      transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.15 }}
                    />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">Preparing your lesson...</p>
              </div>
            ) : stepContent && (
              <AnimatePresence mode="wait">
                <motion.div
                  key={`step-${currentStep}-${phase}`}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6 pt-6"
                >
                  {/* ── TEACH ── */}
                  {phase === 'teach' && (
                    <>
                      <div>
                        <h3 className="text-xl font-bold text-foreground mb-1">{stepContent.stepTitle}</h3>
                        <span className="inline-block px-2 py-0.5 text-[10px] rounded bg-muted/30 text-muted-foreground/60 uppercase tracking-wider">AI-generated</span>
                      </div>

                      {/* Explanation */}
                      <div className="p-5 rounded-xl bg-card/50 border border-border/30 backdrop-blur-sm">
                        <MarkdownRenderer>{stepContent.explanation}</MarkdownRenderer>
                      </div>

                      {/* Example */}
                      {stepContent.example && (
                        <div className="p-4 rounded-xl bg-[#f5a623]/5 border border-[#f5a623]/20">
                          <p className="text-xs font-semibold text-[#f5a623] mb-1 flex items-center gap-1"><Lightbulb className="w-3.5 h-3.5" /> Example</p>
                          <p className="text-sm text-foreground/90">{stepContent.example}</p>
                        </div>
                      )}

                      {/* Extra Content */}
                      {extraContent.map((ec, i) => (
                        <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                          className="p-4 rounded-xl bg-card/30 border border-[#00d4c8]/20">
                          <p className="text-xs font-semibold text-[#00d4c8] mb-1">{ec.type}</p>
                          <MarkdownRenderer>{ec.text}</MarkdownRenderer>
                        </motion.div>
                      ))}

                      {/* Adaptive Buttons */}
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={handleSimplify} disabled={!!loadingAction}
                          className="border-border/30 text-muted-foreground hover:text-foreground hover:border-[#00d4c8]/40">
                          {loadingAction === 'simplify' ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <HelpCircle className="w-3.5 h-3.5 mr-1" />}
                          Explain Simpler
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleExample} disabled={!!loadingAction}
                          className="border-border/30 text-muted-foreground hover:text-foreground hover:border-[#f5a623]/40">
                          {loadingAction === 'example' ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Lightbulb className="w-3.5 h-3.5 mr-1" />}
                          Give Example
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleDeeper} disabled={!!loadingAction}
                          className="border-border/30 text-muted-foreground hover:text-foreground hover:border-purple-400/40">
                          {loadingAction === 'deeper' ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Brain className="w-3.5 h-3.5 mr-1" />}
                          Go Deeper
                        </Button>
                        <Button variant="outline" size="sm" onClick={toggleReadAloud}
                          className="border-border/30 text-muted-foreground hover:text-foreground">
                          {isSpeaking ? <VolumeX className="w-3.5 h-3.5 mr-1" /> : <Volume2 className="w-3.5 h-3.5 mr-1" />}
                          {isSpeaking ? 'Stop' : 'Read Aloud'}
                        </Button>
                      </div>

                      {/* Continue to Questions Button */}
                      <Button
                        onClick={() => {
                          if (stepContent?.check_questions && stepContent.check_questions.length > 0) {
                            setPhase('check');
                          } else {
                            // No questions — skip directly to next step
                            completeStep();
                          }
                        }}
                        className="w-full h-12 rounded-xl bg-[#00d4c8] hover:bg-[#00d4c8]/90 text-background font-semibold mt-4"
                      >
                        {stepContent?.check_questions && stepContent.check_questions.length > 0
                          ? <>Ready — Test Me <ChevronRight className="w-4 h-4 ml-2" /></>
                          : <>Next Step <ArrowRight className="w-4 h-4 ml-2" /></>
                        }
                      </Button>
                    </>
                  )}

                  {/* ── CHECK ── */}
                  {phase === 'check' && (
                    <div className="space-y-6">
                      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <Target className="w-5 h-5 text-[#00d4c8]" /> Check Your Understanding
                      </h3>

                      {(stepContent.check_questions || []).map((q, qi) => (
                        <div key={qi} className="space-y-3">
                          {q.type === 'mcq' && q.options && (
                            <div className="space-y-3">
                              <p className="text-sm font-medium text-foreground">{q.question}</p>
                              <div className="space-y-2">
                                {q.options.map((opt, oi) => {
                                  const isSelected = mcqAnswer === oi;
                                  const isCorrect = mcqSubmitted && oi === q.correct;
                                  const isWrong = mcqSubmitted && isSelected && oi !== q.correct;
                                  return (
                                    <button
                                      key={oi}
                                      onClick={() => !mcqSubmitted && setMcqAnswer(oi)}
                                      disabled={mcqSubmitted}
                                      className={`w-full text-left p-3 rounded-xl border transition-all flex items-center gap-3 ${
                                        isCorrect ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-300' :
                                        isWrong ? 'border-red-400/60 bg-red-400/10 text-red-300' :
                                        isSelected ? 'border-[#00d4c8]/60 bg-[#00d4c8]/10 text-[#00d4c8]' :
                                        'border-border/30 bg-card/30 text-foreground/80 hover:border-border/60'
                                      }`}
                                      style={isWrong ? { animation: 'shake 0.4s ease' } : undefined}
                                    >
                                      <span className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 ${
                                        isCorrect ? 'border-emerald-400 bg-emerald-400/20' :
                                        isWrong ? 'border-red-400 bg-red-400/20' :
                                        isSelected ? 'border-[#00d4c8] bg-[#00d4c8]/20' :
                                        'border-border/40'
                                      }`}>
                                        {String.fromCharCode(65 + oi)}
                                      </span>
                                      <span className="text-sm">{opt}</span>
                                      {isCorrect && <CheckCircle className="w-4 h-4 ml-auto text-emerald-400" />}
                                      {isWrong && <XCircle className="w-4 h-4 ml-auto text-red-400" />}
                                    </button>
                                  );
                                })}
                              </div>
                              {mcqSubmitted && q.explanation && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                  className={`p-3 rounded-lg text-sm ${mcqAnswer === q.correct ? 'bg-emerald-400/10 text-emerald-300 border border-emerald-400/20' : 'bg-red-400/10 text-red-300 border border-red-400/20'}`}>
                                  {mcqAnswer === q.correct ? '✨ Nailed it! ' : `💡 Not quite — `}{q.explanation}
                                </motion.div>
                              )}
                              {!mcqSubmitted && (
                                <Button onClick={submitMCQ} disabled={mcqAnswer === null}
                                  className="bg-[#00d4c8] hover:bg-[#00d4c8]/90 text-background">
                                  Check Answer
                                </Button>
                              )}
                            </div>
                          )}

                          {q.type === 'short_answer' && (
                            <div className="space-y-3">
                              <p className="text-sm font-medium text-foreground">{q.question}</p>
                              <Textarea
                                value={shortAnswer}
                                onChange={e => setShortAnswer(e.target.value)}
                                placeholder="Type your answer..."
                                disabled={shortSubmitted}
                                className="bg-card/40 border-border/30 min-h-[80px]"
                              />
                              {!shortSubmitted && (
                                <Button onClick={submitShortAnswer} disabled={!shortAnswer.trim() || loadingAction === 'evaluate'}
                                  className="bg-[#00d4c8] hover:bg-[#00d4c8]/90 text-background">
                                  {loadingAction === 'evaluate' ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Evaluating...</> : <><Send className="w-4 h-4 mr-1" /> Submit Answer</>}
                                </Button>
                              )}
                              {shortFeedback && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                  className={`p-3 rounded-lg text-sm border ${
                                    shortFeedback.verdict === 'correct' ? 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20' :
                                    shortFeedback.verdict === 'partial' ? 'bg-amber-400/10 text-amber-300 border-amber-400/20' :
                                    'bg-red-400/10 text-red-300 border-red-400/20'
                                  }`}>
                                  {shortFeedback.verdict === 'correct' ? '✨ ' : shortFeedback.verdict === 'partial' ? '🤔 ' : '💡 '}
                                  {shortFeedback.feedback}
                                </motion.div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Next Step Button — show when all questions answered */}
                      {(() => {
                        const questions = stepContent.check_questions || [];
                        const mcqQ = questions.find(q => q.type === 'mcq');
                        const shortQ = questions.find(q => q.type === 'short_answer');
                        const mcqDone = !mcqQ || mcqSubmitted;
                        const shortDone = !shortQ || shortSubmitted;
                        const allDone = mcqDone && shortDone;
                        if (!allDone) return null;
                        return (
                          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="pt-4">
                            <Button
                              onClick={completeStep}
                              className="w-full h-12 rounded-xl bg-[#00d4c8] hover:bg-[#00d4c8]/90 text-background font-semibold"
                            >
                              {outline && currentStep < outline.steps.length - 1
                                ? <>Next Step <ArrowRight className="w-4 h-4 ml-2" /></>
                                : <>Complete Lesson <Trophy className="w-4 h-4 ml-2" /></>
                              }
                            </Button>
                          </motion.div>
                        );
                      })()}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            )}
          </>
        )}

        {/* ═══ COMPLETE PHASE ═══ */}
        {phase === 'complete' && outline && !finalQuiz && !reviewMode && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8 pt-12 text-center">
            {/* Ring animation */}
            {showRing && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-32 h-32 rounded-full border-2 border-[#00d4c8]" style={{ animation: 'ringExpand 1.5s ease-out forwards' }} />
              </div>
            )}

            <div className="space-y-3">
              <div className="inline-flex p-4 rounded-full bg-emerald-400/10 border border-emerald-400/30">
                <Trophy className="w-12 h-12 text-emerald-400" />
              </div>
              <h2 className="text-3xl font-bold text-foreground">Lesson Complete!</h2>
              <p className="text-muted-foreground">{outline.title}</p>
            </div>

            {/* Summary Card */}
            <div className="p-6 rounded-2xl bg-card/50 border border-border/30 backdrop-blur-sm space-y-4 text-left">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 rounded-xl bg-muted/10">
                  <p className="text-2xl font-bold text-[#00d4c8]">{completedSteps.size}</p>
                  <p className="text-xs text-muted-foreground">Steps Completed</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-muted/10">
                  <p className="text-2xl font-bold text-[#f5a623]">{accuracy}%</p>
                  <p className="text-xs text-muted-foreground">Accuracy</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-muted/10">
                  <p className="text-2xl font-bold text-purple-400">{Math.round(totalCorrect)}/{totalQuestions}</p>
                  <p className="text-xs text-muted-foreground">Questions Correct</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-muted/10">
                  <p className="text-2xl font-bold text-emerald-400">+{completedSteps.size * 15}</p>
                  <p className="text-xs text-muted-foreground">XP Earned</p>
                </div>
              </div>
            </div>

            {/* CTAs */}
            <div className="space-y-3">
              <Button onClick={() => setReviewMode(true)} variant="outline" className="w-full h-12 rounded-xl border-border/30">
                <Eye className="w-4 h-4 mr-2" /> Review Lesson
              </Button>
              <Button onClick={startFinalQuiz} disabled={loading} className="w-full h-12 rounded-xl bg-[#00d4c8] hover:bg-[#00d4c8]/90 text-background font-semibold">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Star className="w-4 h-4 mr-2" />}
                Take Final Quiz (5 Questions)
              </Button>
              <Button onClick={resetLesson} variant="ghost" className="w-full text-muted-foreground">
                <RotateCcw className="w-4 h-4 mr-2" /> Start New Lesson
              </Button>
            </div>
          </motion.div>
        )}

        {/* ═══ REVIEW MODE ═══ */}
        {reviewMode && outline && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pt-8">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">Lesson Review</h2>
              <Button variant="ghost" size="sm" onClick={() => setReviewMode(false)}>
                <XCircle className="w-4 h-4 mr-1" /> Close
              </Button>
            </div>
            {outline.steps.map((step, i) => {
              const content = allStepContents[i];
              return (
                <div key={i} className="p-5 rounded-xl bg-card/40 border border-border/30 space-y-3">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#00d4c8]/20 text-[#00d4c8] text-xs flex items-center justify-center font-bold">{i + 1}</span>
                    {step.title}
                  </h3>
                  {content ? (
                    <div className="text-sm text-foreground/80">
                      <MarkdownRenderer>{content.explanation}</MarkdownRenderer>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Step not loaded</p>
                  )}
                </div>
              );
            })}
            <Button onClick={() => setReviewMode(false)} variant="outline" className="w-full">Back to Summary</Button>
          </motion.div>
        )}

        {/* ═══ FINAL QUIZ ═══ */}
        {finalQuiz && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pt-8">
            <h2 className="text-xl font-bold text-foreground text-center">Final Quiz</h2>
            {finalQuiz.map((q, qi) => (
              <div key={qi} className="p-4 rounded-xl bg-card/40 border border-border/30 space-y-3">
                <p className="text-sm font-medium text-foreground">{qi + 1}. {q.question}</p>
                <div className="space-y-2">
                  {q.options.map((opt, oi) => {
                    const isSelected = finalAnswers[qi] === oi;
                    const isCorrect = finalSubmitted && oi === q.correct;
                    const isWrong = finalSubmitted && isSelected && oi !== q.correct;
                    return (
                      <button
                        key={oi}
                        onClick={() => !finalSubmitted && setFinalAnswers(prev => ({ ...prev, [qi]: oi }))}
                        disabled={finalSubmitted}
                        className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-center gap-2 text-sm ${
                          isCorrect ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-300' :
                          isWrong ? 'border-red-400/60 bg-red-400/10 text-red-300' :
                          isSelected ? 'border-[#00d4c8]/60 bg-[#00d4c8]/10 text-[#00d4c8]' :
                          'border-border/30 bg-card/20 text-foreground/80 hover:border-border/60'
                        }`}
                      >
                        <span className="w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold shrink-0">{String.fromCharCode(65 + oi)}</span>
                        {opt}
                      </button>
                    );
                  })}
                </div>
                {finalSubmitted && q.explanation && (
                  <p className="text-xs text-muted-foreground bg-muted/10 p-2 rounded">{q.explanation}</p>
                )}
              </div>
            ))}

            {!finalSubmitted ? (
              <Button onClick={() => setFinalSubmitted(true)} disabled={Object.keys(finalAnswers).length < finalQuiz.length}
                className="w-full h-12 rounded-xl bg-[#00d4c8] hover:bg-[#00d4c8]/90 text-background font-semibold">
                Submit Quiz
              </Button>
            ) : (
              <div className="text-center space-y-4">
                <div className="p-4 rounded-xl bg-card/50 border border-border/30">
                  <p className="text-2xl font-bold text-[#00d4c8]">
                    {finalQuiz.filter((q, i) => finalAnswers[i] === q.correct).length}/{finalQuiz.length}
                  </p>
                  <p className="text-sm text-muted-foreground">Questions Correct</p>
                </div>
                <Button onClick={resetLesson} className="bg-[#00d4c8] hover:bg-[#00d4c8]/90 text-background">
                  <RotateCcw className="w-4 h-4 mr-2" /> Start New Lesson
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* ═══ BOTTOM ACTION BAR ═══ */}
      {(phase === 'teach' || phase === 'check') && stepContent && !loading && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/20 bg-background/90 backdrop-blur-lg">
          <div className="max-w-[720px] mx-auto px-4 py-3">
            {phase === 'teach' && (
              <Button onClick={() => setPhase('check')}
                className="w-full h-12 rounded-xl bg-[#00d4c8] hover:bg-[#00d4c8]/90 text-background font-semibold">
                Ready for Questions <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
            {phase === 'check' && (mcqSubmitted || !stepContent.check_questions.some(q => q.type === 'mcq')) && (shortSubmitted || !stepContent.check_questions.some(q => q.type === 'short_answer')) && (
              <Button onClick={completeStep}
                className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-500/90 text-background font-semibold">
                {currentStep + 1 < (outline?.steps.length || 0) ? <>Next Step <ArrowRight className="w-4 h-4 ml-1" /></> : <>Complete Lesson <Trophy className="w-4 h-4 ml-1" /></>}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GuidedLesson;
