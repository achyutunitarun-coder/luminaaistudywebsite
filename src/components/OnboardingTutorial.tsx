import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, ArrowLeft, BookOpen, Target, Brain, Zap, Trophy, CheckCircle2, GraduationCap, Clock, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const TOTAL_STEPS = 5;

const examOptions = ['JEE', 'NEET', 'CBSE', 'ICSE', 'Board Exams', 'UPSC', 'SSC', 'CAT', 'GRE/GMAT', 'Other'];
const goalOptions = ['Ace my exams', 'Build deep understanding', 'Improve weak areas', 'Learn faster', 'Stay consistent', 'All of the above'];
const studyTimeOptions = ['1-2 hours', '2-4 hours', '4-6 hours', '6+ hours'];
const learningStyleOptions = ['Visual (diagrams, charts)', 'Reading & Notes', 'Practice problems', 'Interactive/Quiz', 'Video/Audio explanations', 'Mixed approach'];

const steps = [
  {
    id: 'welcome',
    title: 'Welcome to Lumina',
    subtitle: 'Let\'s personalize your learning experience',
    icon: Sparkles,
  },
  {
    id: 'exam',
    title: 'What are you preparing for?',
    subtitle: 'This helps us tailor the right content for you',
    icon: GraduationCap,
    options: examOptions,
    multiSelect: true,
  },
  {
    id: 'goal',
    title: 'What\'s your primary goal?',
    subtitle: 'We\'ll optimize your experience around this',
    icon: Target,
    options: goalOptions,
    multiSelect: false,
  },
  {
    id: 'time',
    title: 'How much can you study daily?',
    subtitle: 'We\'ll build a realistic plan around your schedule',
    icon: Clock,
    options: studyTimeOptions,
    multiSelect: false,
  },
  {
    id: 'style',
    title: 'How do you learn best?',
    subtitle: 'We\'ll adapt our teaching style to match you',
    icon: Brain,
    options: learningStyleOptions,
    multiSelect: false,
  },
];

