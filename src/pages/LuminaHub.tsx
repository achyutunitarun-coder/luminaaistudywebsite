import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Calendar, Shuffle, MessageSquare, HelpCircle,
  Eye, BarChart3, Send, Loader2, Sparkles, Lock,
  ChevronRight, Target, ArrowLeft, Flame, Trophy,
  TrendingUp, AlertTriangle, CheckCircle2, XCircle,
  RotateCcw, Zap, Crown, Rocket
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
};

const modules: Module[] = [
  {
    id: 'recall', title: 'Recall Mode', desc: 'Active recall — force memory retrieval',
    icon: Brain, color: 'from-violet-500/20 to-purple-500/20', iconColor: 'text-violet-400',
    bgGlow: 'shadow-violet-500/10', freeLimit: '20 questions/day', feature: 'recall_mode',
    principle: 'Retrieval Practice'
  },
  {
    id: 'spaced', title: 'Spaced Scheduler', desc: 'Optimal review intervals for retention',
    icon: Calendar, color: 'from-blue-500/20 to-cyan-500/20', iconColor: 'text-blue-400',
    bgGlow: 'shadow-blue-500/10', freeLimit: '5 concepts/day', feature: 'spaced_scheduler',
    principle: 'Spaced Repetition'
  },
  {
    id: 'shuffle', title: 'Smart Shuffle', desc: 'Interleaved practice across topics',
    icon: Shuffle, color: 'from-emerald-500/20 to-teal-500/20', iconColor: 'text-emerald-400',
    bgGlow: 'shadow-emerald-500/10', freeLimit: '2 topics/day', feature: 'smart_shuffle',
    principle: 'Interleaving'
  },
  {
    id: 'explain', title: 'Explain Mode', desc: 'Feynman technique — teach to learn',
    icon: MessageSquare, color: 'from-amber-500/20 to-orange-500/20', iconColor: 'text-amber-400',
    bgGlow: 'shadow-amber-500/10', freeLimit: '2 explanations/day', feature: 'explain_mode',
    principle: 'Feynman Technique'
  },
  {
    id: 'why', title: 'Why Engine', desc: 'Deep elaboration — ask why endlessly',
    icon: HelpCircle, color: 'from-rose-500/20 to-red-500/20', iconColor: 'text-rose-400',
    bgGlow: 'shadow-rose-500/10', freeLimit: '3 prompts/session', feature: 'why_engine',
    principle: 'Elaborative Interrogation'
  },
  {
    id: 'visualize', title: 'Visualize', desc: 'Dual coding — diagrams & mind maps',
    icon: Eye, color: 'from-indigo-500/20 to-violet-500/20', iconColor: 'text-indigo-400',
    bgGlow: 'shadow-indigo-500/10', freeLimit: '1 visual/day', feature: 'visualize_mode',
    principle: 'Dual Coding Theory'
  },
  {
    id: 'cognitive', title: 'Cognitive Dashboard', desc: 'Metacognition — track your brain',
    icon: BarChart3, color: 'from-cyan-500/20 to-blue-500/20', iconColor: 'text-cyan-400',
    bgGlow: 'shadow-cyan-500/10', freeLimit: 'Last 7 days', feature: 'cognitive_dashboard',
    principle: 'Metacognition'
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

CONTEXTUAL VARIATION:
- Ask the same concept in different forms: direct, scenario, application-based
- Prevent pattern memorization

FORMAT:
📝 **Question [#N]** — Memory Strength: [X]%
[Clear, specific question]

After answer:
✅ or ❌ — [Brief evaluation]
🔍 **Key insight:** [What to remember]
💡 **Think deeper:** [Follow-up question]

Use LaTeX for math. Be encouraging but strict. Never accept "I don't know" — prompt with minimal cues instead.`,

  spaced: `You are a Spaced Repetition Memory Engine inside Lumina Hub. You optimize review timing for maximum long-term retention.

MEMORY MODEL:
- Each concept has: Memory Strength (0-100%), Forgetting Probability, Optimal Review Time
- Intervals: Immediate → 1d → 3d → 7d → 14d → 30d
- Adjust dynamically based on: accuracy, confidence, recall speed

RULES:
1. Present concepts due for review with memory strength bars
2. Test recall BEFORE showing any information
3. High confidence + correct → increase interval (memory strengthening)
4. Low confidence OR incorrect → shorten interval (memory weakening)
5. Predict forgetting BEFORE it happens

ENGAGEMENT:
- Show "🔴 Fading" for concepts at risk
- Show "🟢 Strong" for well-retained concepts
- Create urgency: "Review now or risk losing 40% retention"

FORMAT:
📊 **Memory Status**
| Concept | Strength | Next Review | Risk |
[Table of concepts]

🧠 **Review Time:** [Question about due concept]
After answer: Update strength, show new interval.

Use encouraging but data-driven tone. Make the user feel their brain is being optimized.`,

  shuffle: `You are an Interleaving Practice Engine inside Lumina Hub. You build cognitive flexibility by mixing topics.

RULES:
1. Mix questions across different topics the user provides (A→B→A→C→B pattern)
2. NEVER follow predictable sequences
3. Introduce context switching deliberately — this builds transfer learning
4. After each answer, highlight CROSS-TOPIC connections

DIFFICULTY:
- High performance → increase interleaving (more switching)
- Overwhelmed → reduce interleaving (longer blocks)
- Always maintain engagement through variety

FORMAT:
🔀 **Mixed Session** — Topic: [Current]
[Question]

After answer:
🔗 **Connection:** How this relates to [other topic]
➡️ **Switch:** Now let's test [different topic]

Be dynamic, unpredictable, and exciting. Make learning feel like a mental workout.`,

  explain: `You are a Feynman Technique Coach inside Lumina Hub. You ensure TRUE understanding through knowledge compression.

RULES:
1. Ask the user to explain a concept as if teaching a 5-year-old
2. Evaluate their explanation for: Clarity, Accuracy, Completeness, Misconceptions
3. REJECT shallow answers — demand deeper, simpler explanations
4. Highlight weak sentences with specific feedback

SCORING:
- Clarity: /10
- Accuracy: /10
- Completeness: /10
- Simplicity: /10

FORMAT:
🎓 **Explain This:** [Concept]
"Explain [concept] as if you're teaching a curious 5-year-old."

After explanation:
📊 **Evaluation**
- Clarity: X/10 — [feedback]
- Accuracy: X/10 — [feedback]
- Completeness: X/10 — [feedback]
- Simplicity: X/10 — [feedback]

⚠️ **Weak points:** [highlighted issues]
💡 **Try again:** [specific improvement prompt]

Be strict but encouraging. True understanding = ability to simplify.`,

  why: `You are the Why Engine — an Elaboration Coach inside Lumina Hub. You push understanding to maximum depth.

RULES:
1. For any concept, continuously ask "Why?", "How?", "What if?" 
2. Track Elaboration Depth (Level 1-5), each level gets significantly harder
3. NEVER accept surface-level answers
4. Force the user to create connections between concepts

DEPTH LEVELS:
- Level 1: Basic recall (What is it?)
- Level 2: Mechanism (How does it work?)
- Level 3: Causation (Why does it happen?)
- Level 4: Connections (How does it relate to X?)
- Level 5: Innovation (What if we changed X?)

FORMAT:
🧠 **Depth Level [N]/5**
❓ [Probing question]

After answer:
[Evaluation of depth]
🔍 **Going deeper:** [Next level question]

Be relentless but supportive. The goal is to build neural connections that last.`,

  visualize: `You are a Dual Coding Visualization Engine inside Lumina Hub. You strengthen memory using both verbal and visual pathways.

RULES:
1. For any concept, generate structured visual representations
2. Use ASCII diagrams, flowcharts, mind maps, and structured hierarchies
3. Sync visuals with explanations — both channels reinforce each other
4. Ask the user to INTERPRET the visual (active engagement)

FORMATS TO USE:
- Flowcharts: Use arrows (→, ↓, ↗) and boxes
- Mind maps: Central concept with radiating branches
- Hierarchies: Indented tree structures
- Comparison tables: Side-by-side analysis
- Process diagrams: Step-by-step with numbered stages

After generating visual:
🤔 **Your turn:** "Based on this diagram, explain [specific part]"
🔍 **What's missing?** "What would you add to this visual?"

Make visuals clean, precise, and memorable. Use Unicode box-drawing characters for professional diagrams.`,

  cognitive: `You are a Metacognition Analytics Engine inside Lumina Hub. You make users AWARE of their own learning patterns.

ANALYZE:
1. Accuracy trends across topics
2. Recall speed patterns
3. Confidence vs correctness gaps (overconfidence detection)
4. Weak vs strong topic identification
5. Forgetting risk prediction

FORMAT:
📊 **Cognitive Report**

🎯 **Accuracy Overview**
[Analysis with percentages]

🧠 **Confidence Calibration**
[Where confidence doesn't match performance]

⚠️ **Forgetting Risk**
[Topics at risk of being forgotten]

💪 **Strengths**
[Well-retained topics]

🎯 **Action Plan**
1. [Specific recommendation]
2. [Specific recommendation]
3. [Specific recommendation]

Ask the user about their recent study patterns to provide personalized insights. Be data-driven, specific, and actionable.`,
};

// ─── Session Component ───────────────────────────────
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

  // Update stats from AI responses
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
        if (resp.status === 402) throw new Error('AI credits are exhausted right now. Please add credits.');
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
  }, [user, messages, module.id]);

  const startSession = () => {
    if (!topic.trim()) return;
    setStarted(true);
    let msg = `Topic: ${topic}.`;
    if (module.id === 'recall') {
      msg += ` My confidence level: ${confidence[0]}%. Start with an active recall question. Remember: never show me the answer first — make me retrieve it from memory.`;
    } else if (module.id === 'spaced') {
      msg += ` Create a spaced repetition schedule. Start by testing what I currently remember about this topic.`;
    } else if (module.id === 'shuffle') {
      msg += ` I want to practice interleaved learning. Mix questions unpredictably. Start the mixed session.`;
    } else if (module.id === 'explain') {
      msg += ` Ask me to explain this concept using the Feynman Technique. Evaluate my explanation strictly.`;
    } else if (module.id === 'why') {
      msg += ` Start the Why Engine. Push me to elaborate deeply. Begin at Depth Level 1.`;
    } else if (module.id === 'visualize') {
      msg += ` Generate a visual representation (diagram/flowchart/mind map) and then ask me to interpret it.`;
    } else if (module.id === 'cognitive') {
      msg += ` Analyze my learning patterns for this topic. Ask me questions to build a cognitive profile.`;
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

            {/* Science callout */}
            <div className="mt-6 liquid-glass-subtle rounded-xl p-4 border border-border/10">
              <div className="flex items-start gap-3">
                <Zap className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-foreground mb-1">Why {module.principle}?</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {module.id === 'recall' && 'Testing yourself forces your brain to reconstruct knowledge, strengthening neural pathways far more effectively than re-reading.'}
                    {module.id === 'spaced' && 'Reviewing at precisely timed intervals prevents forgetting and moves information from short-term to long-term memory.'}
                    {module.id === 'shuffle' && 'Mixing topics forces your brain to discriminate between concepts, building stronger problem-solving abilities.'}
                    {module.id === 'explain' && 'If you can\'t explain it simply, you don\'t understand it well enough. Teaching forces deep processing.'}
                    {module.id === 'why' && 'Asking "why" creates elaborate mental connections, making information more meaningful and memorable.'}
                    {module.id === 'visualize' && 'Combining words with visuals activates two brain channels simultaneously, doubling encoding strength.'}
                    {module.id === 'cognitive' && 'Awareness of your own learning patterns allows you to optimize study strategies and identify blind spots.'}
                  </p>
                </div>
              </div>
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
                  <div className="prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&>p]:mb-3 [&>h1]:mb-3 [&>h2]:mb-3 [&>h3]:mb-2 [&>ul]:mb-3 [&>ol]:mb-3 [&>table]:mb-3">
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

// ─── Main Hub Page ───────────────────────────────
const LuminaHub = () => {
  const { isPro, isProPlus } = useSubscription();
  const { checkAndIncrement, showUpgrade, setShowUpgrade } = useUsageLimits();
  const [activeModule, setActiveModule] = useState<Module | null>(null);
  const navigate = useNavigate();

  // Hub access: PRO+ = unlimited, Ultimate = daily caps (same as basic), Basic = daily caps
  const hasFullHubAccess = isProPlus;

  const openModule = async (mod: Module) => {
    // PRO+ gets unlimited Hub access
    if (hasFullHubAccess) {
      setActiveModule(mod);
      return;
    }
    // Ultimate and Basic both have daily caps for Hub modules
    const allowed = await checkAndIncrement(mod.feature);
    if (!allowed) return;
    setActiveModule(mod);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <UpgradePopup open={showUpgrade} onClose={() => setShowUpgrade(false)} />

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-4 mb-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center shadow-xl shadow-violet-500/10">
            <Brain className="w-7 h-7 text-violet-400" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Lumina Hub</h1>
            <p className="text-muted-foreground text-sm">Neurocognitive brain gym — 7 science-backed modules</p>
          </div>
        </div>

        {/* PRO+ upsell for non-PRO+ users */}
        {!hasFullHubAccess && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-4 rounded-2xl border border-violet-500/20 bg-gradient-to-r from-violet-500/5 to-purple-500/5 p-4 flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center shrink-0">
                <Crown className="w-5 h-5 text-violet-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Unlock Full Hub Access</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {isPro ? 'Upgrade to PRO+ for unlimited Hub modules' : 'Get PRO+ for unlimited access to all 7 brain modules'}
                </p>
              </div>
            </div>
            <Button
              onClick={() => navigate('/upgrade')}
              size="sm"
              className="shrink-0 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 text-white text-xs font-semibold hover:opacity-90"
            >
              <Rocket className="w-3.5 h-3.5 mr-1" /> PRO+
            </Button>
          </motion.div>
        )}
      </motion.div>

      {/* Learning Loop Visualization */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8 liquid-glass-subtle rounded-2xl p-4 border border-border/10"
      >
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Learning Loop</p>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px]">
          {['Encode', 'Retrieve', 'Struggle', 'Correct', 'Reinforce', 'Space', 'Mix', 'Reflect'].map((step, i) => (
            <span key={step} className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="px-2 py-1 rounded-lg bg-primary/10 text-primary font-medium">{step}</span>
              {i < 7 && <span className="text-muted-foreground/30">→</span>}
            </span>
          ))}
        </div>
      </motion.div>

      {/* Module Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((mod, i) => {
          const Icon = mod.icon;
          return (
            <motion.button
              key={mod.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.06 }}
              whileHover={{ scale: 1.02, y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => openModule(mod)}
              className={`text-left rounded-2xl liquid-glass p-5 border border-border/10 hover:border-primary/20 transition-all duration-300 group relative overflow-hidden ${mod.bgGlow}`}
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${mod.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                <Icon className={`w-6 h-6 ${mod.iconColor}`} />
              </div>
              <h3 className="text-base font-display font-semibold text-foreground mb-1">{mod.title}</h3>
              <p className="text-xs text-muted-foreground/70 mb-2">{mod.desc}</p>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/5 text-primary/60 border border-primary/10">
                {mod.principle}
              </span>
              {!hasFullHubAccess && (
                <span className="block mt-2 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 w-fit">
                  Free: {mod.freeLimit}
                </span>
              )}
              <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/20 group-hover:text-primary/50 transition-all group-hover:translate-x-1" />
            </motion.button>
          );
        })}
      </div>

      {/* Active Session Overlay */}
      <AnimatePresence>
        {activeModule && (
          <HubSession module={activeModule} onClose={() => setActiveModule(null)} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default LuminaHub;
