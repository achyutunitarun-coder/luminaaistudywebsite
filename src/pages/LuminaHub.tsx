import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Calendar, Shuffle, MessageSquare, HelpCircle,
  Eye, BarChart3, Send, Loader2, Sparkles, Lock,
  ChevronRight, Target, ArrowLeft, Flame, Trophy,
  TrendingUp, AlertTriangle, CheckCircle2, XCircle,
  RotateCcw, Zap, Crown, Rocket, Timer, GitBranch, BookOpen,
  Play, Pause, SkipForward, Settings2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { UpgradePopup } from '@/components/UpgradePopup';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { createBufferedTextAccumulator, streamSSE } from '@/lib/aiStream';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

type Module = {
  id: string;
  title: string;
  desc: string;
  icon: any;
  color: string;
  iconColor: string;
  bgGlow: string;
  freeLimit: string;
  feature: string;
  principle: string;
  hslGlow: string;
};

const modules: Module[] = [
  {
    id: 'recall', title: 'Recall Mode', desc: 'Active recall — force memory retrieval with adaptive difficulty',
    icon: Brain, color: 'from-violet-500/20 to-purple-500/20', iconColor: 'text-violet-400',
    bgGlow: 'shadow-violet-500/10', freeLimit: '20 questions/day', feature: 'recall_mode',
    principle: 'Retrieval Practice', hslGlow: 'hsl(264 67% 60% / 0.12)',
  },
  {
    id: 'spaced', title: 'Spaced Scheduler', desc: 'Optimal review intervals calibrated to your forgetting curve',
    icon: Calendar, color: 'from-blue-500/20 to-cyan-500/20', iconColor: 'text-blue-400',
    bgGlow: 'shadow-blue-500/10', freeLimit: '5 concepts/day', feature: 'spaced_scheduler',
    principle: 'Spaced Repetition', hslGlow: 'hsl(210 80% 50% / 0.12)',
  },
  {
    id: 'shuffle', title: 'Smart Shuffle', desc: 'Interleaved practice across topics for cognitive flexibility',
    icon: Shuffle, color: 'from-emerald-500/20 to-teal-500/20', iconColor: 'text-emerald-400',
    bgGlow: 'shadow-emerald-500/10', freeLimit: '2 topics/day', feature: 'smart_shuffle',
    principle: 'Interleaving', hslGlow: 'hsl(160 60% 45% / 0.12)',
  },
  {
    id: 'explain', title: 'Explain Mode', desc: 'Feynman technique — teach to truly learn',
    icon: MessageSquare, color: 'from-amber-500/20 to-orange-500/20', iconColor: 'text-amber-400',
    bgGlow: 'shadow-amber-500/10', freeLimit: '2 explanations/day', feature: 'explain_mode',
    principle: 'Feynman Technique', hslGlow: 'hsl(38 92% 50% / 0.12)',
  },
  {
    id: 'why', title: 'Why Engine', desc: 'Deep elaboration — 5 depth levels of understanding',
    icon: HelpCircle, color: 'from-rose-500/20 to-red-500/20', iconColor: 'text-rose-400',
    bgGlow: 'shadow-rose-500/10', freeLimit: '3 prompts/session', feature: 'why_engine',
    principle: 'Elaborative Interrogation', hslGlow: 'hsl(350 70% 50% / 0.12)',
  },
  {
    id: 'visualize', title: 'Visualize', desc: 'Dual coding — diagrams, maps & structured visuals',
    icon: Eye, color: 'from-indigo-500/20 to-violet-500/20', iconColor: 'text-indigo-400',
    bgGlow: 'shadow-indigo-500/10', freeLimit: '1 visual/day', feature: 'visualize_mode',
    principle: 'Dual Coding Theory', hslGlow: 'hsl(240 60% 60% / 0.12)',
  },
  {
    id: 'cognitive', title: 'Cognitive Dashboard', desc: 'Metacognition — track your brain\'s performance',
    icon: BarChart3, color: 'from-cyan-500/20 to-blue-500/20', iconColor: 'text-cyan-400',
    bgGlow: 'shadow-cyan-500/10', freeLimit: 'Last 7 days', feature: 'cognitive_dashboard',
    principle: 'Metacognition', hslGlow: 'hsl(190 80% 50% / 0.12)',
  },
  {
    id: 'pomodoro', title: 'Pomodoro Timer', desc: 'Structured focus sessions with smart breaks',
    icon: Timer, color: 'from-red-500/20 to-orange-500/20', iconColor: 'text-red-400',
    bgGlow: 'shadow-red-500/10', freeLimit: '5 sessions/day', feature: 'pomodoro_timer',
    principle: 'Time Blocking', hslGlow: 'hsl(0 72% 50% / 0.12)',
  },
  {
    id: 'mindmap', title: 'Mind Mapping', desc: 'AI generates structured mind maps from any topic',
    icon: GitBranch, color: 'from-teal-500/20 to-emerald-500/20', iconColor: 'text-teal-400',
    bgGlow: 'shadow-teal-500/10', freeLimit: '3 maps/day', feature: 'mind_mapping',
    principle: 'Visual Organization', hslGlow: 'hsl(174 72% 56% / 0.12)',
  },
  {
    id: 'sq3r', title: 'SQ3R Method', desc: 'Survey → Question → Read → Recite → Review',
    icon: BookOpen, color: 'from-purple-500/20 to-pink-500/20', iconColor: 'text-purple-400',
    bgGlow: 'shadow-purple-500/10', freeLimit: '2 sessions/day', feature: 'sq3r_method',
    principle: 'SQ3R Reading Strategy', hslGlow: 'hsl(280 60% 55% / 0.12)',
  },
];