export const OnboardingTutorial = ({ onComplete }: { onComplete: () => void }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  const currentStep = steps[step];
  const isLastStep = step === steps.length - 1;
  const isWelcome = step === 0;
  const selectedOptions = answers[currentStep.id] || [];

  const toggleOption = (option: string) => {
    if (currentStep.multiSelect) {
      setAnswers(prev => ({
        ...prev,
        [currentStep.id]: prev[currentStep.id]?.includes(option)
          ? prev[currentStep.id].filter(o => o !== option)
          : [...(prev[currentStep.id] || []), option]
      }));
    } else {
      setAnswers(prev => ({ ...prev, [currentStep.id]: [option] }));
    }
  };

  const canProceed = isWelcome || selectedOptions.length > 0;

  const handleNext = async () => {
    if (isLastStep) {
      setSaving(true);
      try {
        await supabase.from('profiles').update({
          extra_preferences: JSON.stringify(answers),
          onboarding_completed: true,
        }).eq('id', user!.id);
      } catch {}
      setSaving(false);
      setShowTutorial(true);
    } else {
      setStep(s => s + 1);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  if (showTutorial) {
    return <TutorialGuide answers={answers} onFinish={onComplete} navigate={navigate} />;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg mx-4 rounded-3xl overflow-hidden"
        style={{ background: 'hsl(230 25% 8%)', border: '1px solid hsl(0 0% 100% / 0.08)' }}
      >
        {/* Progress */}
        <div className="flex gap-1 px-6 pt-6">
          {steps.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= step ? 'bg-primary' : 'bg-muted/20'}`} />
          ))}
        </div>

        <div className="p-8">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              {isWelcome ? (
                <div className="text-center space-y-6 py-8">
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto shadow-xl shadow-primary/20">
                    <Sparkles className="w-10 h-10 text-primary-foreground" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-display font-bold text-foreground mb-2">{currentStep.title}</h1>
                    <p className="text-muted-foreground">{currentStep.subtitle}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    {[
                      { icon: Brain, label: '10 Brain Engines', desc: 'Science-backed learning' },
                      { icon: Target, label: 'Adaptive Tests', desc: 'AI-generated questions' },
                      { icon: Trophy, label: 'XP & Rewards', desc: 'Gamified progress' },
                    ].map(f => (
                      <div key={f.label} className="rounded-xl p-3" style={{ background: 'hsl(0 0% 100% / 0.03)', border: '1px solid hsl(0 0% 100% / 0.05)' }}>
                        <f.icon className="w-5 h-5 text-primary mx-auto mb-1" />
                        <p className="text-xs font-semibold text-foreground">{f.label}</p>
                        <p className="text-[10px] text-muted-foreground">{f.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                        <currentStep.icon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-xl font-display font-bold text-foreground">{currentStep.title}</h2>
                        <p className="text-sm text-muted-foreground">{currentStep.subtitle}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {currentStep.options?.map(option => {
                      const selected = selectedOptions.includes(option);
                      return (
                        <button key={option} onClick={() => toggleOption(option)}
                          className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center gap-3 ${
                            selected ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-card/30 border-border/10 text-muted-foreground hover:border-primary/20 hover:text-foreground'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${selected ? 'bg-primary border-primary' : 'border-border/30'}`}>
                            {selected && <CheckCircle2 className="w-3.5 h-3.5 text-primary-foreground" />}
                          </div>
                          <span className="text-sm font-medium">{option}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between mt-8">
            <div className="flex gap-2">
              {step > 0 && (
                <Button variant="ghost" onClick={() => setStep(s => s - 1)} className="rounded-xl">
                  <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </Button>
              )}
              <Button variant="ghost" onClick={handleSkip} className="text-muted-foreground text-sm rounded-xl">
                Skip
              </Button>
            </div>
            <Button onClick={handleNext} disabled={!canProceed || saving}
              className="gradient-primary text-primary-foreground rounded-xl px-6 shadow-lg shadow-primary/20"
            >
              {isLastStep ? (saving ? 'Saving...' : 'Get Started') : 'Continue'} <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// Tutorial Guide — shown after onboarding questions
// ═══════════════════════════════════════════════════════════════
const TutorialGuide = ({ answers, onFinish, navigate }: { answers: Record<string, string[]>; onFinish: () => void; navigate: (path: string) => void }) => {
  const [page, setPage] = useState(0);

  const exam = answers.exam?.[0] || 'your exams';
  const goal = answers.goal?.[0] || 'Ace my exams';
  const time = answers.time?.[0] || '2-4 hours';
  const style = answers.style?.[0] || 'Mixed approach';

  const pages = [
    {
      title: `Your ${exam} Journey Starts Here`,
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground leading-relaxed">Based on your answers, we've personalized Lumina for you. Here's how to get the most out of it:</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Target, label: 'Generate Tests', desc: `Create ${exam}-grade tests on any topic`, action: () => navigate('/tests') },
              { icon: Brain, label: 'Brain Hub', desc: '10 science-backed learning engines', action: () => navigate('/hub') },
              { icon: BookOpen, label: 'AI Chat', desc: 'Ask anything, get clear explanations', action: () => navigate('/chat') },
              { icon: Calendar, label: 'Study Planner', desc: `Plan your ${time} daily sessions`, action: () => navigate('/study-planner') },
            ].map(item => (
              <button key={item.label} onClick={item.action} className="text-left rounded-xl p-4 transition-all hover:scale-[1.02]" style={{ background: 'hsl(0 0% 100% / 0.03)', border: '1px solid hsl(0 0% 100% / 0.06)' }}>
                <item.icon className="w-5 h-5 text-primary mb-2" />
                <p className="text-sm font-semibold text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </button>
            ))}
          </div>
        </div>
      ),
    },
    {
      title: `How to ${goal}`,
      content: (
        <div className="space-y-4">
          <div className="rounded-xl p-4" style={{ background: 'hsl(174 72% 56% / 0.08)', border: '1px solid hsl(174 72% 56% / 0.15)' }}>
            <p className="text-sm text-primary font-semibold mb-1">💡 Your Learning Style: {style}</p>
            <p className="text-xs text-muted-foreground">We'll adapt our explanations, examples, and practice questions to match how you learn best.</p>
          </div>
          <div className="space-y-3">
            {[
              { step: '1', title: 'Generate a Test', desc: 'Pick any topic → Get instant, exam-grade questions with detailed explanations', icon: Target },
              { step: '2', title: 'Review & Learn', desc: 'After submitting, review explanations for every question — right or wrong', icon: BookOpen },
              { step: '3', title: 'Track Weaknesses', desc: 'Your Weakness Radar auto-updates. Focus on concepts that need work', icon: Brain },
              { step: '4', title: 'Level Up', desc: 'Earn XP and coins. Unlock new game modes and brain engines as you progress', icon: Trophy },
            ].map(s => (
              <div key={s.step} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                  <s.icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{s.title}</p>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      title: 'Your Daily Routine',
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground leading-relaxed">With {time} daily, here's a routine that maximizes retention:</p>
          <div className="space-y-2">
            {[
              { time: 'First 20%', label: 'Warm-up', desc: 'Quick review of yesterday\'s mistakes', color: 'bg-blue-500' },
              { time: 'Next 50%', label: 'Deep Study', desc: 'New concepts via AI Chat + Brain Hub', color: 'bg-primary' },
              { time: 'Next 20%', label: 'Practice', desc: 'Generate a test on today\'s topics', color: 'bg-secondary' },
              { time: 'Last 10%', label: 'Review', desc: 'Note down key takeaways in Smart Notebook', color: 'bg-emerald-500' },
            ].map((block, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${block.color} shrink-0`} />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{block.label}</span>
                    <span className="text-xs text-muted-foreground">{block.time}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{block.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-xl p-4 text-center" style={{ background: 'hsl(0 0% 100% / 0.03)', border: '1px solid hsl(0 0% 100% / 0.06)' }}>
            <Zap className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="text-sm font-semibold text-foreground">Pro Tip</p>
            <p className="text-xs text-muted-foreground">Use the Pomodoro timer in Brain Hub to stay focused. 25 min study → 5 min break.</p>
          </div>
        </div>
      ),
    },
  ];

  const currentPage = pages[page];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg mx-4 rounded-3xl overflow-hidden max-h-[90vh] overflow-y-auto"
        style={{ background: 'hsl(230 25% 8%)', border: '1px solid hsl(0 0% 100% / 0.08)' }}
      >
        <div className="p-8 space-y-6">
          <div className="flex gap-1">
            {pages.map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= page ? 'bg-primary' : 'bg-muted/20'}`} />
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={page} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 className="text-2xl font-display font-bold text-foreground mb-4">{currentPage.title}</h2>
              {currentPage.content}
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between">
            {page > 0 ? (
              <Button variant="ghost" onClick={() => setPage(p => p - 1)} className="rounded-xl">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
            ) : <div />}
            {page < pages.length - 1 ? (
              <Button onClick={() => setPage(p => p + 1)} className="gradient-primary text-primary-foreground rounded-xl px-6">
                Next <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={onFinish} className="gradient-primary text-primary-foreground rounded-xl px-6 shadow-lg shadow-primary/20">
                <Sparkles className="w-4 h-4 mr-2" /> Start Learning
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
