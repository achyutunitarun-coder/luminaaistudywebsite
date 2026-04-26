import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GraduationCap, User, Megaphone, BookOpen, Target, ArrowRight, Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const ease = [0.25, 0.1, 0.25, 1] as const;

const ROLES = [
  { id: 'school', label: 'School Student', icon: '🎒', desc: 'Primary or secondary school' },
  { id: 'college', label: 'College Student', icon: '🎓', desc: 'University or higher education' },
  { id: 'self', label: 'Self Learner', icon: '🧠', desc: 'Learning independently' },
  { id: 'professional', label: 'Professional', icon: '💼', desc: 'Upskilling or career growth' },
];

const SOURCES = [
  { id: 'friend', label: 'Friend', icon: '👥' },
  { id: 'youtube', label: 'YouTube', icon: '📺' },
  { id: 'instagram', label: 'Instagram', icon: '📸' },
  { id: 'school', label: 'School', icon: '🏫' },
  { id: 'search', label: 'Google Search', icon: '🔍' },
  { id: 'other', label: 'Other', icon: '✨' },
];

const SUBJECTS = [
  { id: 'mathematics', label: 'Mathematics', color: 'from-purple-500/20 to-indigo-500/20', icon: '📐' },
  { id: 'physics', label: 'Physics', color: 'from-blue-500/20 to-cyan-500/20', icon: '⚛️' },
  { id: 'chemistry', label: 'Chemistry', color: 'from-green-500/20 to-emerald-500/20', icon: '🧪' },
  { id: 'biology', label: 'Biology', color: 'from-teal-500/20 to-green-500/20', icon: '🧬' },
  { id: 'cs', label: 'Computer Science', color: 'from-slate-500/20 to-gray-500/20', icon: '💻' },
  { id: 'english', label: 'English', color: 'from-amber-500/20 to-yellow-500/20', icon: '📝' },
  { id: 'history', label: 'History', color: 'from-orange-500/20 to-red-500/20', icon: '📜' },
  { id: 'economics', label: 'Economics', color: 'from-emerald-500/20 to-teal-500/20', icon: '📊' },
  { id: 'geography', label: 'Geography', color: 'from-sky-500/20 to-blue-500/20', icon: '🌍' },
  { id: 'literature', label: 'Literature', color: 'from-rose-500/20 to-pink-500/20', icon: '📚' },
  { id: 'business', label: 'Business Studies', color: 'from-violet-500/20 to-purple-500/20', icon: '💹' },
  { id: 'psychology', label: 'Psychology', color: 'from-pink-500/20 to-rose-500/20', icon: '🧠' },
];

const GOALS = [
  { id: 'exams', label: 'Ace my exams', icon: '🎯', desc: 'Exam preparation & test scores' },
  { id: 'mastery', label: 'Master concepts', icon: '🧠', desc: 'Deep understanding of subjects' },
  { id: 'revision', label: 'Quick revision', icon: '⚡', desc: 'Refresh and review material' },
  { id: 'practice', label: 'Practice questions', icon: '📝', desc: 'Solve problems & quizzes' },
];

interface OnboardingProps {
  onComplete: () => void;
}