const SYSTEM_PROMPTS: Record<string, string> = {
  recall: `You are a neurocognitively optimized Active Recall Engine inside Lumina Hub. Your goal is to MAXIMIZE long-term retention through retrieval practice.

CORE RULES:
1. NEVER show information before the user attempts recall
2. Generate questions that force memory retrieval (open-ended, fill-in-blank, scenario-based)
3. After each answer, evaluate: accuracy, depth, and identify gaps
4. Track a running "Memory Strength" score (0-100%) based on performance

DIFFICULTY ADAPTATION (Desirable Difficulty):
- If user answers correctly with high confidence → increase complexity immediately
- If user struggles → give MINIMAL hints (1-2 words), never full answers
- Maintain ~70-85% success rate (optimal learning zone)

ERROR-BASED LEARNING:
- Incorrect answers MUST reappear within the same session with different framing
- Always explain WHY the answer was wrong, compare correct vs incorrect reasoning
- After correction, require the user to re-explain in their own words

FORMAT:
📝 **Question [#N]** — Memory Strength: [X]%
[Clear, specific question]

After answer:
✅ or ❌ — [Brief evaluation]
🔍 **Key insight:** [What to remember]
💡 **Think deeper:** [Follow-up question]

Use LaTeX for math. Be encouraging but strict.`,

  spaced: `You are a Spaced Repetition Memory Engine inside Lumina Hub. You optimize review timing for maximum long-term retention.

MEMORY MODEL:
- Each concept has: Memory Strength (0-100%), Forgetting Probability, Optimal Review Time
- Intervals: Immediate → 1d → 3d → 7d → 14d → 30d
- Adjust dynamically based on: accuracy, confidence, recall speed

FORMAT:
📊 **Memory Status**
| Concept | Strength | Next Review | Risk |
[Table of concepts]

🧠 **Review Time:** [Question about due concept]
After answer: Update strength, show new interval.`,

  shuffle: `You are an Interleaving Practice Engine inside Lumina Hub. Mix questions across different topics the user provides (A→B→A→C→B pattern). NEVER follow predictable sequences. After each answer, highlight CROSS-TOPIC connections.

FORMAT:
🔀 **Mixed Session** — Topic: [Current]
[Question]

After answer:
🔗 **Connection:** How this relates to [other topic]
➡️ **Switch:** Now let's test [different topic]`,

  explain: `You are a Feynman Technique Coach inside Lumina Hub. Ask the user to explain a concept as if teaching a 5-year-old. Evaluate: Clarity /10, Accuracy /10, Completeness /10, Simplicity /10. REJECT shallow answers — demand deeper, simpler explanations. Highlight weak sentences with specific feedback.

FORMAT:
🎓 **Explain This:** [Concept]
After explanation:
📊 **Evaluation** with scores and specific feedback
⚠️ **Weak points** and 💡 **Try again** prompt`,

  why: `You are the Why Engine — an Elaboration Coach inside Lumina Hub. Continuously ask "Why?", "How?", "What if?" Track Elaboration Depth (Level 1-5).

DEPTH LEVELS:
- Level 1: Basic recall (What is it?)
- Level 2: Mechanism (How does it work?)
- Level 3: Causation (Why does it happen?)
- Level 4: Connections (How does it relate to X?)
- Level 5: Innovation (What if we changed X?)

FORMAT:
🧠 **Depth Level [N]/5**
❓ [Probing question]`,

  visualize: `You are a Dual Coding Visualization Engine inside Lumina Hub. Generate structured visual representations using ASCII diagrams, flowcharts, mind maps, and hierarchies. Use Unicode box-drawing characters for professional diagrams. After generating, ask the user to INTERPRET the visual.

FORMATS: Flowcharts with arrows (→, ↓), Mind maps with branches, Hierarchies, Comparison tables, Process diagrams.`,

  cognitive: `You are a Metacognition Analytics Engine inside Lumina Hub. Analyze: Accuracy trends, Recall speed patterns, Confidence vs correctness gaps, Weak vs strong topics, Forgetting risk prediction.

FORMAT:
📊 **Cognitive Report**
🎯 **Accuracy Overview** | 🧠 **Confidence Calibration** | ⚠️ **Forgetting Risk** | 💪 **Strengths** | 🎯 **Action Plan**`,

  mindmap: `You are a Mind Mapping Engine inside Lumina Hub. Generate structured, hierarchical mind maps from any topic.

RULES:
1. Create a central concept node
2. Branch into 4-6 main subtopics
3. Each subtopic has 2-4 sub-branches with key details
4. Use clear indentation and Unicode tree characters (├──, └──, │)
5. Add emoji icons for visual distinction
6. Keep labels concise (3-5 words max)
7. After generating, ask the user to add or modify branches

FORMAT:
🗺️ **Mind Map: [Topic]**

[Central Topic]
├── 🔵 [Subtopic 1]
│   ├── [Detail A]
│   ├── [Detail B]
│   └── [Detail C]
├── 🟢 [Subtopic 2]
│   ├── [Detail D]
│   └── [Detail E]
└── 🟡 [Subtopic 3]
    ├── [Detail F]
    └── [Detail G]

🤔 **Expand:** Which branch would you like to explore deeper?`,

  sq3r: `You are an SQ3R Reading Coach inside Lumina Hub. Guide the user through the SQ3R method step by step.

STEPS:
1. **Survey** — Ask the user to share their reading material/topic. Provide a quick overview structure.
2. **Question** — Generate 5-8 key questions the reader should answer while studying.
3. **Read** — Guide active reading with annotations and highlights strategy.
4. **Recite** — Test if the user can recall and explain key points without looking.
5. **Review** — Summarize, identify gaps, and create a review plan.

FORMAT:
📖 **SQ3R Step [N]/5: [Step Name]**
[Instructions and prompts for current step]

Track progress through all 5 steps. Be thorough but engaging. Use this method to ensure deep comprehension of any material.`,
};

// ─── Pomodoro Timer Component ───────────────────────────────
function PomodoroTimer({ onClose }: { onClose: () => void }) {
  const [workMinutes, setWorkMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [sessionsCompleted, setSessions] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isRunning && secondsLeft > 0) {
      intervalRef.current = setInterval(() => setSecondsLeft(s => s - 1), 1000);
    } else if (secondsLeft === 0) {
      if (!isBreak) {
        setSessions(s => s + 1);
        toast.success('Focus session complete! Take a break 🎉');
        setIsBreak(true);
        setSecondsLeft(breakMinutes * 60);
      } else {
        toast.info('Break over! Ready for another round? 💪');
        setIsBreak(false);
        setSecondsLeft(workMinutes * 60);
        setIsRunning(false);
      }
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, secondsLeft, isBreak, workMinutes, breakMinutes]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const totalSecs = isBreak ? breakMinutes * 60 : workMinutes * 60;
  const progress = ((totalSecs - secondsLeft) / totalSecs) * 100;

  const reset = () => {
    setIsRunning(false);
    setIsBreak(false);
    setSecondsLeft(workMinutes * 60);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex flex-col items-center justify-center"
    >
      <button onClick={onClose} className="absolute top-4 left-4 p-2 text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-5 h-5" />
      </button>

      <div className="text-center space-y-8 max-w-md w-full px-6">
        <div>
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center mx-auto mb-4">
            <Timer className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-2xl font-display font-bold text-foreground">
            {isBreak ? '☕ Break Time' : '🎯 Focus Session'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {sessionsCompleted} session{sessionsCompleted !== 1 ? 's' : ''} completed
          </p>
        </div>

        {/* Timer Ring */}
        <div className="relative w-56 h-56 mx-auto">
          <div className="absolute inset-0 rounded-full opacity-20 blur-xl" style={{ background: isBreak ? 'hsl(160 60% 45%)' : 'hsl(0 72% 50%)' }} />
          <svg className="w-full h-full -rotate-90 relative z-10" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(230 15% 16% / 0.5)" strokeWidth="4" />
            <motion.circle
              cx="50" cy="50" r="42" fill="none"
              stroke={isBreak ? 'hsl(160 60% 45%)' : 'hsl(0 72% 50%)'}
              strokeWidth="4" strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 42}`}
              animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - progress / 100) }}
              transition={{ duration: 0.5 }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
            <span className="text-5xl font-display font-bold text-foreground tabular-nums">
              {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </span>
            <span className="text-xs text-muted-foreground mt-2 uppercase tracking-wider">
              {isBreak ? 'Break' : 'Focus'}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          <Button onClick={reset} variant="outline" size="icon" className="rounded-xl w-12 h-12 border-border/20">
            <RotateCcw className="w-5 h-5" />
          </Button>
          <Button
            onClick={() => setIsRunning(!isRunning)}
            size="icon"
            className="rounded-2xl w-16 h-16 gradient-primary text-primary-foreground shadow-lg shadow-primary/20"
          >
            {isRunning ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
          </Button>
          <Button onClick={() => setShowSettings(!showSettings)} variant="outline" size="icon" className="rounded-xl w-12 h-12 border-border/20">
            <Settings2 className="w-5 h-5" />
          </Button>
        </div>

        {/* Settings */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="liquid-glass rounded-2xl p-5 space-y-4"
            >
              <div>
                <label className="text-xs font-medium text-foreground mb-2 block">Focus: {workMinutes} min</label>
                <Slider value={[workMinutes]} onValueChange={([v]) => { setWorkMinutes(v); if (!isRunning && !isBreak) setSecondsLeft(v * 60); }} min={5} max={60} step={5} />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground mb-2 block">Break: {breakMinutes} min</label>
                <Slider value={[breakMinutes]} onValueChange={([v]) => setBreakMinutes(v)} min={1} max={15} step={1} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── AI Session Component ───────────────────────────────
function HubSession({ module, onClose }: { module: Module; onClose: () => void }) {
  const { user, session } = useAuth();
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [topic, setTopic] = useState('');
  const [confidence, setConfidence] = useState([50]);
  const [isLoading, setIsLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [memoryStrength, setMemoryStrength] = useState(50);
  const [elaborationDepth, setElaborationDepth] = useState(1);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: isLoading ? 'auto' : 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === 'assistant') {
      const content = lastMsg.content;
      if (content.includes('✅')) setCorrectCount(c => c + 1);
      if (content.includes('✅') || content.includes('❌')) setQuestionCount(c => c + 1);
      const strengthMatch = content.match(/Memory Strength:\s*(\d+)%/);
      if (strengthMatch) setMemoryStrength(parseInt(strengthMatch[1]));
      const depthMatch = content.match(/Depth Level\s*\[?(\d)\]?/);
      if (depthMatch) setElaborationDepth(parseInt(depthMatch[1]));
    }
  }, [messages]);

  const sendToAI = useCallback(async (userMessage: string) => {
    if (!user) return;
    setIsLoading(true);

    const allMessages = [
      ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: userMessage },
    ];

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: allMessages,
          systemPrompt: SYSTEM_PROMPTS[module.id],
          mode: 'study',
        }),
      });

      if (!resp.ok) {
        if (resp.status === 429) throw new Error('Rate limit exceeded. Please wait a moment and try again.');
        throw new Error('Failed');
      }

      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      const streamBuffer = createBufferedTextAccumulator((text) => {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: text };
          return updated;
        });
      });

      await streamSSE(resp, {
        onDelta: (chunk) => streamBuffer.push(chunk),
      });

      streamBuffer.flushNow();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Connection failed. Please try again.');
    }
    setIsLoading(false);
  }, [user, messages, module.id, session]);

  const startSession = () => {
    if (!topic.trim()) return;
    setStarted(true);
    let msg = `Topic: ${topic}.`;
    if (module.id === 'recall') {
      msg += ` My confidence level: ${confidence[0]}%. Start with an active recall question.`;
    } else if (module.id === 'spaced') {
      msg += ` Create a spaced repetition schedule. Start by testing what I currently remember.`;
    } else if (module.id === 'shuffle') {
      msg += ` I want to practice interleaved learning. Mix questions unpredictably.`;
    } else if (module.id === 'explain') {
      msg += ` Ask me to explain this concept using the Feynman Technique.`;
    } else if (module.id === 'why') {
      msg += ` Start the Why Engine. Push me to elaborate deeply. Begin at Depth Level 1.`;
    } else if (module.id === 'visualize') {
      msg += ` Generate a visual representation (diagram/flowchart/mind map) and ask me to interpret it.`;
    } else if (module.id === 'cognitive') {
      msg += ` Analyze my learning patterns. Ask me questions to build a cognitive profile.`;
    } else if (module.id === 'mindmap') {
      msg += ` Generate a comprehensive, structured mind map for this topic with branches and sub-branches.`;
    } else if (module.id === 'sq3r') {
      msg += ` Guide me through the SQ3R method for this topic. Start with Step 1: Survey.`;
    }
    setMessages([{ role: 'user', content: msg }]);
    sendToAI(msg);
  };

  const sendReply = () => {
    if (!input.trim() || isLoading) return;
    const msg = module.id === 'recall' ? `${input.trim()} [Confidence: ${confidence[0]}%]` : input.trim();
    setMessages(prev => [...prev, { role: 'user', content: input.trim() }]);
    setInput('');
    sendToAI(msg);
  };

  const Icon = module.icon;
  const accuracy = questionCount > 0 ? Math.round((correctCount / questionCount) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex flex-col"
    >
      {/* Header */}
      <div className="border-b border-border/10">
        <div className="h-14 flex items-center px-4 md:px-6 gap-3">
          <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${module.color} flex items-center justify-center`}>
            <Icon className={`w-4 h-4 ${module.iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-foreground">{module.title}</h2>
            <p className="text-[10px] text-muted-foreground truncate">{module.principle}</p>
          </div>
          {started && (
            <div className="hidden sm:flex items-center gap-4 text-xs">
              {module.id === 'recall' && (
                <>
                  <div className="flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-primary" />
                    <span className="text-muted-foreground">Accuracy:</span>
                    <span className={`font-bold ${accuracy >= 70 ? 'text-emerald-400' : accuracy >= 40 ? 'text-amber-400' : 'text-rose-400'}`}>{accuracy}%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Brain className="w-3.5 h-3.5 text-violet-400" />
                    <span className="text-muted-foreground">Memory:</span>
                    <span className="font-bold text-violet-400">{memoryStrength}%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-muted-foreground">Q:</span>
                    <span className="font-bold text-foreground">{questionCount}</span>
                  </div>
                </>
              )}
              {module.id === 'why' && (
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-rose-400" />
                  <span className="text-muted-foreground">Depth:</span>
                  <span className="font-bold text-rose-400">Level {elaborationDepth}/5</span>
                </div>
              )}
            </div>
          )}
        </div>
        {started && module.id === 'recall' && (
          <div className="px-4 md:px-6 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">Memory</span>
              <Progress value={memoryStrength} className="h-1.5 flex-1" />
              <span className="text-[10px] font-medium text-foreground">{memoryStrength}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      {!started ? (
        <div className="flex-1 flex items-center justify-center px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg w-full">
            <div className="text-center mb-8">
              <div className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${module.color} flex items-center justify-center mx-auto mb-6 shadow-2xl ${module.bgGlow}`}>
                <Icon className={`w-10 h-10 ${module.iconColor}`} />
              </div>
              <h2 className="text-2xl font-display font-bold text-foreground mb-2">{module.title}</h2>
              <p className="text-sm text-muted-foreground mb-1">{module.desc}</p>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                Based on: {module.principle}
              </span>
            </div>

            <div className="liquid-glass rounded-2xl p-6 space-y-5">
              <div>
                <label className="text-xs font-medium text-foreground mb-2 block">What do you want to study?</label>
                <Input
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  placeholder="e.g., Photosynthesis, Calculus, World War II"
                  className="h-12 rounded-xl"
                  onKeyDown={e => e.key === 'Enter' && startSession()}
                />
              </div>

              {module.id === 'recall' && (
                <div>
                  <label className="text-xs font-medium text-foreground mb-2 block">
                    Current confidence: <span className="text-primary">{confidence[0]}%</span>
                  </label>
                  <Slider value={confidence} onValueChange={setConfidence} max={100} step={5} className="w-full" />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>No idea</span><span>Somewhat</span><span>Very confident</span>
                  </div>
                </div>
              )}

              <Button onClick={startSession} disabled={!topic.trim()} className="w-full h-12 rounded-2xl gradient-primary text-primary-foreground font-semibold text-base">
                <Sparkles className="w-4 h-4 mr-2" /> Start Session
              </Button>
            </div>
          </motion.div>
        </div>
      ) : (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-auto px-4 md:px-6 py-4 space-y-4">
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-1 ${
                  msg.role === 'user' ? 'gradient-primary text-primary-foreground' : 'liquid-glass-subtle'
                }`}>
                  {msg.role === 'user' ? <Target className="w-3.5 h-3.5" /> : <Sparkles className={`w-3.5 h-3.5 ${module.iconColor}`} />}
                </div>
                <div className={`max-w-[85%] min-w-0 rounded-2xl px-4 py-3 ${
                  msg.role === 'user' ? 'gradient-primary text-primary-foreground rounded-tr-md' : 'liquid-glass rounded-tl-md'
                }`}>
                  <div className="text-sm max-w-none">
                    <MarkdownRenderer streaming={isLoading && msg.role === 'assistant' && i === messages.length - 1}>{msg.content}</MarkdownRenderer>
                  </div>
                </div>
              </motion.div>
            ))}
            {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-lg liquid-glass-subtle flex items-center justify-center">
                  <Sparkles className={`w-3.5 h-3.5 ${module.iconColor}`} />
                </div>
                <div className="rounded-2xl rounded-tl-md liquid-glass px-5 py-3">
                  <div className="flex items-center gap-1.5">
                    {[0, 1, 2].map(j => (
                      <motion.span key={j} className="w-2 h-2 rounded-full bg-muted-foreground/30"
                        animate={{ y: [0, -5, 0] }}
                        transition={{ duration: 0.8, repeat: Infinity, delay: j * 0.15 }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-border/10">
            {module.id === 'recall' && (
              <div className="mb-3 flex items-center gap-3">
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">Confidence: {confidence[0]}%</span>
                <Slider value={confidence} onValueChange={setConfidence} max={100} step={5} className="flex-1" />
              </div>
            )}
            <div className="flex items-center gap-2 liquid-glass rounded-2xl px-3 py-1.5">
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={
                  module.id === 'recall' ? 'Type your answer...' :
                  module.id === 'explain' ? 'Explain the concept in your own words...' :
                  module.id === 'why' ? 'Go deeper — explain why...' :
                  'Type your response...'
                }
                className="border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 h-10 text-sm px-0"
                onKeyDown={e => e.key === 'Enter' && sendReply()}
              />
              <Button onClick={sendReply} disabled={isLoading || !input.trim()} size="icon" className="h-8 w-8 rounded-xl gradient-primary text-primary-foreground shrink-0">
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}

// ─── Floating Particles ───────────────────────────────
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: Math.random() * 4 + 2,
            height: Math.random() * 4 + 2,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            background: i % 3 === 0
              ? 'hsl(174 72% 56% / 0.3)'
              : i % 3 === 1
              ? 'hsl(264 67% 60% / 0.3)'
              : 'hsl(47 100% 62% / 0.2)',
          }}
          animate={{
            y: [0, -30 - Math.random() * 40, 0],
            x: [0, Math.random() * 20 - 10, 0],
            opacity: [0.2, 0.6, 0.2],
            scale: [1, 1.5, 1],
          }}
          transition={{
            duration: 4 + Math.random() * 4,
            repeat: Infinity,
            delay: Math.random() * 3,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// ─── Main Hub Page ───────────────────────────────
const LuminaHub = () => {
  const { isPro, isProPlus } = useSubscription();
  const { checkAndIncrement, showUpgrade, setShowUpgrade } = useUsageLimits();
  const [activeModule, setActiveModule] = useState<Module | null>(null);
  const [showPomodoro, setShowPomodoro] = useState(false);
  const navigate = useNavigate();

  const hasFullHubAccess = isProPlus;

  const openModule = async (mod: Module) => {
    // Pomodoro is a standalone timer, not AI
    if (mod.id === 'pomodoro') {
      if (!hasFullHubAccess) {
        const allowed = await checkAndIncrement(mod.feature);
        if (!allowed) return;
      }
      setShowPomodoro(true);
      return;
    }
    if (hasFullHubAccess) {
      setActiveModule(mod);
      return;
    }
    const allowed = await checkAndIncrement(mod.feature);
    if (!allowed) return;
    setActiveModule(mod);
  };

  return (
    <div className="max-w-6xl mx-auto relative">
      <UpgradePopup open={showUpgrade} onClose={() => setShowUpgrade(false)} />

      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, hsl(264 67% 60% / 0.08), transparent 70%)', top: '-10%', right: '-15%' }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, hsl(174 72% 56% / 0.06), transparent 70%)', bottom: '-5%', left: '-10%' }}
          animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        />
      </div>

      {/* Hero Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10 relative">
        <FloatingParticles />
        <div className="relative z-10 text-center py-8">
          <motion.div
            className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-violet-500/30 via-purple-500/20 to-indigo-500/30 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-violet-500/20 border border-violet-500/20"
            animate={{ boxShadow: ['0 0 30px hsl(264 67% 60% / 0.2)', '0 0 60px hsl(264 67% 60% / 0.4)', '0 0 30px hsl(264 67% 60% / 0.2)'] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Brain className="w-12 h-12 text-violet-400" />
          </motion.div>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground tracking-tight mb-3">
            <span className="text-gradient-animated">Lumina Hub</span>
          </h1>
          <p className="text-muted-foreground text-sm md:text-base max-w-lg mx-auto leading-relaxed">
            Your neurocognitive brain gym — <span className="text-primary font-semibold">10 science-backed engines</span> to supercharge learning
          </p>

          {/* Value proposition badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
            {['Active Recall', 'Spaced Repetition', 'Feynman Method', 'Interleaving', 'SQ3R'].map((tech, i) => (
              <motion.span
                key={tech}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + i * 0.08 }}
                className="text-[10px] px-2.5 py-1 rounded-full border border-primary/15 bg-primary/5 text-primary/80 font-medium"
              >
                {tech}
              </motion.span>
            ))}
          </div>
        </div>

        {/* PRO+ upsell */}
        {!hasFullHubAccess && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-2 rounded-2xl border border-violet-500/20 liquid-glass-intense p-5 flex items-center justify-between gap-4 max-w-xl mx-auto"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center shrink-0">
                <Crown className="w-6 h-6 text-violet-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">Unlock Full Brain Power</p>
                <p className="text-[11px] text-muted-foreground">
                  10 science-backed engines · Unlimited sessions · ₹499/mo
                </p>
              </div>
            </div>
            <Button
              onClick={() => navigate('/upgrade')}
              size="sm"
              className="shrink-0 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 text-primary-foreground text-xs font-semibold hover:opacity-90 px-5"
            >
              <Rocket className="w-3.5 h-3.5 mr-1.5" /> Upgrade
            </Button>
          </motion.div>
        )}
      </motion.div>

      {/* Neural Learning Loop */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mb-10 liquid-glass-intense rounded-2xl p-5 border border-border/10 relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-violet-500/5 via-transparent to-primary/5 pointer-events-none" />
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-[0.15em] mb-3 relative z-10">Neural Learning Loop</p>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-[11px] relative z-10">
          {['Encode', 'Retrieve', 'Struggle', 'Correct', 'Reinforce', 'Space', 'Mix', 'Reflect'].map((step, i) => (
            <motion.span
              key={step}
              className="flex items-center gap-2 whitespace-nowrap"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.05 }}
            >
              <span className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-primary/15 to-accent/10 text-primary font-semibold border border-primary/10 shadow-sm shadow-primary/5">
                {step}
              </span>
              {i < 7 && <span className="text-primary/30">→</span>}
            </motion.span>
          ))}
        </div>
      </motion.div>

      {/* Module Grid — 10 modules */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {modules.map((mod, i) => {
          const Icon = mod.icon;
          return (
            <motion.button
              key={mod.id}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.2 + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ scale: 1.04, y: -6 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => openModule(mod)}
              className="text-left rounded-3xl liquid-glass-elevated p-6 border border-border/10 hover:border-primary/25 transition-all duration-500 group relative overflow-hidden"
            >
              {/* Hover glow */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: `radial-gradient(circle at 30% 30%, ${mod.hslGlow}, transparent 70%)` }}
              />

              <div className={`relative z-10 w-14 h-14 rounded-2xl bg-gradient-to-br ${mod.color} flex items-center justify-center mb-5 group-hover:scale-110 group-hover:shadow-lg transition-all duration-500 border border-border/5`}>
                <Icon className={`w-7 h-7 ${mod.iconColor}`} />
              </div>

              {/* Science-backed badge */}
              <div className="relative z-10 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 text-[9px] font-bold uppercase tracking-wider mb-3">
                <Zap className="w-2.5 h-2.5" /> Science-backed
              </div>

              <h3 className="relative z-10 text-lg font-display font-bold text-foreground mb-1.5 group-hover:text-primary transition-colors duration-300">{mod.title}</h3>
              <p className="relative z-10 text-xs text-muted-foreground/80 mb-3 leading-relaxed">{mod.desc}</p>
              <span className="relative z-10 text-[10px] px-2.5 py-1 rounded-full bg-primary/8 text-primary/70 border border-primary/10 font-medium">
                {mod.principle}
              </span>
              {!hasFullHubAccess && (
                <span className="relative z-10 block mt-2.5 text-[10px] px-2.5 py-1 rounded-full bg-warning/10 text-warning border border-warning/15 w-fit font-medium">
                  Free: {mod.freeLimit}
                </span>
              )}
              <ChevronRight className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/15 group-hover:text-primary/60 transition-all duration-300 group-hover:translate-x-1.5" />
            </motion.button>
          );
        })}
      </div>

      {/* Active Session Overlays */}
      <AnimatePresence>
        {activeModule && (
          <HubSession module={activeModule} onClose={() => setActiveModule(null)} />
        )}
        {showPomodoro && (
          <PomodoroTimer onClose={() => setShowPomodoro(false)} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default LuminaHub;