const Onboarding = ({ onComplete }: OnboardingProps) => {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [role, setRole] = useState('');
  const [source, setSource] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [goal, setGoal] = useState('');

  const toggleSubject = (id: string) => {
    setSubjects(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const handleNext = () => {
    if (isLast) {
      handleComplete();
    } else {
      setStep(s => s + 1);
    }
  };

  const handleComplete = async () => {
    try {
      await supabase.from('profiles').update({
        extra_preferences: JSON.stringify({ role, source, subjects, goal, onboarded: true }),
      }).eq('user_id', user!.id);
    } catch {}
    onComplete();
  };

  const steps = [
    // Step 0: Role
    () => (
      <div className="space-y-6">
        <div className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 15 }}
            className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4"
          >
            <User className="w-8 h-8 text-primary" />
          </motion.div>
          <h2 className="text-2xl font-display font-bold text-foreground">Who are you?</h2>
          <p className="text-muted-foreground text-sm mt-1">Help us personalize your experience</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {ROLES.map((r, i) => (
            <motion.button
              key={r.id}
              type="button"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, ease }}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setRole(r.id)}
              className={`relative p-4 rounded-2xl border text-left transition-all duration-300 ${
                role === r.id
                  ? 'border-primary/50 bg-primary/10 shadow-lg shadow-primary/10'
                  : 'border-border/30 bg-card/30 hover:border-primary/20'
              }`}
            >
              <span className="text-2xl block mb-2">{r.icon}</span>
              <p className="font-semibold text-foreground text-sm">{r.label}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{r.desc}</p>
              {role === r.id && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-2 right-2">
                  <Check className="w-4 h-4 text-primary" />
                </motion.div>
              )}
            </motion.button>
          ))}
        </div>
      </div>
    ),
    // Step 1: Discovery
    () => (
      <div className="space-y-6">
        <div className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 15 }}
            className="w-16 h-16 rounded-2xl bg-secondary/10 flex items-center justify-center mx-auto mb-4"
          >
            <Megaphone className="w-8 h-8 text-secondary" />
          </motion.div>
          <h2 className="text-2xl font-display font-bold text-foreground">How did you find us?</h2>
          <p className="text-muted-foreground text-sm mt-1">We'd love to know</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {SOURCES.map((s, i) => (
            <motion.button
              key={s.id}
              type="button"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05, ease }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSource(s.id)}
              className={`p-3 rounded-2xl border text-center transition-all duration-300 ${
                source === s.id
                  ? 'border-secondary/50 bg-secondary/10'
                  : 'border-border/30 bg-card/30 hover:border-secondary/20'
              }`}
            >
              <span className="text-xl block mb-1">{s.icon}</span>
              <p className="text-xs font-medium text-foreground">{s.label}</p>
            </motion.button>
          ))}
        </div>
      </div>
    ),
    // Step 2: Subjects
    () => (
      <div className="space-y-6">
        <div className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 15 }}
            className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4"
          >
            <BookOpen className="w-8 h-8 text-primary" />
          </motion.div>
          <h2 className="text-2xl font-display font-bold text-foreground">What do you study?</h2>
          <p className="text-muted-foreground text-sm mt-1">Select all that apply</p>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {SUBJECTS.map((s, i) => (
            <motion.button
              key={s.id}
              type="button"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, ease }}
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => toggleSubject(s.id)}
              className={`p-3 rounded-2xl border text-center transition-all duration-300 relative overflow-hidden ${
                subjects.includes(s.id)
                  ? 'border-primary/50 bg-primary/10 shadow-md shadow-primary/10'
                  : 'border-border/30 bg-card/30 hover:border-primary/20'
              }`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${s.color} opacity-50`} />
              <div className="relative">
                <span className="text-lg block mb-1">{s.icon}</span>
                <p className="text-[11px] font-medium text-foreground">{s.label}</p>
              </div>
              {subjects.includes(s.id) && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-1.5 right-1.5">
                  <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-primary-foreground" />
                  </div>
                </motion.div>
              )}
            </motion.button>
          ))}
        </div>
      </div>
    ),
    // Step 3: Goal
    () => (
      <div className="space-y-6">
        <div className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 15 }}
            className="w-16 h-16 rounded-2xl bg-xp/10 flex items-center justify-center mx-auto mb-4"
          >
            <Target className="w-8 h-8 text-xp" />
          </motion.div>
          <h2 className="text-2xl font-display font-bold text-foreground">What's your goal?</h2>
          <p className="text-muted-foreground text-sm mt-1">We'll tailor your experience</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {GOALS.map((g, i) => (
            <motion.button
              key={g.id}
              type="button"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, ease }}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setGoal(g.id)}
              className={`p-4 rounded-2xl border text-left transition-all duration-300 ${
                goal === g.id
                  ? 'border-xp/50 bg-xp/10 shadow-lg shadow-xp/10'
                  : 'border-border/30 bg-card/30 hover:border-xp/20'
              }`}
            >
              <span className="text-2xl block mb-2">{g.icon}</span>
              <p className="font-semibold text-foreground text-sm">{g.label}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{g.desc}</p>
            </motion.button>
          ))}
        </div>
      </div>
    ),
  ];

  const canProceed = [
    !!role,
    !!source,
    subjects.length > 0,
    !!goal,
  ][step];

  const isLast = step === steps.length - 1;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-background flex items-center justify-center overflow-auto p-4"
    >
      {/* Ambient bg */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          animate={{ x: [0, 20, -10, 0], y: [0, -15, 20, 0] }}
          transition={{ duration: 20, repeat: Infinity }}
          className="absolute top-1/4 left-1/3 w-[400px] h-[400px] rounded-full bg-primary/[0.03] blur-[100px]"
        />
        <motion.div
          animate={{ x: [0, -20, 10, 0], y: [0, 15, -20, 0] }}
          transition={{ duration: 25, repeat: Infinity }}
          className="absolute bottom-1/4 right-1/3 w-[350px] h-[350px] rounded-full bg-secondary/[0.03] blur-[80px]"
        />
      </div>

      <div className="relative z-10 w-full max-w-lg">
        {/* Progress */}
        <div className="flex gap-2 mb-8 px-4">
          {steps.map((_, i) => (
            <motion.div
              key={i}
              className="h-1.5 rounded-full flex-1 overflow-hidden bg-muted/30"
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: i <= step ? '100%' : '0%' }}
                transition={{ duration: 0.5, ease }}
                className="h-full rounded-full gradient-primary"
              />
            </motion.div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 40, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -40, scale: 0.96 }}
            transition={{ duration: 0.35, ease }}
          >
            {steps[step]()}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-8 flex justify-between items-center px-4"
        >
          <button
            type="button"
            onClick={() => step > 0 && setStep(step - 1)}
            className={`text-sm text-muted-foreground hover:text-foreground transition-colors ${step === 0 ? 'invisible' : ''}`}
          >
            Back
          </button>
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Button
              type="button"
              onClick={handleNext}
              disabled={!canProceed}
              className="h-11 px-6 rounded-2xl gradient-primary text-primary-foreground shadow-lg shadow-primary/20"
            >
              {isLast ? (
                <>
                  Get Started <Sparkles className="w-4 h-4 ml-2" />
                </>
              ) : (
                <>
                  Continue <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default Onboarding;
